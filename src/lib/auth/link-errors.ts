// Échecs du lien de connexion : chaque cause a son propre message, pour que l'utilisateur sache
// quoi faire et que les journaux serveur indiquent la cause exacte (code d'erreur Supabase).
// Les textes sont dans les dictionnaires (t.auth.linkErrors).

import { getMessages } from "@/i18n";
import type { Langue } from "@/lib/preferences/preferences";

export const LINK_ERRORS = ["lien-expire", "autre-navigateur", "ancienne-demande", "lien-invalide"] as const;

export type LinkError = (typeof LINK_ERRORS)[number];

/** Paramètre `?erreur=` de /connexion → message (langue de l'interface), ou null s'il est absent ou inconnu. */
export function linkErrorMessage(value: string | null | undefined, locale: Langue = "fr"): string | null {
  return value && (LINK_ERRORS as readonly string[]).includes(value) ? getMessages(locale).auth.linkErrors[value as LinkError] : null;
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
