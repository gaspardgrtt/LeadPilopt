"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { isProspectStatus } from "@/lib/prospects";
import { isUuid } from "@/lib/data/prospects";

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
