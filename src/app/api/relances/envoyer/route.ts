import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/data/prospects";
import { BrevoError, sendBrevoEmail } from "@/lib/brevo/client";
import { ensureVerifiedSender, getBrevoConfig } from "@/lib/brevo/config";
import { buildEmailContent, checkEmailContent, isValidEmail } from "@/lib/followups/email";
import { formatPersonName } from "@/lib/user/display-name";
import { getI18n } from "@/i18n/server";

// Envoi d'une relance par e-mail via Brevo, après aperçu et confirmation dans l'interface.
// Corps attendu : { relanceId, objet, corps } — l'objet et le corps sont ceux affichés dans
// l'aperçu ; ils doivent être identiques au brouillon enregistré, sinon l'envoi est refusé.
// Contrôles, dans l'ordre : origine de la requête, session, configuration Brevo, relance et
// prospect appartenant au compte (RLS + filtre explicite), opposition à la prospection, adresse
// du destinataire, statut d'envoi, limite horaire, expéditeur vérifié dans Brevo, réservation
// atomique (anti double envoi), puis envoi et enregistrement du statut.

export const maxDuration = 30;

/** Envois par compte et par heure (garde-fou contre les erreurs de manipulation et les abus). */
const HOURLY_SEND_LIMIT = 30;

function jsonError(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}

export async function POST(request: NextRequest) {
  const { t, locale } = await getI18n();
  // Requête émise par l'application elle-même (pas depuis un autre site).
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return jsonError(403, t.sending.refused);

  let payload: { relanceId?: unknown; objet?: unknown; corps?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, t.actions.invalidRequest);
  }
  const relanceId = typeof payload.relanceId === "string" ? payload.relanceId : "";
  const content = checkEmailContent(payload.objet, payload.corps, locale);
  if (!isUuid(relanceId)) return jsonError(400, t.actions.invalidRequest);
  if (!content.ok) return jsonError(422, content.message);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return jsonError(401, t.sending.sessionExpired);

  const config = getBrevoConfig();
  if (!config) return jsonError(503, t.actions.emailNotConfigured);

  // Relance et prospect du compte connecté uniquement (RLS + filtre explicite sur le compte).
  const { data: relance, error: relanceError } = await supabase
    .from("relances")
    .select("*")
    .eq("utilisateur_id", userId)
    .eq("id", relanceId)
    .maybeSingle();
  if (relanceError) return jsonError(500, t.sending.loadFollowupFailed);
  if (!relance) return jsonError(404, t.actions.followupGone);

  const [prospectResult, profilResult, recentResult] = await Promise.all([
    supabase
      .from("prospects")
      .select("id, entreprise, contact_nom, contact_email, statut, opposition_prospection_le")
      .eq("utilisateur_id", userId)
      .eq("id", relance.prospect_id)
      .maybeSingle(),
    supabase.from("utilisateurs").select("email, nom").eq("id", userId).maybeSingle(),
    supabase
      .from("relances")
      .select("id", { count: "exact", head: true })
      .eq("utilisateur_id", userId)
      .gte("envoi_demande_le", new Date(Date.now() - 3_600_000).toISOString()),
  ]);
  if (prospectResult.error || profilResult.error || recentResult.error) {
    console.error("[envoi] lecture impossible", {
      prospect: prospectResult.error?.code,
      profil: profilResult.error?.code,
      recent: recentResult.error?.code,
    });
    return jsonError(500, t.sending.loadDealFailed);
  }
  const prospect = prospectResult.data;
  if (!prospect) return jsonError(404, t.actions.prospectGone);

  if (prospect.opposition_prospection_le) {
    return jsonError(409, t.actions.optedOut);
  }
  const recipient = prospect.contact_email?.trim() ?? "";
  if (!isValidEmail(recipient)) return jsonError(422, t.actions.badRecipient);

  if (relance.envoi_statut === "envoyee") return jsonError(409, t.actions.alreadySent);
  if (relance.envoi_statut === "en_cours") return jsonError(409, t.actions.sendInProgress);
  if (relance.objet.trim() !== content.subject || relance.corps.trim() !== content.body) {
    return jsonError(409, t.sending.changedSincePreview);
  }
  if ((recentResult.count ?? 0) >= HOURLY_SEND_LIMIT) {
    return jsonError(429, t.sending.hourlyLimit(HOURLY_SEND_LIMIT));
  }

  const sender = await ensureVerifiedSender(config, locale);
  if (!sender.ok) return jsonError(503, sender.message);

  // Réservation atomique : une seule requête peut passer la relance « en cours ».
  const { data: reserved, error: reserveError } = await supabase
    .from("relances")
    .update({ envoi_statut: "en_cours", envoi_demande_le: new Date().toISOString(), envoi_erreur: null })
    .eq("utilisateur_id", userId)
    .eq("id", relanceId)
    .or("envoi_statut.is.null,envoi_statut.eq.echec")
    .select("id");
  if (reserveError) return jsonError(500, t.sending.startFailed);
  if (!reserved?.length) return jsonError(409, t.sending.alreadySending);

  const profil = profilResult.data;
  const { text, html } = buildEmailContent(content.body);
  const replyEmail = profil?.email && isValidEmail(profil.email) ? profil.email : null;

  try {
    const { messageId } = await sendBrevoEmail(
      config,
      {
        to: { email: recipient, ...(prospect.contact_nom?.trim() ? { name: prospect.contact_nom.trim().slice(0, 70) } : {}) },
        ...(replyEmail ? { replyTo: { email: replyEmail, ...(profil?.nom ? { name: formatPersonName(profil.nom).slice(0, 70) } : {}) } } : {}),
        subject: content.subject,
        textContent: text,
        htmlContent: html,
        tags: ["leadpilot-relance"],
      },
      fetch,
      locale
    );

    const sentAt = new Date().toISOString();
    const { error: saveError } = await supabase
      .from("relances")
      .update({
        envoi_statut: "envoyee",
        envoyee_le: sentAt,
        envoyee_a: recipient,
        brevo_message_id: messageId,
        envoi_erreur: null,
        // Compté dans l'activité du dashboard, comme une relance copiée ou ouverte dans Gmail.
        copiee_le: relance.copiee_le ?? sentAt,
      })
      .eq("utilisateur_id", userId)
      .eq("id", relanceId);
    if (saveError) console.error("[envoi] e-mail envoyé mais statut non enregistré", { code: saveError.code });

    // L'e-mail est réellement parti : le dossier passe en « Relancé » s'il était à traiter.
    if (prospect.statut === "a_traiter") {
      await supabase.from("prospects").update({ statut: "relance" }).eq("utilisateur_id", userId).eq("id", prospect.id);
    }
    return Response.json({ ok: true, envoyeeLe: sentAt, envoyeeA: recipient });
  } catch (error) {
    const message =
      error instanceof BrevoError ? error.userMessage : t.sending.unexpected;
    if (!(error instanceof BrevoError)) console.error("[envoi] erreur inattendue", error);
    else console.error("[envoi] refus Brevo", { status: error.status, incertain: error.uncertain });
    await supabase
      .from("relances")
      .update({ envoi_statut: "echec", envoi_erreur: message.slice(0, 300) })
      .eq("utilisateur_id", userId)
      .eq("id", relanceId);
    return jsonError(502, message);
  }
}
