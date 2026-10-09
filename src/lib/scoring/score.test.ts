import { describe, expect, it } from "vitest";

import {
  buildScoreContext,
  explainScore,
  freshness,
  recoverableRevenue,
  scoringFactors,
  silenceDays,
  type ScoringInput,
} from "./score";

const TODAY = new Date(Date.UTC(2026, 9, 8)); // 8 octobre 2026
const daysAgo = (days: number) => new Date(TODAY.getTime() - days * 86_400_000).toISOString().slice(0, 10);

describe("formule (identique à la fonction SQL recalculer_prospects_de)", () => {
  it("compte les jours de silence comme current_date - date", () => {
    expect(silenceDays("2026-09-04", TODAY)).toBe(34);
    expect(silenceDays("2026-10-08", TODAY)).toBe(0);
    expect(silenceDays("2026-10-20", TODAY)).toBe(0);
  });

  it("applique la décote d'ancienneté avec un plancher à 0,2", () => {
    expect(freshness(0)).toBe(1);
    expect(freshness(90)).toBe(0.5);
    expect(freshness(170)).toBe(0.2);
    expect(freshness(400)).toBe(0.2);
  });

  // Mêmes cas que supabase/tests/rls.test.mjs (vérifiés sur Postgres).
  it.each([
    ["proposition à 34 j", { montant_eur: 15000, etape: "proposition", date_dernier_contact: daysAgo(34) }, null, 4866.67],
    ["montant absent → panier moyen", { montant_eur: null, etape: "negociation", date_dernier_contact: daysAgo(30) }, 8000, 4000],
    ["étape inconnue → poids 0,20", { montant_eur: 10000, etape: null, date_dernier_contact: daysAgo(40) }, null, 1555.56],
  ] as const)("%s", (_label, input, basket, expected) => {
    const factors = scoringFactors(input as ScoringInput, basket, TODAY);
    expect(factors).not.toBeNull();
    expect(Math.round(recoverableRevenue(factors!) * 100) / 100).toBe(expected);
  });

  it("ne chiffre ni les affaires fermées, ni celles sans date, ni sans montant ni panier", () => {
    expect(scoringFactors({ montant_eur: 50000, etape: "gagne", date_dernier_contact: daysAgo(10) }, null, TODAY)).toBeNull();
    expect(scoringFactors({ montant_eur: 9000, etape: "proposition", date_dernier_contact: null }, null, TODAY)).toBeNull();
    expect(scoringFactors({ montant_eur: null, etape: "proposition", date_dernier_contact: daysAgo(10) }, null, TODAY)).toBeNull();
  });
});

describe("explainScore", () => {
  const account = [
    { entreprise: "Nordwind GmbH", montant_eur: 41700, etape: "negociation", date_dernier_contact: daysAgo(26) },
    { entreprise: "Atelier Lumen", montant_eur: 31900, etape: "proposition", date_dernier_contact: daysAgo(41) },
    { entreprise: "Acme SAS", montant_eur: 15000, etape: "proposition", date_dernier_contact: daysAgo(34) },
    { entreprise: "Brio Logistique", montant_eur: 20500, etape: "qualification", date_dernier_contact: daysAgo(22) },
    { entreprise: "Opaline Studio", montant_eur: 6000, etape: "decouverte", date_dernier_contact: daysAgo(160) },
    { entreprise: "Solenne Bio", montant_eur: 12000, etape: "gagne", date_dernier_contact: daysAgo(90) },
  ] satisfies (ScoringInput & { entreprise: string })[];
  const context = buildScoreContext(account, 8000, TODAY);

  it("prend la meilleure affaire ouverte comme référence 100 (les affaires gagnées sont ignorées)", () => {
    expect(context.best?.entreprise).toBe("Nordwind GmbH");
    expect(context.scoredCount).toBe(5);
    const nordwind = explainScore(account[0], context, TODAY);
    expect(nordwind.kind === "scored" && nordwind.score).toBe(100);
    expect(nordwind.kind === "scored" && nordwind.isBest).toBe(true);
  });

  it("retrouve le score SQL : round(100 × CA / CA max)", () => {
    const acme = explainScore(account[2], context, TODAY);
    const expected = Math.round((100 * (15000 * 0.4 * (1 - 34 / 180))) / (41700 * 0.6 * (1 - 26 / 180)));
    expect(acme.kind === "scored" && acme.score).toBe(expected);
  });

  it("additionne exactement : point de départ + points des facteurs = score, pour chaque prospect", () => {
    for (const prospect of account.slice(0, 5)) {
      const explanation = explainScore(prospect, context, TODAY);
      expect(explanation.kind).toBe("scored");
      if (explanation.kind !== "scored") continue;
      const sum = explanation.base + explanation.factors.reduce((total, factor) => total + factor.points, 0);
      expect(sum).toBe(explanation.score);
      expect(explanation.factors).toHaveLength(3);
    }
  });

  it("classe les facteurs par influence et donne le bon signe à chacun", () => {
    const nordwind = explainScore(account[0], context, TODAY);
    if (nordwind.kind !== "scored") throw new Error("score attendu");
    const points = nordwind.factors.map((factor) => Math.abs(factor.points));
    expect(points).toEqual([...points].sort((a, b) => b - a));
    // Montant et étape bien au-dessus de la moyenne du compte : contributions positives.
    expect(nordwind.factors.find((factor) => factor.key === "montant")!.points).toBeGreaterThan(0);
    expect(nordwind.factors.find((factor) => factor.key === "etape")!.points).toBeGreaterThan(0);

    const opaline = explainScore(account[4], context, TODAY);
    if (opaline.kind !== "scored") throw new Error("score attendu");
    // 160 jours de silence, découverte, petit montant : tout tire vers le bas.
    expect(opaline.factors.every((factor) => factor.points <= 0)).toBe(true);
    expect(opaline.factors.find((factor) => factor.key === "silence")!.label).toBe("160 jours sans contact");

    // Silence plus court que la moyenne : présenté comme un contact récent, pas comme un silence qui rapporte.
    const nordwindSilence = nordwind.factors.find((factor) => factor.key === "silence")!;
    expect(nordwindSilence.points).toBeGreaterThan(0);
    expect(nordwindSilence.label).toBe("Contact récent : 26 jours");

    // Libellés courts des cartes « Pourquoi prioritaire ? » : alignés sur le signe des points.
    expect(nordwind.factors.map((factor) => factor.shortLabel)).toEqual(
      nordwind.factors.map((factor) =>
        factor.key === "montant" ? "montant élevé" : factor.key === "etape" ? "affaire avancée" : "contact encore récent"
      )
    );
    expect(opaline.factors.find((factor) => factor.key === "silence")!.shortLabel).toBe("sans nouvelles depuis 160 j");
    expect(opaline.factors.find((factor) => factor.key === "montant")!.shortLabel).toBe("montant modeste");
  });

  it("explique en clair le montant estimé et l'étape inconnue", () => {
    const estimated = explainScore({ montant_eur: null, etape: null, date_dernier_contact: daysAgo(30) }, context, TODAY);
    if (estimated.kind !== "scored") throw new Error("score attendu");
    // Intl insère des espaces insécables fines : on les normalise pour comparer.
    expect(estimated.factors.find((factor) => factor.key === "montant")!.label.replace(/\s/g, " ")).toBe("Montant estimé à 8 000 €");
    expect(estimated.factors.find((factor) => factor.key === "etape")!.label).toBe("Étape non reconnue");
  });

  it("produit un résumé lisible", () => {
    const nordwind = explainScore(account[0], context, TODAY);
    expect(nordwind.kind === "scored" && nordwind.summary).toMatch(/^Votre opportunité la plus rentable grâce à .+ récupérables\.$/);
  });

  it("explique l'absence de score", () => {
    expect(explainScore(account[5], context, TODAY)).toEqual({
      kind: "unscored",
      reason: "Affaire gagnée : elle n'a plus d'argent à récupérer.",
    });
    expect(explainScore({ montant_eur: 1000, etape: "proposition", date_dernier_contact: null }, context, TODAY).kind).toBe("unscored");
  });
});
