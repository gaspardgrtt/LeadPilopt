import { describe, expect, it } from "vitest";

import { FOLLOWUP_TONES } from "@/lib/prospects";

import {
  FOLLOWUP_SCENARIOS,
  contactFirstName,
  detectFollowupContext,
  renderFollowup,
  scenarioFromTag,
  scenarioTag,
  type FollowupProspect,
} from "./templates";

const today = new Date(Date.UTC(2026, 9, 9));
const daysAgo = (days: number) => new Date(today.getTime() - days * 86_400_000).toISOString().slice(0, 10);

const nordwind: FollowupProspect = {
  entreprise: "Nordwind GmbH",
  contact_nom: "Jonas Weber",
  etape: "negociation",
  date_dernier_contact: daysAgo(27), // 12 septembre 2026
};

describe("detectFollowupContext", () => {
  it("choisit le scénario d'après l'étape, puis d'après le silence", () => {
    const scenario = (p: Partial<FollowupProspect>) => detectFollowupContext({ ...nordwind, ...p }, today).scenario;
    expect(scenario({})).toBe("decision");
    expect(scenario({ etape: "proposition" })).toBe("suivi_proposition");
    expect(scenario({ etape: "decouverte" })).toBe("suivi_echange");
    expect(scenario({ etape: null })).toBe("suivi_echange");
    expect(scenario({ date_dernier_contact: daysAgo(60) })).toBe("reprise_contact");
    expect(scenario({ date_dernier_contact: daysAgo(120) })).toBe("dernier_message");
    expect(scenario({ date_dernier_contact: null, etape: "proposition" })).toBe("suivi_proposition");
  });

  it("explique son choix avec les données du dossier", () => {
    expect(detectFollowupContext(nordwind, today).reasons).toEqual(["Étape : Négociation", "27 jours sans contact"]);
  });
});

describe("renderFollowup", () => {
  it("personnalise avec le prénom, l'entreprise, la date réelle et la signature", () => {
    const { objet, corps } = renderFollowup(nordwind, "decision", "formel", { signature: "Paul Durand\nAgence Dupont", nom: null }, today);
    expect(objet).toBe("Prochaines étapes · Nordwind GmbH");
    expect(corps.startsWith("Bonjour Jonas,\n\n")).toBe(true);
    expect(corps).toContain("notre discussion du 12 septembre.");
    expect(corps.endsWith("Bien cordialement,\nPaul Durand\nAgence Dupont")).toBe(true);
  });

  it("parle de la proposition seulement quand l'étape l'indique", () => {
    const proposition = renderFollowup({ ...nordwind, etape: "proposition", date_dernier_contact: daysAgo(70) }, "reprise_contact", "direct", null, today);
    expect(proposition.corps).toContain("au sujet de notre proposition");
    const decouverte = renderFollowup({ ...nordwind, etape: "decouverte", date_dernier_contact: daysAgo(70) }, "reprise_contact", "direct", null, today);
    expect(decouverte.corps).toContain("au sujet de votre projet");
    expect(decouverte.corps).not.toContain("proposition");
  });

  it("particulier sans entreprise : aucune entreprise dans l'objet ni dans le message", () => {
    const particulier: FollowupProspect = { entreprise: null, contact_nom: "Jean Martin", etape: null, date_dernier_contact: daysAgo(20) };
    for (const scenario of FOLLOWUP_SCENARIOS) {
      for (const tone of ["formel", "direct", "chaleureux"] as const) {
        const { objet, corps } = renderFollowup(particulier, scenario, tone, null, today);
        expect(objet).not.toMatch(/null|undefined|·\s*$| : /);
        expect(objet.length).toBeGreaterThan(5);
        expect(corps).not.toMatch(/null|undefined/);
        expect(corps.startsWith("Bonjour Jean,")).toBe(true);
      }
    }
    expect(renderFollowup(particulier, "suivi_echange", "formel", null, today).corps).toContain("concernant votre projet.");
  });

  it("n'invente rien quand une information manque", () => {
    const anonyme: FollowupProspect = { entreprise: "Acme SAS", contact_nom: null, etape: null, date_dernier_contact: null };
    for (const scenario of FOLLOWUP_SCENARIOS) {
      for (const tone of FOLLOWUP_TONES) {
        const { objet, corps } = renderFollowup(anonyme, scenario, tone, null, today);
        expect(corps.startsWith("Bonjour,\n\n"), `${scenario}/${tone}`).toBe(true);
        expect(corps, `${scenario}/${tone}`).not.toMatch(/undefined|null|\{|\}| {2}| ,| \./);
        expect(corps, `${scenario}/${tone}`).not.toMatch(/\b(le|du|au) \d/);
        expect(objet, `${scenario}/${tone}`).toContain("Acme SAS");
        expect(corps).not.toMatch(/\(e\)|\(se\)/);
      }
    }
  });

  it("produit 15 variantes distinctes, toutes avec une question", () => {
    const bodies = new Set<string>();
    for (const scenario of FOLLOWUP_SCENARIOS) {
      for (const tone of FOLLOWUP_TONES) {
        const { corps } = renderFollowup(nordwind, scenario, tone, null, today);
        expect(corps, `${scenario}/${tone}`).toContain("?");
        bodies.add(corps);
      }
    }
    expect(bodies.size).toBe(15);
  });

  it("ajoute l'année quand le dernier échange date d'une autre année", () => {
    const { corps } = renderFollowup({ ...nordwind, date_dernier_contact: "2025-11-03" }, "dernier_message", "formel", null, today);
    expect(corps).toContain("le 3 novembre 2025");
  });

  it("écrit « 1er » pour le premier du mois", () => {
    const { corps } = renderFollowup({ ...nordwind, date_dernier_contact: "2026-04-01" }, "dernier_message", "direct", null, today);
    expect(corps).toContain("remonte au 1er avril.");
  });
});

describe("utilitaires", () => {
  it("n'utilise que des prénoms plausibles", () => {
    expect(contactFirstName("inès morel")).toBe("Inès");
    expect(contactFirstName("M. Dupont")).toBeNull();
    expect(contactFirstName("contact@acme.fr")).toBeNull();
    expect(contactFirstName(null)).toBeNull();
  });

  it("retrouve le scénario enregistré avec la relance", () => {
    expect(scenarioFromTag(scenarioTag("suivi_proposition"))).toBe("suivi_proposition");
    expect(scenarioFromTag("claude-opus-5-5")).toBeNull();
  });
});
