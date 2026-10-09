import { isLangue, type Langue } from "@/lib/preferences/preferences";

import { en } from "./messages/en";
import { fr } from "./messages/fr";

// Traductions centralisées de l'interface. Les données (entreprises, contacts, notes, relances
// envoyées aux prospects) ne passent jamais par ces dictionnaires.

export type Messages = typeof fr | typeof en;

const DICTIONARIES = { fr, en } as const;

export function getMessages(locale: Langue) {
  return DICTIONARIES[locale] as typeof en;
}

/**
 * Langue d'une requête : cookie de préférence (aligné sur le compte), sinon langue du navigateur
 * (première visite, page de connexion), sinon français.
 */
export function resolveLocale(cookieValue: string | null | undefined, acceptLanguage: string | null | undefined): Langue {
  if (isLangue(cookieValue)) return cookieValue;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return first === "en" ? "en" : "fr";
}

export { fr, en };
