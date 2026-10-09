import { describe, expect, it } from "vitest";

import { analyzeRisk, FLOOR_DAY, type RiskInput } from "./risk";

const today = new Date(Date.UTC(2026, 9, 9));
const daysAgo = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);

const row = (id: string, overrides: Partial<RiskInput>): RiskInput => ({
  id,
  entreprise: id,
  contact_nom: null,
  montant_eur: 18000,
  etape: "proposition",
  date_dernier_contact: daysAgo(10),
  statut: "a_traiter",
  ca_recuperable_eur: 1000,
  ...overrides,
});

describe("analyzeRisk", () => {
  const options = { threshold: 21, averageBasket: 9000, today };

  it("repère les dossiers qui seront oubliés dans les 7 prochains jours", () => {
    const result = analyzeRisk(
      [
        row("demain", { date_dernier_contact: daysAgo(21) }),
        row("dans7", { date_dernier_contact: daysAgo(15) }),
        row("dans8", { date_dernier_contact: daysAgo(14) }),
        row("gagne", { etape: "gagne", date_dernier_contact: daysAgo(20) }),
        row("ignore", { statut: "ignore", date_dernier_contact: daysAgo(20) }),
      ],
      options
    );
    expect(result.soonForgotten.map((r) => [r.id, r.daysLeft])).toEqual([
      ["demain", 1],
      ["dans7", 7],
    ]);
  });

  it("chiffre la perte hebdomadaire avec la formule du score, jusqu'au plancher", () => {
    const result = analyzeRisk(
      [
        // 18 000 € × 0,40 × 7 / 180 = 280 €
        row("plein", { date_dernier_contact: daysAgo(40) }),
        // 3 jours avant le plancher : 18 000 × 0,40 × 3 / 180 = 120 €
        row("presque", { date_dernier_contact: daysAgo(FLOOR_DAY - 3) }),
        row("plancher", { date_dernier_contact: daysAgo(FLOOR_DAY) }),
        // Sans montant : panier moyen 9 000 × 0,60 × 7 / 180 = 210 €
        row("panier", { montant_eur: null, etape: "negociation", date_dernier_contact: daysAgo(30) }),
        row("deja-relance", { statut: "relance", date_dernier_contact: daysAgo(40) }),
      ],
      options
    );
    expect(result.losingValue.map((r) => [r.id, r.weeklyLoss])).toEqual([
      ["plein", 280],
      ["panier", 210],
      ["presque", 120],
    ]);
    expect(result.weeklyLossTotal).toBe(610);
    expect(FLOOR_DAY).toBe(144);
  });

  it("ignore les dossiers sans date de contact", () => {
    expect(analyzeRisk([row("x", { date_dernier_contact: null })], options)).toEqual({
      soonForgotten: [],
      losingValue: [],
      weeklyLossTotal: 0,
    });
  });
});
