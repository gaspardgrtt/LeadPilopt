import type { ProspectListItem } from "@/lib/data/prospects";
import { SAMPLE_ROWS } from "@/lib/import/sample";
import type { DealStage } from "@/lib/prospects";
import { recoverableRevenue, scoringFactors } from "@/lib/scoring/score";

// Données des aperçus de l'espace de travail (développement uniquement) : le jeu d'exemple de
// l'onboarding, chiffré avec la même formule que la base (oubli, argent récupérable, score).

const STAGES: Record<string, DealStage> = {
  Découverte: "decouverte",
  Qualifié: "qualification",
  "Proposition envoyée": "proposition",
  Négociation: "negociation",
  Gagné: "gagne",
  Perdu: "perdu",
};

export const SAMPLE_THRESHOLD = 21;
export const SAMPLE_BASKET = 18000;

export function workspaceSample(today: Date = new Date()): ProspectListItem[] {
  const rows = SAMPLE_ROWS.map((row, index) => {
    const date = new Date(today.getTime() - row.joursSansContact * 86_400_000).toISOString().slice(0, 10);
    const etape = STAGES[row.statut] ?? null;
    const input = { montant_eur: row.montant, etape, date_dernier_contact: date };
    const factors = scoringFactors(input, SAMPLE_BASKET, today);
    return {
      id: `exemple-${index + 1}`,
      entreprise: row.entreprise,
      contact_nom: row.contact,
      contact_email: row.email,
      montant_eur: row.montant,
      etape,
      date_dernier_contact: date,
      est_oublie: factors !== null && factors.days > SAMPLE_THRESHOLD,
      score: null as number | null,
      ca_recuperable_eur: factors ? Math.round(recoverableRevenue(factors) * 100) / 100 : null,
      statut: etape === "gagne" ? ("gagne" as const) : etape === "perdu" ? ("perdu" as const) : ("a_traiter" as const),
    };
  });
  const max = Math.max(...rows.map((row) => row.ca_recuperable_eur ?? 0), 1);
  return rows
    .map((row) => ({ ...row, score: row.ca_recuperable_eur === null ? null : Math.round((100 * row.ca_recuperable_eur) / max) }))
    .sort((a, b) => (b.ca_recuperable_eur ?? -1) - (a.ca_recuperable_eur ?? -1));
}
