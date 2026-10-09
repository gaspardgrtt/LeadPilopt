import "server-only";

import { isValidEmail } from "@/lib/followups/email";

import { checkBrevoSender, type BrevoConfig, type SenderStatus } from "./client";

// Configuration Brevo, lue uniquement côté serveur dans les variables d'environnement
// BREVO_API_KEY, BREVO_SENDER_EMAIL et BREVO_SENDER_NAME (jamais préfixées NEXT_PUBLIC_).

/** Configuration complète et valide, ou null : l'envoi par e-mail est alors désactivé. */
export function getBrevoConfig(): BrevoConfig | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.replace(/[\r\n]+/g, " ").trim();
  if (!apiKey || !senderEmail || !senderName || !isValidEmail(senderEmail)) return null;
  return { apiKey, senderEmail, senderName: senderName.slice(0, 70) };
}

/** Expéditeur affiché dans l'aperçu (sans la clé). */
export function getBrevoSenderIdentity(): { email: string; name: string } | null {
  const config = getBrevoConfig();
  return config ? { email: config.senderEmail, name: config.senderName } : null;
}

// Vérification de l'expéditeur mise en cache 10 minutes (seulement quand elle réussit) pour ne pas
// interroger Brevo à chaque envoi.
let verifiedUntil = 0;
let verifiedFor = "";

export async function ensureVerifiedSender(config: BrevoConfig): Promise<SenderStatus> {
  if (verifiedFor === config.senderEmail && Date.now() < verifiedUntil) return { ok: true };
  const status = await checkBrevoSender(config);
  if (status.ok) {
    verifiedFor = config.senderEmail;
    verifiedUntil = Date.now() + 10 * 60_000;
  }
  return status;
}
