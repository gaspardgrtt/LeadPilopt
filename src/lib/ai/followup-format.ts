// Mise en forme du texte généré, partagée par le serveur (enregistrement) et le navigateur
// (affichage pendant le streaming).

import type { FollowupTone } from "@/lib/prospects";

/** Événements diffusés par POST /api/relances/generer (une ligne JSON par événement). */
export type FollowupStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; relance: { id: string; objet: string; corps: string; ton: FollowupTone } }
  | { type: "error"; message: string };

/** Sépare « Objet : … » du corps ; tolère un modèle qui omettrait la ligne d'objet. */
export function parseFollowupText(text: string, fallbackSubject: string) {
  const trimmed = text.replace(/^\s+/, "");
  const match = trimmed.match(/^objet\s*:\s*(.+)\n?/i);
  if (!match) return { objet: fallbackSubject, corps: trimmed.trim() };
  return { objet: match[1].trim().slice(0, 300), corps: trimmed.slice(match[0].length).trim() };
}

/** Corps final : texte généré + signature du compte (ajoutée telle quelle, jamais réécrite). */
export function appendSignature(corps: string, signature: string | null) {
  const clean = signature?.trim();
  return clean ? `${corps}\n${clean}` : corps;
}
