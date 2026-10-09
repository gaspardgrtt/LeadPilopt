// Échecs du lien de connexion : chaque cause a son propre message, pour que l'utilisateur sache
// quoi faire et que les journaux serveur indiquent la cause exacte (code d'erreur Supabase).

export const LINK_ERRORS = ["lien-expire", "autre-navigateur", "ancienne-demande", "lien-invalide"] as const;

export type LinkError = (typeof LINK_ERRORS)[number];

export const LINK_ERROR_MESSAGES: Record<LinkError, string> = {
  "lien-expire":
    "Ce lien a expiré ou a déjà été utilisé (parfois par l'antivirus de votre messagerie). Demandez-en un nouveau ci-dessous.",
  "autre-navigateur":
    "Ce lien doit être ouvert dans le navigateur où vous l'avez demandé. Demandez un nouveau lien ici, puis ouvrez-le dans ce même navigateur.",
  "ancienne-demande":
    "Ce lien correspond à une demande plus ancienne. Utilisez le lien du dernier e-mail reçu, ou demandez-en un nouveau ci-dessous.",
  "lien-invalide": "Ce lien de connexion n'est pas valide. Demandez-en un nouveau ci-dessous.",
};

/** Paramètre `?erreur=` de /connexion → message, ou null s'il est absent ou inconnu. */
export function linkErrorMessage(value: string | null | undefined): string | null {
  return value && (LINK_ERRORS as readonly string[]).includes(value) ? LINK_ERROR_MESSAGES[value as LinkError] : null;
}

/** Code d'erreur Supabase (auth-js / GoTrue) → cause présentée à l'utilisateur. */
export function linkErrorFromCode(code: string | null | undefined): LinkError {
  switch (code) {
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
      return "lien-expire";
    case "pkce_code_verifier_not_found":
      return "autre-navigateur";
    case "bad_code_verifier":
      return "ancienne-demande";
    default:
      return "lien-invalide";
  }
}
