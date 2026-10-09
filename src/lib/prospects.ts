import { Constants, type Enums } from "@/types/database";

// Vocabulaire d'affichage partagé par les écrans. Les valeurs viennent des types énumérés
// de la base (`statut_prospect`, `etape_affaire`, `ton_relance`) : une migration qui les
// modifie fait échouer la compilation tant que les libellés ne sont pas mis à jour.
// Aucun calcul métier ici : le score et le CA récupérable sont calculés ailleurs.

export const PROSPECT_STATUSES = Constants.public.Enums.statut_prospect;

export type ProspectStatus = Enums<"statut_prospect">;

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  a_traiter: "À traiter",
  relance: "Relancé",
  gagne: "Gagné",
  perdu: "Perdu",
  ignore: "Ignoré",
};

export const DEAL_STAGES = Constants.public.Enums.etape_affaire;

export type DealStage = Enums<"etape_affaire">;

export const STAGE_LABELS: Record<DealStage, string> = {
  decouverte: "Découverte",
  qualification: "Qualification",
  proposition: "Proposition",
  negociation: "Négociation",
  gagne: "Gagné",
  perdu: "Perdu",
};

export const FOLLOWUP_TONES = Constants.public.Enums.ton_relance;

export type FollowupTone = Enums<"ton_relance">;

// Libellés affichés : les valeurs en base restent `formel` / `direct` / `chaleureux`.
export const TONE_LABELS: Record<FollowupTone, string> = {
  formel: "Professionnel",
  direct: "Direct",
  chaleureux: "Amical",
};

/** Paliers visuels du score (spéc. UX/UI §3, jauge de score). */
export type ScoreLevel = "fort" | "moyen" | "faible";

export function scoreLevel(score: number): ScoreLevel {
  if (score >= 70) return "fort";
  if (score >= 40) return "moyen";
  return "faible";
}

export function isProspectStatus(value: unknown): value is ProspectStatus {
  return typeof value === "string" && (PROSPECT_STATUSES as readonly string[]).includes(value);
}

/** Au-delà de ce silence, l'ancienneté passe en couleur d'alerte. */
export const LONG_SILENCE_DAYS = 60;
