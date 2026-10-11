import { prospectTitle, type DealStage } from "@/lib/prospects";
import { formatEuro } from "@/lib/format";
import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";

// « Pourquoi ce score ? » : explication exacte du score de priorité.
//
// Le calcul reproduit la fonction SQL `recalculer_prospects_de`
// (supabase/migrations/20261008190000_import_et_calcul.sql). Toute modification de la formule doit
// être faite aux deux endroits ; les tests de score.test.ts reprennent les valeurs vérifiées par
// supabase/tests/rls.test.mjs.
//
//   CA récupérable = montant (ou panier moyen) × poids de l'étape × fraîcheur
//   fraîcheur      = max(0,2 ; 1 − jours sans contact / 180)
//   score          = 100 × CA récupérable / CA récupérable de la meilleure affaire ouverte
//
// Le score est un produit : on l'explique en points additifs par les valeurs de Shapley (méthode de
// référence pour attribuer le résultat d'un modèle à ses facteurs). Point de départ : le score d'un
// prospect « moyen » du compte (montant, étape et fraîcheur moyens) ; chaque facteur ajoute ou
// retire des points selon qu'il fait mieux ou moins bien que cette moyenne. La somme est exacte.

export const STAGE_WEIGHTS: Record<Exclude<DealStage, "gagne" | "perdu">, number> = {
  decouverte: 0.1,
  qualification: 0.2,
  proposition: 0.4,
  negociation: 0.6,
};
/** Étape inconnue ou non reconnue à l'import : poids de la qualification. */
export const UNKNOWN_STAGE_WEIGHT = 0.2;
export const FRESHNESS_HORIZON_DAYS = 180;
export const FRESHNESS_FLOOR = 0.2;

export type ScoringInput = {
  montant_eur: number | null;
  etape: DealStage | null;
  date_dernier_contact: string | null;
};

const MS_PER_DAY = 86_400_000;

/** Jours entiers entre la date de dernier contact et `today` (comme `current_date - date` en SQL). */
export function silenceDays(date: string, today: Date): number {
  const contact = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((now - contact) / MS_PER_DAY));
}

export function stageWeight(etape: DealStage | null): number | null {
  if (etape === "gagne" || etape === "perdu") return null;
  return etape ? STAGE_WEIGHTS[etape] : UNKNOWN_STAGE_WEIGHT;
}

export function freshness(days: number): number {
  return Math.max(FRESHNESS_FLOOR, 1 - days / FRESHNESS_HORIZON_DAYS);
}

type Factors = { amount: number; weight: number; freshness: number; days: number; amountEstimated: boolean };

/** Facteurs du calcul, ou null si l'affaire n'est pas chiffrable (fermée, sans date, sans montant). */
export function scoringFactors(input: ScoringInput, averageBasket: number | null, today: Date): Factors | null {
  const weight = stageWeight(input.etape);
  if (weight === null || !input.date_dernier_contact) return null;
  const amount = input.montant_eur ?? averageBasket;
  if (amount === null) return null;
  const days = silenceDays(input.date_dernier_contact, today);
  return { amount, weight, freshness: freshness(days), days, amountEstimated: input.montant_eur === null };
}

export function recoverableRevenue(f: Factors): number {
  return f.amount * f.weight * f.freshness;
}

export type ScoreContext = {
  /** CA récupérable de la meilleure affaire ouverte (référence du score 100). */
  maxRecoverable: number;
  best: { entreprise: string; recoverable: number } | null;
  /** Prospect « moyen » du compte : point de départ de l'explication. */
  average: { amount: number; weight: number; freshness: number };
  averageBasket: number | null;
  scoredCount: number;
};

/** Contexte du compte, à partir de toutes ses affaires (les affaires fermées sont ignorées). */
export function buildScoreContext(
  prospects: (ScoringInput & { entreprise: string | null; contact_nom?: string | null })[],
  averageBasket: number | null,
  today: Date = new Date()
): ScoreContext {
  let max = 0;
  let best: ScoreContext["best"] = null;
  const sums = { amount: 0, weight: 0, freshness: 0 };
  let count = 0;

  for (const prospect of prospects) {
    const f = scoringFactors(prospect, averageBasket, today);
    if (!f) continue;
    const ca = recoverableRevenue(f);
    if (ca > max) {
      max = ca;
      best = { entreprise: prospectTitle({ entreprise: prospect.entreprise, contact_nom: prospect.contact_nom ?? null }), recoverable: ca };
    }
    sums.amount += f.amount;
    sums.weight += f.weight;
    sums.freshness += f.freshness;
    count += 1;
  }

  return {
    maxRecoverable: max,
    best,
    average: count
      ? { amount: sums.amount / count, weight: sums.weight / count, freshness: sums.freshness / count }
      : { amount: 0, weight: 0, freshness: 0 },
    averageBasket,
    scoredCount: count,
  };
}

export type ScoreFactorKey = "montant" | "etape" | "silence";

export type ScoreFactor = {
  key: ScoreFactorKey;
  /** Points apportés (positifs) ou retirés (négatifs), entiers ; base + Σ points = score. */
  points: number;
  label: string;
  /** Libellé court pour les cartes « Pourquoi prioritaire ? », toujours cohérent avec le signe. */
  shortLabel: string;
  detail: string;
};

export type ScoreExplanation =
  | {
      kind: "scored";
      score: number;
      recoverable: number;
      base: number;
      factors: ScoreFactor[];
      summary: string;
      best: ScoreContext["best"];
      isBest: boolean;
    }
  | { kind: "unscored"; reason: string };

// Pourcentages selon la langue : « 60 % » / « 60% ».
const percentFor = (locale: Langue) => (value: number) => `${Math.round(value * 100)}${locale === "en" ? "%" : "\u00a0%"}`;

/** Valeurs de Shapley (3 facteurs) d'un score multiplicatif, relativement à un prospect moyen. */
function shapley(actual: [number, number, number], baseline: [number, number, number], scale: number) {
  const value = (mask: number) =>
    scale * [0, 1, 2].reduce((product, i) => product * (mask & (1 << i) ? actual[i] : baseline[i]), 1);
  // Poids des coalitions pour 3 joueurs : |S| = 0 → 1/3, |S| = 1 → 1/6, |S| = 2 → 1/3.
  const coalitionWeight = [1 / 3, 1 / 6, 1 / 3];
  return [0, 1, 2].map((i) => {
    let phi = 0;
    for (let mask = 0; mask < 8; mask++) {
      if (mask & (1 << i)) continue;
      const size = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1);
      phi += coalitionWeight[size] * (value(mask | (1 << i)) - value(mask));
    }
    return phi;
  });
}

/** Arrondit des contributions pour que base + Σ points = score affiché, au point près. */
function roundToTotal(base: number, contributions: number[], total: number) {
  const roundedBase = Math.round(base);
  const rounded = contributions.map(Math.round);
  const residual = total - roundedBase - rounded.reduce((sum, value) => sum + value, 0);
  if (residual !== 0) {
    const largest = contributions.reduce((best, value, index) => (Math.abs(value) > Math.abs(contributions[best]) ? index : best), 0);
    rounded[largest] += residual;
  }
  return { base: roundedBase, points: rounded };
}

export function explainScore(
  prospect: ScoringInput,
  context: ScoreContext,
  today: Date = new Date(),
  locale: Langue = "fr"
): ScoreExplanation {
  const t = getMessages(locale).score;
  const euro = { format: (value: number) => formatEuro(value, locale) };
  const percent = percentFor(locale);
  if (prospect.etape === "gagne" || prospect.etape === "perdu") {
    return { kind: "unscored", reason: t.closed(t.stageText[prospect.etape]) };
  }
  if (!prospect.date_dernier_contact) {
    return { kind: "unscored", reason: t.noDate };
  }
  const f = scoringFactors(prospect, context.averageBasket, today);
  if (!f) {
    return { kind: "unscored", reason: t.noAmount };
  }
  if (context.maxRecoverable <= 0) {
    return { kind: "unscored", reason: t.noReference };
  }

  const recoverable = recoverableRevenue(f);
  const scale = 100 / context.maxRecoverable;
  const exactScore = recoverable * scale;
  const score = Math.round(exactScore);
  const avg = context.average;
  const base = scale * avg.amount * avg.weight * avg.freshness;
  const contributions = shapley([f.amount, f.weight, f.freshness], [avg.amount, avg.weight, avg.freshness], scale);
  const rounded = roundToTotal(base, contributions, score);

  const stageLabel = prospect.etape ? t.stageLabel(t.stageText[prospect.etape]) : t.unknownStage;
  const unsorted: Omit<ScoreFactor, "shortLabel">[] = [
    {
      key: "montant",
      points: rounded.points[0],
      label: f.amountEstimated ? t.amountEstimated(euro.format(f.amount)) : t.amount(euro.format(f.amount)),
      detail: f.amountEstimated
        ? t.amountEstimatedDetail(euro.format(avg.amount))
        : t.amountDetail(euro.format(avg.amount)),
    },
    {
      key: "etape",
      points: rounded.points[1],
      label: stageLabel,
      detail: t.stageDetail(percent(f.weight), percent(avg.weight)),
    },
    {
      key: "silence",
      points: rounded.points[2],
      // Un silence plus court que la moyenne rapporte des points : on le dit « contact récent ».
      label:
        rounded.points[2] > 0 ? t.recentContact(f.days) : t.silentDays(f.days),
      detail:
        f.freshness <= FRESHNESS_FLOOR
          ? t.silenceFloorDetail(percent(1 - FRESHNESS_FLOOR))
          : t.silenceDetail(percent(1 - f.freshness), percent(1 - avg.freshness)),
    },
  ];
  const factors = unsorted
    .map((factor) => ({ ...factor, shortLabel: shortLabel(factor.key, factor.points, f.days, t) }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    kind: "scored",
    score,
    recoverable,
    base: rounded.base,
    factors,
    summary: summarize(factors, recoverable, score, t, euro.format),
    best: context.best,
    isBest: score >= 100,
  };
}

type ScoreTexts = ReturnType<typeof getMessages>["score"];

function shortLabel(key: ScoreFactorKey, points: number, days: number, t: ScoreTexts): string {
  if (key === "montant") return points > 0 ? t.short.amountHigh : points < 0 ? t.short.amountLow : t.short.amountAverage;
  if (key === "etape") return points > 0 ? t.short.stageHigh : points < 0 ? t.short.stageLow : t.short.stageAverage;
  return points > 0 ? t.short.recent : points < 0 ? t.short.silent(days) : t.short.silenceAverage;
}

function summarize(factors: ScoreFactor[], recoverable: number, score: number, t: ScoreTexts, euro: (value: number) => string): string {
  const positive = factors.filter((factor) => factor.points > 0);
  const negative = factors.filter((factor) => factor.points < 0);
  const head = score >= 100 ? t.head.best : score >= 65 ? t.head.high : score >= 40 ? t.head.medium : t.head.low;
  const why = positive.length ? t.thanksTo(positive.map((factor) => t.noun[factor.key]).slice(0, 2).join(t.and)) : "";
  const but = negative.length ? t.heldBack(t.penalty[negative[0].key]) : "";
  return t.summary(`${head}${why}${but}`, euro(recoverable));
}
