"use server";

import { getI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { requireUser } from "@/lib/auth/session";
import { DEAL_STAGES, FOLLOWUP_TONES, isProspectStatus, type DealStage, type FollowupTone } from "@/lib/prospects";
import { isFollowupScenario, renderFollowup, scenarioTag, type FollowupScenario } from "@/lib/followups/templates";
import { isUuid } from "@/lib/data/prospects";
import { formatPersonName } from "@/lib/user/display-name";
import {
  LANGUE_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  isLangue,
  isTheme,
  type Langue,
  type Theme,
} from "@/lib/preferences/preferences";
import { getBrevoSenderIdentity } from "@/lib/brevo/config";
import { buildEmailContent, checkEmailContent, isValidEmail } from "@/lib/followups/email";
import {
  CHANNELS_BY_TYPE,
  activityTimestamp,
  isActivityType,
  isChannel,
  isNextActionChoice,
  nextActionDate,
  type ActivityType,
} from "@/lib/activity/activity";

export type ActionResult = { ok: true } | { ok: false; message: string };


// Un changement de statut modifie le tableau de bord, la liste, la fiche et le compteur de la
// barre latérale : on invalide tout l'espace connecté.
function revalidateProspectViews() {
  revalidatePath("/", "layout");
}

/** Change le statut d'un prospect (badge de statut, E4 et E5). */
export async function updateProspectStatus(prospectId: string, status: string): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!isUuid(prospectId) || !isProspectStatus(status)) return { ok: false, message: t.actions.invalidRequest };
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
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.prospectGone };

  revalidateProspectViews();
  return { ok: true };
}

/**
 * Change l'étape d'un dossier (Kanban « Mes dossiers »), puis recalcule probabilité, argent
 * récupérable et score : ils dépendent du poids de l'étape.
 */
export async function updateProspectStage(prospectId: string, stage: string): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!isUuid(prospectId) || !(DEAL_STAGES as readonly string[]).includes(stage)) {
    return { ok: false, message: t.actions.invalidRequest };
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
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.dealGone };

  const recalcul = await supabase.rpc("recalculer_prospects");
  if (recalcul.error) console.error("[prospects] recalcul après changement d'étape impossible", { code: recalcul.error.code });

  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre l'objet et le corps d'une relance modifiée par l'utilisateur (E5). */
export async function saveFollowupDraft(relanceId: string, subject: string, body: string): Promise<ActionResult> {
  const { t } = await getI18n();
  const objet = subject.trim();
  const corps = body.trim();
  if (!isUuid(relanceId)) return { ok: false, message: t.actions.invalidRequest };
  if (!objet || objet.length > 300) return { ok: false, message: t.actions.subjectLength };
  if (!corps || corps.length > 10000) return { ok: false, message: t.actions.bodyLength };

  const user = await requireUser();
  const supabase = await createClient();
  // Une relance envoyée (ou en cours d'envoi) par e-mail n'est plus modifiable.
  const { data: current, error: readError } = await supabase
    .from("relances")
    .select("*")
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .eq("type", "brouillon")
    .maybeSingle();
  if (readError) {
    console.error("[relances] lecture impossible", { code: readError.code });
    return { ok: false, message: t.actions.generic };
  }
  if (!current) return { ok: false, message: t.actions.followupGone };
  if (current.envoi_statut === "envoyee" || current.envoi_statut === "en_cours") {
    return { ok: false, message: t.actions.alreadySentLocked };
  }
  const { data, error } = await supabase
    .from("relances")
    .update({ objet, corps })
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .eq("type", "brouillon")
    .select("id");

  if (error) {
    console.error("[relances] enregistrement impossible", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.followupGone };
  return { ok: true };
}

/**
 * Horodate la copie ou l'ouverture dans Gmail d'un brouillon (`copiee_le`). Ce n'est pas un envoi :
 * ni la date de dernier contact ni le statut du dossier ne changent (aucun envoi n'est vérifiable).
 */
export async function markFollowupCopied(relanceId: string): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!isUuid(relanceId)) return { ok: false, message: t.actions.invalidRequest };
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("relances")
    .update({ copiee_le: new Date().toISOString() })
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .eq("type", "brouillon")
    .select("id");

  if (error) {
    console.error("[relances] horodatage de copie impossible", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.followupGone };

  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre (ou efface, avec null) le taux de commission du compte, en %. */
export async function updateCommissionRate(rate: number | null): Promise<ActionResult> {
  const { t } = await getI18n();
  if (rate !== null && (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || rate > 100)) {
    return { ok: false, message: t.actions.commissionRange };
  }
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("utilisateurs")
    .update({ taux_commission: rate === null ? null : Math.round(rate * 100) / 100 })
    .eq("id", user.id);
  if (error) {
    console.error("[réglages] taux de commission impossible à enregistrer", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  revalidateProspectViews();
  return { ok: true };
}

/** Enregistre le prénom et le nom affichés (colonne `utilisateurs.nom`, « Prénom Nom »). */
export async function updateDisplayName(firstName: string, lastName: string): Promise<ActionResult> {
  const { t } = await getI18n();
  const nom = formatPersonName(`${typeof firstName === "string" ? firstName : ""} ${typeof lastName === "string" ? lastName : ""}`);
  if (!nom) return { ok: false, message: t.actions.nameRequired };
  if (nom.length > 120) return { ok: false, message: t.actions.nameTooLong };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("utilisateurs").update({ nom }).eq("id", user.id);
  if (error) {
    console.error("[compte] nom impossible à enregistrer", { code: error.code });
    return { ok: false, message: t.actions.generic };
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
  const { t } = await getI18n();
  if (!isUuid(prospectId) || !isFollowupScenario(scenario) || !(FOLLOWUP_TONES as readonly string[]).includes(tone)) {
    return { ok: false, message: t.actions.invalidRequest };
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
      .select("*")
      .eq("utilisateur_id", user.id)
      .eq("prospect_id", prospectId)
      .eq("type", "brouillon")
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (prospectResult.error || profilResult.error || latestResult.error) {
    console.error("[relances] lecture impossible avant préparation");
    return { ok: false, message: t.actions.generic };
  }
  if (!prospectResult.data) return { ok: false, message: t.actions.prospectGone };

  const profil = profilResult.data;
  const { objet, corps } = renderFollowup(prospectResult.data, scenario, ton, {
    signature: profil?.signature ?? null,
    nom: profil?.nom ? formatPersonName(profil.nom) : null,
  });
  const values = { objet, corps, ton, modele_ia: scenarioTag(scenario) };
  const latest = latestResult.data;
  const draft = latest && !latest.copiee_le && !latest.envoi_statut ? latest : null;

  const { data, error } = draft
    ? await supabase.from("relances").update(values).eq("utilisateur_id", user.id).eq("id", draft.id).select("id").single()
    : await supabase
        .from("relances")
        .insert({ ...values, prospect_id: prospectId, utilisateur_id: user.id })
        .select("id")
        .single();
  if (error) {
    console.error("[relances] enregistrement impossible", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  return { ok: true, relance: { id: data.id, objet, corps, ton, scenario } };
}

export type EmailPreview = {
  to: { email: string; name: string | null };
  from: { email: string; name: string };
  replyTo: string | null;
  subject: string;
  /** Message saisi, renvoyé tel quel à la route d'envoi (contrôle d'identité avec le brouillon). */
  body: string;
  /** Texte exact envoyé, mention d'opposition comprise. */
  text: string;
};

/**
 * Aperçu de l'e-mail avant confirmation : destinataire, expéditeur et contenu tels que Brevo les
 * recevra. Aucun envoi ici. Renvoie la raison quand l'envoi est impossible (opposition, adresse
 * absente, configuration manquante, relance déjà envoyée).
 */
export async function getEmailPreview(
  relanceId: string
): Promise<{ ok: true; preview: EmailPreview } | { ok: false; message: string }> {
  const { t, locale } = await getI18n();
  if (!isUuid(relanceId)) return { ok: false, message: t.actions.invalidRequest };
  const sender = getBrevoSenderIdentity();
  if (!sender) return { ok: false, message: t.actions.emailNotConfigured };
  const user = await requireUser();
  const supabase = await createClient();

  const { data: relance, error } = await supabase
    .from("relances")
    .select("*")
    .eq("utilisateur_id", user.id)
    .eq("id", relanceId)
    .eq("type", "brouillon")
    .maybeSingle();
  if (error) return { ok: false, message: t.actions.generic };
  if (!relance) return { ok: false, message: t.actions.followupGone };
  if (relance.envoi_statut === "envoyee") return { ok: false, message: t.actions.alreadySent };
  if (relance.envoi_statut === "en_cours") return { ok: false, message: t.actions.sendInProgress };

  const [prospectResult, profilResult] = await Promise.all([
    supabase
      .from("prospects")
      .select("*")
      .eq("utilisateur_id", user.id)
      .eq("id", relance.prospect_id)
      .maybeSingle(),
    supabase.from("utilisateurs").select("email").eq("id", user.id).maybeSingle(),
  ]);
  if (prospectResult.error || profilResult.error) return { ok: false, message: t.actions.generic };
  const prospect = prospectResult.data;
  if (!prospect) return { ok: false, message: t.actions.prospectGone };
  if (prospect.opposition_prospection_le) {
    return { ok: false, message: t.actions.optedOut };
  }
  if (!isValidEmail(prospect.contact_email)) {
    return { ok: false, message: t.actions.badRecipient };
  }
  const content = checkEmailContent(relance.objet, relance.corps, locale);
  if (!content.ok) return { ok: false, message: content.message };

  return {
    ok: true,
    preview: {
      to: { email: prospect.contact_email.trim(), name: prospect.contact_nom?.trim() || null },
      from: sender,
      replyTo: profilResult.data?.email ?? null,
      subject: content.subject,
      body: content.body,
      text: buildEmailContent(content.body).text,
    },
  };
}

/**
 * Enregistre (ou lève) l'opposition d'un prospect à la prospection. Une opposition bloque tout envoi
 * et passe le dossier en « Ignoré » pour qu'il ne soit plus proposé à la relance.
 */
export async function setProspectOpposition(prospectId: string, opposed: boolean): Promise<ActionResult> {
  const { t } = await getI18n();
  if (!isUuid(prospectId) || typeof opposed !== "boolean") return { ok: false, message: t.actions.invalidRequest };
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .update(opposed ? { opposition_prospection_le: new Date().toISOString(), statut: "ignore" } : { opposition_prospection_le: null })
    .eq("utilisateur_id", user.id)
    .eq("id", prospectId)
    .select("id");
  if (error) {
    console.error("[prospects] opposition impossible à enregistrer", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.prospectGone };
  revalidateProspectViews();
  return { ok: true };
}

/**
 * Enregistre les préférences d'affichage du compte (page Paramètres) et les recopie dans les
 * cookies de l'appareil, lus avant le premier affichage. Seules les valeurs connues sont acceptées.
 */
export async function updatePreferences(input: { theme?: unknown; langue?: unknown }): Promise<ActionResult> {
  const { t } = await getI18n();
  const values: { theme?: Theme; langue?: Langue } = {};
  if (input?.theme !== undefined) {
    if (!isTheme(input.theme)) return { ok: false, message: t.actions.unknownTheme };
    values.theme = input.theme;
  }
  if (input?.langue !== undefined) {
    if (!isLangue(input.langue)) return { ok: false, message: t.actions.unknownLanguage };
    values.langue = input.langue;
  }
  if (!values.theme && !values.langue) return { ok: false, message: t.actions.invalidRequest };

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("utilisateurs").update(values).eq("id", user.id).select("id");
  if (error) {
    console.error("[préférences] enregistrement impossible", { code: error.code });
    return { ok: false, message: t.actions.generic };
  }
  if (!data.length) return { ok: false, message: t.actions.generic };

  const cookieStore = await cookies();
  const cookieOptions = {
    path: "/",
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: false,
  };
  if (values.theme) cookieStore.set(THEME_COOKIE, values.theme, cookieOptions);
  if (values.langue) cookieStore.set(LANGUE_COOKIE, values.langue, cookieOptions);
  revalidateProspectViews();
  return { ok: true };
}

// ---------------------------------------------------------------------------- activités

type EnregistrerActiviteArgs = Database["public"]["Functions"]["enregistrer_activite"]["Args"];

/**
 * Paramètres de la fonction SQL `enregistrer_activite`. Le générateur de types Supabase ne sait pas
 * qu'un paramètre de fonction peut être null : il déclare canal, résumé et prochaine action en
 * `string`. La fonction SQL accepte bien null (activité sans canal, sans résumé, sans prochaine
 * action), ce que vérifient les tests de base de données.
 */
function activiteArgs(args: Omit<EnregistrerActiviteArgs, "p_canal" | "p_resume" | "p_prochaine_action"> & {
  p_canal: string | null;
  p_resume: string | null;
  p_prochaine_action: string | null;
}): EnregistrerActiviteArgs {
  return args as EnregistrerActiviteArgs;
}

export type ActivityInput = {
  /** Identifiant généré par le navigateur : une nouvelle tentative ne crée pas de doublon. */
  id: string;
  prospectId: string;
  type: string;
  channel: string | null;
  summary: string;
  /** « maintenant », « hier » ou une date AAAA-MM-JJ (passée ou du jour). */
  when: string;
  /** Choix de prochaine action, ou null pour ne pas la modifier. */
  next: string | null;
  nextDate: string | null;
};

export type ActivityResult =
  | { ok: true; created: boolean; contact: boolean; nextAction: string | null; nextChanged: boolean }
  | { ok: false; message: string };

/**
 * Enregistre une activité réellement effectuée (relance, appel, message, note) dans l'historique
 * du dossier. Une relance, un appel ou un message avancent la date de dernier contact, passent le
 * dossier « À traiter » en « Relancé » et recalculent les priorités ; une note ne change rien.
 * Tout est fait dans une seule fonction SQL (une transaction, droits de l'utilisateur, RLS).
 */
export async function recordActivity(input: ActivityInput): Promise<ActivityResult> {
  const { t } = await getI18n();
  if (!isUuid(input.id) || !isUuid(input.prospectId) || !isActivityType(input.type)) {
    return { ok: false, message: t.actions.invalidRequest };
  }
  const type: ActivityType = input.type;
  const allowed = CHANNELS_BY_TYPE[type];
  const channel = allowed.length === 0 ? null : input.channel;
  if (allowed.length > 0 && (!isChannel(channel) || !allowed.includes(channel))) {
    return { ok: false, message: t.activity.errors.invalid };
  }
  const summary = (input.summary ?? "").trim();
  if (summary.length > 2000) return { ok: false, message: t.activity.errors.invalid };
  if (type === "note" && !summary) return { ok: false, message: t.activity.dialog.noteRequired };
  const at = activityTimestamp(input.when);
  if (at === "invalide") return { ok: false, message: t.activity.dialog.errorDate };
  let nextAction: string | null = null;
  const modifyNext = input.next !== null;
  if (modifyNext) {
    if (!isNextActionChoice(input.next)) return { ok: false, message: t.activity.errors.invalid };
    const date = nextActionDate(input.next, input.nextDate);
    if (date === "invalide") return { ok: false, message: t.activity.dialog.errorNextDate };
    nextAction = date;
  }

  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "enregistrer_activite",
    activiteArgs({
      p_id: input.id,
      p_prospect: input.prospectId,
      p_type: type,
      p_canal: channel,
      p_resume: summary || null,
      p_effectuee_le: at,
      p_prochaine_action: nextAction,
      p_modifier_prochaine: modifyNext,
    })
  );
  if (error) {
    console.error("[activités] enregistrement impossible", { code: error.code });
    if (error.code === "P0001") return { ok: false, message: t.activity.errors.opposition };
    if (error.code === "23503" || error.code === "P0002") return { ok: false, message: t.actions.prospectGone };
    if (error.code === "22023" || error.code === "23514") return { ok: false, message: t.activity.errors.invalid };
    return { ok: false, message: t.actions.generic };
  }
  revalidateProspectViews();
  return { ok: true, created: data === true, contact: type !== "note", nextAction, nextChanged: modifyNext };
}

/**
 * Programme (ou retire, avec « aucune ») la prochaine action d'un dossier, par exemple après un
 * envoi par e-mail. Une date programmée est aussi tracée dans l'historique ; « aucune » ne crée
 * aucun rappel fictif.
 */
export async function scheduleNextAction(input: { id: string; prospectId: string; next: string; nextDate: string | null }): Promise<ActivityResult> {
  const { t } = await getI18n();
  if (!isUuid(input.id) || !isUuid(input.prospectId) || !isNextActionChoice(input.next)) {
    return { ok: false, message: t.actions.invalidRequest };
  }
  const date = nextActionDate(input.next, input.nextDate);
  if (date === "invalide") return { ok: false, message: t.activity.dialog.errorNextDate };
  const user = await requireUser();
  const supabase = await createClient();

  if (date === null) {
    const { data, error } = await supabase
      .from("prospects")
      .update({ prochaine_action_le: null })
      .eq("utilisateur_id", user.id)
      .eq("id", input.prospectId)
      .select("id");
    if (error) {
      console.error("[activités] suppression de la prochaine action impossible", { code: error.code });
      return { ok: false, message: t.actions.generic };
    }
    if (!data.length) return { ok: false, message: t.actions.prospectGone };
    revalidateProspectViews();
    return { ok: true, created: false, contact: false, nextAction: null, nextChanged: true };
  }

  const { data, error } = await supabase.rpc(
    "enregistrer_activite",
    activiteArgs({
      p_id: input.id,
      p_prospect: input.prospectId,
      p_type: "prochaine_action",
      p_canal: null,
      p_resume: null,
      p_effectuee_le: new Date().toISOString(),
      p_prochaine_action: date,
      p_modifier_prochaine: true,
    })
  );
  if (error) {
    console.error("[activités] prochaine action impossible", { code: error.code });
    if (error.code === "23503" || error.code === "P0002") return { ok: false, message: t.actions.prospectGone };
    return { ok: false, message: t.actions.generic };
  }
  revalidateProspectViews();
  return { ok: true, created: data === true, contact: false, nextAction: date, nextChanged: true };
}
