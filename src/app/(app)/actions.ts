"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { DEAL_STAGES, FOLLOWUP_TONES, isProspectStatus, type DealStage, type FollowupTone } from "@/lib/prospects";
import { isFollowupScenario, renderFollowup, scenarioTag, type FollowupScenario } from "@/lib/followups/templates";
import { isUuid } from "@/lib/data/prospects";
import { formatPersonName } from "@/lib/user/display-name";

export type ActionResult = { ok: true } | { ok: false; message: string };

const GENERIC_ERROR = "L'enregistrement a échoué. Réessayez dans un instant.";

// Un changement de statut modifie le tableau de bord, la liste, la fiche et le compteur de la
// barre latérale : on invalide tout l'espace connecté.
function revalidateProspectViews() {
  revalidatePath("/", "layout");
}

/** Change le statut d'un prospect (badge de statut, E4 et E5). */
export async function updateProspectStatus(prospectId: string, status: string): Promise<ActionResult> {
  if (!isUuid(prospectId) || !isProspectStatus(status)) return { ok: false, message: "Requête invalide." };
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospects")
    .update({ statut: status })
    .eq("utilisateur_id", user.id)
    .eq("id", prospectId)
    .select("id");

  if (error) {
    console.error("[prospects] changement de statut impossible", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!data.length) return { ok: false, message: "Ce prospect n'existe plus." };

  revalidateProspectViews();
  return { ok: true };
}

/**
 * Change l'étape d'un dossier (Kanban « Mes dossiers »), puis recalcule probabilité, argent
 * récupérable et score : ils dépendent du poids de l'étape.
 */
export async function updateProspectStage(prospectId: string, stage: string): Promise<ActionResult> {
  if (!isUuid(prospectId) || !(DEAL_STAGES as readonly string[]).includes(stage)) {
    return { ok: false, message: "Requête invalide." };
  }
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("prospects")
    .update({ etape: stage as DealStage })
    .eq("utilisateur_id", user.id)
    .eq("id", prospectId)
    .select("id");

  if (error) {
    console.error("[prospects] changement d'étape impossible", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!data.length) return { ok: false, message: "Ce dossier n'existe plus." };

  const recalcul = await supabase.rpc("recalculer_prospects");
  if (recalcul.error) console.error("[prospects] recalcul après changement d'étape impossible", { code: recalcul.error.code });

  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre l'objet et le corps d'une relance modifiée par l'utilisateur (E5). */
export async function saveFollowupDraft(relanceId: string, subject: string, body: string): Promise<ActionResult> {
  const objet = subject.trim();
  const corps = body.trim();
  if (!isUuid(relanceId)) return { ok: false, message: "Requête invalide." };
  if (!objet || objet.length > 300) return { ok: false, message: "L'objet doit faire entre 1 et 300 caractères." };
  if (!corps || corps.length > 10000) return { ok: false, message: "Le message doit faire entre 1 et 10 000 caractères." };

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("relances")
    .update({ objet, corps })
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .select("id");

  if (error) {
    console.error("[relances] enregistrement impossible", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!data.length) return { ok: false, message: "Cette relance n'existe plus." };
  return { ok: true };
}

/** Horodate la copie d'une relance (mesure de l'usage réel, `copiee_le`). */
export async function markFollowupCopied(relanceId: string): Promise<ActionResult> {
  if (!isUuid(relanceId)) return { ok: false, message: "Requête invalide." };
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("relances")
    .update({ copiee_le: new Date().toISOString() })
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .select("id");

  if (error) {
    console.error("[relances] horodatage de copie impossible", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!data.length) return { ok: false, message: "Cette relance n'existe plus." };

  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre (ou efface, avec null) le taux de commission du compte, en %. */
export async function updateCommissionRate(rate: number | null): Promise<ActionResult> {
  if (rate !== null && (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 100)) {
    return { ok: false, message: "Le taux doit être compris entre 0,01 et 100 %." };
  }
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("utilisateurs")
    .update({ taux_commission: rate === null ? null : Math.round(rate * 100) / 100 })
    .eq("id", user.id);
  if (error) {
    console.error("[réglages] taux de commission impossible à enregistrer", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre le prénom et le nom affichés (colonne `utilisateurs.nom`, « Prénom Nom »). */
export async function updateDisplayName(firstName: string, lastName: string): Promise<ActionResult> {
  const nom = formatPersonName(`${typeof firstName === "string" ? firstName : ""} ${typeof lastName === "string" ? lastName : ""}`);
  if (!nom) return { ok: false, message: "Indiquez au moins votre prénom." };
  if (nom.length > 120) return { ok: false, message: "120 caractères au maximum." };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("utilisateurs").update({ nom }).eq("id", user.id);
  if (error) {
    console.error("[compte] nom impossible à enregistrer", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  revalidateProspectViews();
  return { ok: true };
}

export type PreparedFollowup = { id: string; objet: string; corps: string; ton: FollowupTone; scenario: FollowupScenario };

/**
 * Prépare une relance à partir d'un modèle (sans IA, sans coût) : les données du dossier et la
 * signature sont relues en base, le modèle est complété, puis la relance est enregistrée. Tant
 * qu'elle n'a été ni copiée ni ouverte dans Gmail, changer de modèle ou de ton réécrit le même
 * brouillon au lieu d'en créer un nouveau.
 */
export async function prepareFollowup(
  prospectId: string,
  scenario: string,
  tone: string
): Promise<{ ok: true; relance: PreparedFollowup } | { ok: false; message: string }> {
  if (!isUuid(prospectId) || !isFollowupScenario(scenario) || !(FOLLOWUP_TONES as readonly string[]).includes(tone)) {
    return { ok: false, message: "Requête invalide." };
  }
  const ton = tone as FollowupTone;
  const user = await requireUser();
  const supabase = await createClient();

  const [prospectResult, profilResult, latestResult] = await Promise.all([
    supabase
      .from("prospects")
      .select("entreprise, contact_nom, etape, date_dernier_contact")
      .eq("utilisateur_id", user.id)
      .eq("id", prospectId)
      .maybeSingle(),
    supabase.from("utilisateurs").select("nom, signature").eq("id", user.id).maybeSingle(),
    supabase
      .from("relances")
      .select("id, copiee_le")
      .eq("utilisateur_id", user.id)
      .eq("prospect_id", prospectId)
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (prospectResult.error || profilResult.error || latestResult.error) {
    console.error("[relances] lecture impossible avant préparation");
    return { ok: false, message: GENERIC_ERROR };
  }
  if (!prospectResult.data) return { ok: false, message: "Ce prospect n'existe plus." };

  const profil = profilResult.data;
  const { objet, corps } = renderFollowup(prospectResult.data, scenario, ton, {
    signature: profil?.signature ?? null,
    nom: profil?.nom ? formatPersonName(profil.nom) : null,
  });
  const values = { objet, corps, ton, modele_ia: scenarioTag(scenario) };
  const draft = latestResult.data && !latestResult.data.copiee_le ? latestResult.data : null;

  const { data, error } = draft
    ? await supabase.from("relances").update(values).eq("utilisateur_id", user.id).eq("id", draft.id).select("id").single()
    : await supabase
        .from("relances")
        .insert({ ...values, prospect_id: prospectId, utilisateur_id: user.id })
        .select("id")
        .single();
  if (error) {
    console.error("[relances] enregistrement impossible", { code: error.code });
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true, relance: { id: data.id, objet, corps, ton, scenario } };
}
