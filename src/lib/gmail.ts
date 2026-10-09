// Ouverture d'un nouveau message Gmail pré-rempli, sans OAuth ni API : Gmail accepte une URL de
// rédaction (`view=cm`) qui s'ouvre dans le compte déjà connecté du navigateur. Si personne n'est
// connecté, Google affiche sa page de connexion puis le brouillon.

const GMAIL_COMPOSE_BASE = "https://mail.google.com/mail/";

/**
 * Au-delà de cette longueur, certains navigateurs et proxys tronquent l'URL : on n'y place alors
 * que le destinataire et l'objet, et l'appelant invite à coller le message copié.
 */
export const GMAIL_URL_MAX_LENGTH = 7500;

type GmailDraft = { to: string | null; subject: string; body: string };

function encode(value: string) {
  // encodeURIComponent (espaces en %20, sauts de ligne en %0A) : Gmail ne lit pas « + » comme un espace.
  return encodeURIComponent(value.replace(/\r\n?/g, "\n"));
}

export function buildGmailComposeUrl({ to, subject, body }: GmailDraft): { url: string; bodyIncluded: boolean } {
  const base = [`view=cm`, `fs=1`];
  if (to) base.push(`to=${encode(to)}`);
  base.push(`su=${encode(subject)}`);

  const withBody = `${GMAIL_COMPOSE_BASE}?${[...base, `body=${encode(body)}`].join("&")}`;
  if (withBody.length <= GMAIL_URL_MAX_LENGTH) return { url: withBody, bodyIncluded: true };
  return { url: `${GMAIL_COMPOSE_BASE}?${base.join("&")}`, bodyIncluded: false };
}
