// Contenu des relances envoyées par e-mail (Brevo) : validation de l'adresse, de l'objet et du
// corps, version texte et HTML, et mention d'opposition ajoutée à chaque envoi. Fonctions pures,
// partagées par l'aperçu (navigateur) et l'envoi (serveur).

export const SUBJECT_MAX = 300;
export const BODY_MAX = 10000;

/** Mention ajoutée à chaque e-mail : moyen simple de s'opposer à la prospection. */
export const OPPOSITION_NOTICE =
  "Si vous préférez ne plus recevoir nos messages, répondez simplement « STOP » à cet e-mail.";

/** Adresse e-mail plausible (sans espace, une @, domaine avec un point), 254 caractères au plus. */
export function isValidEmail(value: string | null | undefined): value is string {
  if (!value) return false;
  const email = value.trim();
  if (email.length > 254 || /[\s<>()[\]\\,;:"]/.test(email.replace(/@[^@]*$/, ""))) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email) && !/\.\./.test(email);
}

export type EmailContentCheck = { ok: true; subject: string; body: string } | { ok: false; message: string };

/** Objet sur une seule ligne (pas d'injection d'en-tête), corps non vide, longueurs bornées. */
export function checkEmailContent(subject: unknown, body: unknown): EmailContentCheck {
  if (typeof subject !== "string" || typeof body !== "string") return { ok: false, message: "Objet ou message manquant." };
  const cleanSubject = subject.trim();
  const cleanBody = body.trim();
  if (!cleanSubject) return { ok: false, message: "Ajoutez un objet avant d'envoyer." };
  if (/[\r\n]/.test(cleanSubject)) return { ok: false, message: "L'objet doit tenir sur une seule ligne." };
  if (cleanSubject.length > SUBJECT_MAX) return { ok: false, message: `L'objet dépasse ${SUBJECT_MAX} caractères.` };
  if (!cleanBody) return { ok: false, message: "Le message est vide." };
  if (cleanBody.length > BODY_MAX) return { ok: false, message: `Le message dépasse ${BODY_MAX} caractères.` };
  return { ok: true, subject: cleanSubject, body: cleanBody };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Versions texte et HTML du message, mention d'opposition comprise. Le HTML est entièrement échappé. */
export function buildEmailContent(body: string): { text: string; html: string } {
  const text = `${body.trim()}\n\n--\n${OPPOSITION_NOTICE}`;
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 14px">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html =
    `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2433">` +
    paragraphs +
    `<p style="margin:28px 0 0;padding-top:12px;border-top:1px solid #e3e6ee;font-size:12px;color:#6b7489">${escapeHtml(OPPOSITION_NOTICE)}</p>` +
    `</body></html>`;
  return { text, html };
}
