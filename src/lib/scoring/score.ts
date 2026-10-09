import type { DealStage } from "@/lib/prospects";

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
  prospects: (ScoringInput & { entreprise: string })[],
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
      best = { entreprise: prospect.entreprise, recoverable: ca };
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

const STAGE_TEXT: Record<DealStage, string> = {
  decouverte: "en découverte",
  qualification: "en qualification",
  proposition: "au stade proposition",
  negociation: "en négociation",
  gagne: "gagnée",
  perdu: "perdue",
};

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const percent = (value: number) => `${Math.round(value * 100)} %`;

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

export function explainScore(prospect: ScoringInput, context: ScoreContext, today: Date = new Date()): ScoreExplanation {
  if (prospect.etape === "gagne" || prospect.etape === "perdu") {
    return { kind: "unscored", reason: `Affaire ${STAGE_TEXT[prospect.etape]} : elle n'a plus d'argent à récupérer.` };
  }
  if (!prospect.date_dernier_contact) {
    return { kind: "unscored", reason: "Date du dernier contact inconnue : impossible de mesurer le silence." };
  }
  const f = scoringFactors(prospect, context.averageBasket, today);
  if (!f) {
    return { kind: "unscored", reason: "Montant inconnu et aucun panier moyen défini dans les réglages." };
  }
  if (context.maxRecoverable <= 0) {
    return { kind: "unscored", reason: "Aucune affaire chiffrable dans votre compte pour servir de référence." };
  }

  const recoverable = recoverableRevenue(f);
  const scale = 100 / context.maxRecoverable;
  const exactScore = recoverable * scale;
  const score = Math.round(exactScore);
  const avg = context.average;
  const base = scale * avg.amount * avg.weight * avg.freshness;
  const contributions = shapley([f.amount, f.weight, f.freshness], [avg.amount, avg.weight, avg.freshness], scale);
  const rounded = roundToTotal(base, contributions, score);

  const stageLabel = prospect.etape ? `Affaire ${STAGE_TEXT[prospect.etape]}` : "Étape non reconnue";
  const unsorted: Omit<ScoreFactor, "shortLabel">[] = [
    {
      key: "montant",
      points: rounded.points[0],
      label: f.amountEstimated ? `Montant estimé à ${euro.format(f.amount)}` : `Montant de ${euro.format(f.amount)}`,
      detail: f.amountEstimated
        ? `Montant absent : panier moyen utilisé · moyenne du compte ${euro.format(avg.amount)}`
        : `Moyenne de vos dossiers en cours : ${euro.format(avg.amount)}`,
    },
    {
      key: "etape",
      points: rounded.points[1],
      label: stageLabel,
      detail: `Probabilité de base ${percent(f.weight)} · moyenne du compte ${percent(avg.weight)}`,
    },
    {
      key: "silence",
      points: rounded.points[2],
      // Un silence plus court que la moyenne rapporte des points : on le dit « contact récent ».
      label:
        rounded.points[2] > 0
          ? `Contact récent : ${f.days} jour${f.days > 1 ? "s" : ""}`
          : `${f.days} jour${f.days > 1 ? "s" : ""} sans contact`,
      detail:
        f.freshness <= FRESHNESS_FLOOR
          ? `Silence très long : décote maximale de ${percent(1 - FRESHNESS_FLOOR)}`
          : `Décote de ${percent(1 - f.freshness)} liée au silence · moyenne du compte ${percent(1 - avg.freshness)}`,
    },
  ];
  const factors = unsorted
    .map((factor) => ({ ...factor, shortLabel: shortLabel(factor.key, factor.points, f.days) }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));

  return {
    kind: "scored",
    score,
    recoverable,
    base: rounded.base,
    factors,
    summary: summarize(factors, recoverable, context, score),
    best: context.best,
    isBest: score >= 100,
  };
}

function shortLabel(key: ScoreFactorKey, points: number, days: number): string {
  if (key === "montant") return points > 0 ? "montant élevé" : points < 0 ? "montant modeste" : "montant dans la moyenne";
  if (key === "etape") return points > 0 ? "affaire avancée" : points < 0 ? "étape peu avancée" : "étape dans la moyenne";
  return points > 0 ? "contact encore récent" : points < 0 ? `sans nouvelles depuis ${days} j` : "silence dans la moyenne";
}

const FACTOR_NOUN: Record<ScoreFactorKey, string> = {
  montant: "son montant",
  etape: "l'avancement de l'affaire",
  silence: "un contact encore récent",
};

const FACTOR_PENALTY: Record<ScoreFactorKey, string> = {
  montant: "un montant modeste",
  etape: "une affaire peu avancée",
  silence: "un silence prolongé",
};

function summarize(factors: ScoreFactor[], recoverable: number, context: ScoreContext, score: number): string {
  const positive = factors.filter((factor) => factor.points > 0);
  const negative = factors.filter((factor) => factor.points < 0);
  const head =
    score >= 100
      ? "Votre opportunité la plus rentable"
      : score >= 65
        ? "Prospect prioritaire"
        : score >= 40
          ? "Prospect à potentiel moyen"
          : "Prospect secondaire";
  const why = positive.length
    ? ` grâce à ${positive.map((factor) => FACTOR_NOUN[factor.key]).slice(0, 2).join(" et ")}`
    : "";
  const but = negative.length ? `, freiné par ${FACTOR_PENALTY[negative[0].key]}` : "";
  return `${head}${why}${but} : ${euro.format(recoverable)} récupérables.`;
}
