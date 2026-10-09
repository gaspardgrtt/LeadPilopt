import { describe, expect, it } from "vitest";

import { buildMorningBrief, type BriefInput } from "./brief";

const normalize = (text: string) => text.replace(/\s/g, " ");

const base: BriefInput = {
  recoverable: 63623,
  toFollowUp: 8,
  recovered: 12000,
  commissionRate: null,
  priority: { id: "p1", entreprise: "Nordwind GmbH", recoverable: 21406, etape: "negociation", silenceDays: 26 },
  progress: { done: 3, total: 8 },
};

describe("buildMorningBrief", () => {
  it("recommande une action concrète sur le dossier prioritaire, avec ses vraies raisons", () => {
    const brief = buildMorningBrief(base);
    expect(brief.state).toBe("action");
    expect(normalize(brief.action!.sentence)).toBe(
      "Relancez Nordwind GmbH aujourd'hui : affaire en négociation, sans nouvelles depuis 26 jours, 21 406 € en jeu."
    );
    expect(brief.action!.cta).toBe("Préparer la relance de Nordwind GmbH");
    expect(brief.action!.href).toBe("/prospects/p1");
    expect(brief.toFollowUpLabel).toBe("opportunités à relancer");
  });

  it("n'affiche la commission potentielle que si le taux est renseigné", () => {
    expect(buildMorningBrief(base).commission).toBeNull();
    expect(buildMorningBrief({ ...base, commissionRate: 4 }).commission).toBe(2545);
    expect(buildMorningBrief({ ...base, commissionRate: 0 }).commission).toBeNull();
  });

  it("suit la progression du jour", () => {
    expect(buildMorningBrief(base).progress).toEqual({ done: 3, total: 8, label: "3 / 8 relances préparées aujourd'hui" });
    expect(buildMorningBrief({ ...base, progress: { done: 1, total: 1 } }).progress!.label).toBe(
      "Toutes les relances du jour sont préparées"
    );
    expect(buildMorningBrief({ ...base, progress: { done: 0, total: 0 } }).progress).toBeNull();
  });

  it("félicite quand tout est relancé, et reste sobre quand il n'y a rien à faire", () => {
    const done = buildMorningBrief({ ...base, toFollowUp: 0, priority: null, progress: { done: 8, total: 8 } });
    expect(done.state).toBe("all_done");
    expect(done.action).toBeNull();
    const nothing = buildMorningBrief({ ...base, toFollowUp: 0, priority: null, progress: { done: 0, total: 0 } });
    expect(nothing.state).toBe("nothing_to_do");
  });

  it("accorde au singulier et gère les données manquantes", () => {
    const brief = buildMorningBrief({
      ...base,
      toFollowUp: 1,
      priority: { id: "p2", entreprise: "Acme SAS", recoverable: 4867, etape: null, silenceDays: 1 },
    });
    expect(brief.toFollowUpLabel).toBe("opportunité à relancer");
    expect(normalize(brief.action!.sentence)).toBe(
      "Relancez Acme SAS aujourd'hui : affaire en cours, sans nouvelles depuis 1 jour, 4 867 € en jeu."
    );
  });
});
