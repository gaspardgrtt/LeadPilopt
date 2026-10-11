import type { DealStage, ProspectStatus } from "@/lib/prospects";
import { FRESHNESS_FLOOR, FRESHNESS_HORIZON_DAYS, silenceDays, stageWeight } from "@/lib/scoring/score";

// Dossiers à risque : deux règles déterministes, dérivées de la formule du score (aucune donnée
// inventée).
// 1. « Bientôt oubliés » : affaire ouverte, pas encore oubliée, qui dépassera le seuil
//    d'inactivité dans les `windowDays` prochains jours.
// 2. « Ils perdent de la valeur » : affaire oubliée, à traiter, dont la fraîcheur n'a pas encore
//    atteint son plancher. Chaque jour de silence retire montant × poids de l'étape / 180 à
//    l'argent récupérable, jusqu'au plancher (1 − jours / 180 = 0,2, soit 144 jours).

export type RiskInput = {
  id: string;
  entreprise: string | null;
  contact_nom: string | null;
  montant_eur: number | null;
  etape: DealStage | null;
  date_dernier_contact: string | null;
  statut: ProspectStatus;
  ca_recuperable_eur: number | null;
};

export type SoonForgotten<T> = T & { silence: number; daysLeft: number };
export type LosingValue<T> = T & { silence: number; weeklyLoss: number; daysToFloor: number };

export type RiskAnalysis<T> = {
  soonForgotten: SoonForgotten<T>[];
  losingValue: LosingValue<T>[];
  /** Argent récupérable perdu sur 7 jours si aucun de ces dossiers n'est relancé. */
  weeklyLossTotal: number;
};

/** Jour de silence où la fraîcheur atteint son plancher (144 avec les réglages V1). */
export const FLOOR_DAY = Math.round(FRESHNESS_HORIZON_DAYS * (1 - FRESHNESS_FLOOR));

const OPEN_STATUSES: ProspectStatus[] = ["a_traiter", "relance"];

export function analyzeRisk<T extends RiskInput>(
  rows: T[],
  options: { threshold: number; averageBasket: number | null; today?: Date; windowDays?: number }
): RiskAnalysis<T> {
  const today = options.today ?? new Date();
  const windowDays = options.windowDays ?? 7;
  const soonForgotten: SoonForgotten<T>[] = [];
  const losingValue: LosingValue<T>[] = [];

  for (const row of rows) {
    const weight = stageWeight(row.etape);
    if (weight === null || !row.date_dernier_contact) continue; // affaire gagnée/perdue ou sans date
    const silence = silenceDays(row.date_dernier_contact, today);

    if (silence <= options.threshold) {
      // Oublié le jour où le silence dépasse le seuil.
      const daysLeft = options.threshold - silence + 1;
      if (daysLeft <= windowDays && OPEN_STATUSES.includes(row.statut)) soonForgotten.push({ ...row, silence, daysLeft });
      continue;
    }

    if (row.statut !== "a_traiter" || silence >= FLOOR_DAY) continue;
    const amount = row.montant_eur ?? options.averageBasket;
    if (amount === null || amount <= 0) continue;
    const lossDays = Math.min(7, FLOOR_DAY - silence);
    const weeklyLoss = Math.round((amount * weight * lossDays) / FRESHNESS_HORIZON_DAYS);
    if (weeklyLoss > 0) losingValue.push({ ...row, silence, weeklyLoss, daysToFloor: FLOOR_DAY - silence });
  }

  soonForgotten.sort((a, b) => a.daysLeft - b.daysLeft || (b.ca_recuperable_eur ?? 0) - (a.ca_recuperable_eur ?? 0));
  losingValue.sort((a, b) => b.weeklyLoss - a.weeklyLoss);

  return {
    soonForgotten,
    losingValue,
    weeklyLossTotal: losingValue.reduce((sum, row) => sum + row.weeklyLoss, 0),
  };
}
