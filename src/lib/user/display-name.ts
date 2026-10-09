// Nom affiché de l'utilisateur (barre latérale, salutation du dashboard).
// Le nom saisi (« jean martin ») est mis en forme mot par mot (« Jean Martin », « Jean-Luc »).
// Sans nom, on part de l'adresse email : « claire.martin@… » donne « Claire Martin » ; une adresse
// sans séparateur (« jeanmartin@… ») ne permet pas de séparer prénom et nom, d'où `isFallback`
// pour inviter l'utilisateur à le renseigner.

import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";

const capitalizeWord = (word: string) =>
  word
    .split("-")
    .map((part) => (part ? part[0].toLocaleUpperCase("fr-FR") + part.slice(1).toLocaleLowerCase("fr-FR") : part))
    .join("-");

export function formatPersonName(raw: string): string {
  return raw.trim().split(/\s+/).filter(Boolean).map(capitalizeWord).join(" ");
}

export type DisplayName = { full: string; first: string; isFallback: boolean };

export function displayName(nom: string | null | undefined, email: string | null | undefined, locale: Langue = "fr"): DisplayName {
  const saved = nom?.trim();
  if (saved) {
    const full = formatPersonName(saved);
    return { full, first: full.split(" ")[0], isFallback: false };
  }
  const local = (email ?? "").split("@")[0].replace(/[0-9+]+/g, " ");
  const fromEmail = formatPersonName(local.replace(/[._-]+/g, " "));
  if (!fromEmail) return { full: getMessages(locale).account.fallbackName, first: "", isFallback: true };
  return { full: fromEmail, first: fromEmail.split(" ")[0], isFallback: true };
}
