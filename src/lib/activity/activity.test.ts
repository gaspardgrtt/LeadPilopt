import { describe, expect, it } from "vitest";

import { activityTimestamp, buildTimeline, dueState, nextActionDate, parisToday, type ActivityRow } from "./activity";

const base: ActivityRow = {
  id: "x",
  type: "brouillon",
  canal: null,
  resume: null,
  effectuee_le: null,
  prochaine_action_le: null,
  objet: "Prochaines étapes · Acme",
  cree_le: "2026-10-01T08:00:00Z",
  copiee_le: null,
  envoi_statut: null,
  envoi_demande_le: null,
  envoyee_le: null,
  envoyee_a: null,
  envoi_erreur: null,
};

describe("historique : aucun envoi fictif", () => {
  it("un brouillon ouvert dans Gmail n'est jamais présenté comme un e-mail envoyé", () => {
    const items = buildTimeline([{ ...base, copiee_le: "2026-10-02T09:00:00Z" }]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("brouillon_utilise");
    expect(items.some((i) => i.kind === "email_envoye")).toBe(false);
  });

  it("un e-mail n'apparaît comme envoyé qu'après confirmation (envoi_statut = envoyee)", () => {
    const sent = buildTimeline([{ ...base, envoi_statut: "envoyee", envoyee_le: "2026-10-02T10:00:00Z", envoyee_a: "a@b.fr", copiee_le: "2026-10-02T10:00:00Z" }]);
    expect(sent).toEqual([expect.objectContaining({ kind: "email_envoye", to: "a@b.fr", channel: "email", at: "2026-10-02T10:00:00Z" })]);
    const pending = buildTimeline([{ ...base, envoi_statut: "en_cours", envoi_demande_le: "2026-10-02T10:00:00Z" }]);
    expect(pending).toEqual([]);
  });

  it("un échec d'envoi est affiché comme un échec, jamais comme un envoi", () => {
    const items = buildTimeline([{ ...base, envoi_statut: "echec", envoi_demande_le: "2026-10-02T10:00:00Z", envoi_erreur: "Brevo indisponible" }]);
    expect(items).toEqual([expect.objectContaining({ kind: "email_echec", summary: "Brevo indisponible" })]);
  });

  it("un brouillon jamais utilisé n'est pas une action", () => {
    expect(buildTimeline([base])).toEqual([]);
  });

  it("trie les activités du plus récent au plus ancien et garde canal, résumé, prochaine action", () => {
    const items = buildTimeline([
      { ...base, id: "a", type: "note", objet: null, resume: "Rappeler en novembre", effectuee_le: "2026-10-01T09:00:00Z" },
      { ...base, id: "b", type: "relance", objet: null, canal: "telephone", effectuee_le: "2026-10-03T09:00:00Z", prochaine_action_le: "2026-10-06" },
      { ...base, id: "c", type: "appel", objet: null, canal: "inconnu", effectuee_le: "2026-10-02T09:00:00Z" },
    ]);
    expect(items.map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(items[0]).toMatchObject({ kind: "relance", channel: "telephone", nextAction: "2026-10-06" });
    expect(items[1].channel).toBeNull();
  });
});

describe("prochaine action", () => {
  // 10 octobre 2026, 23 h 30 à Paris (21 h 30 UTC) : la date de Paris fait foi.
  const now = new Date("2026-10-10T21:30:00Z");

  it("calcule demain, J+3, J+7 en heure de Paris", () => {
    expect(parisToday(now)).toBe("2026-10-10");
    expect(nextActionDate("demain", null, now)).toBe("2026-10-11");
    expect(nextActionDate("3j", null, now)).toBe("2026-10-13");
    expect(nextActionDate("7j", null, now)).toBe("2026-10-17");
  });

  it("« aucune » ne crée aucun rappel", () => {
    expect(nextActionDate("aucune", null, now)).toBeNull();
  });

  it("refuse une date passée ou invalide", () => {
    expect(nextActionDate("date", "2026-10-09", now)).toBe("invalide");
    expect(nextActionDate("date", "pas-une-date", now)).toBe("invalide");
    expect(nextActionDate("date", null, now)).toBe("invalide");
    expect(nextActionDate("date", "2026-10-10", now)).toBe("2026-10-10");
    expect(nextActionDate("date", "2026-11-02", now)).toBe("2026-11-02");
  });

  it("échéances : en retard, aujourd'hui, demain, à venir", () => {
    expect(dueState("2026-10-09", now)).toBe("retard");
    expect(dueState("2026-10-10", now)).toBe("aujourdhui");
    expect(dueState("2026-10-11", now)).toBe("demain");
    expect(dueState("2026-10-20", now)).toBe("a_venir");
  });
});

describe("moment de l'activité", () => {
  const now = new Date("2026-10-10T08:00:00Z");
  it("maintenant, hier, une date passée ; jamais dans le futur", () => {
    expect(activityTimestamp("maintenant", now)).toBe(now.toISOString());
    expect(activityTimestamp("hier", now)).toBe("2026-10-09T08:00:00.000Z");
    expect(activityTimestamp("2026-10-01", now)).toBe("2026-10-01T10:00:00.000Z");
    expect(activityTimestamp("2026-10-11", now)).toBe("invalide");
    expect(activityTimestamp("n'importe quoi", now)).toBe("invalide");
  });
});
