import { describe, expect, it } from "vitest";

import { appendSignature, parseFollowupText } from "./followup-format";

describe("parseFollowupText", () => {
  it("sépare l'objet du corps", () => {
    expect(parseFollowupText("Objet : Votre budget Q4\n\nBonjour Claire,\n\nOù en êtes-vous ?", "défaut")).toEqual({
      objet: "Votre budget Q4",
      corps: "Bonjour Claire,\n\nOù en êtes-vous ?",
    });
  });

  it("tolère les variantes (casse, espaces, objet en cours de streaming)", () => {
    expect(parseFollowupText("  objet: Point rapide\nBonjour,", "x").objet).toBe("Point rapide");
    expect(parseFollowupText("Objet : Notre propo", "x")).toEqual({ objet: "Notre propo", corps: "" });
  });

  it("utilise l'objet par défaut si le modèle l'omet", () => {
    expect(parseFollowupText("Bonjour,\n\nOù en êtes-vous ?", "Suite à nos échanges")).toEqual({
      objet: "Suite à nos échanges",
      corps: "Bonjour,\n\nOù en êtes-vous ?",
    });
  });
});

describe("appendSignature", () => {
  it("ajoute la signature telle quelle", () => {
    expect(appendSignature("Bien cordialement,", "Paul Durand\n06 12 34 56 78")).toBe(
      "Bien cordialement,\nPaul Durand\n06 12 34 56 78"
    );
  });

  it("ne change rien sans signature", () => {
    expect(appendSignature("Bien cordialement,", null)).toBe("Bien cordialement,");
    expect(appendSignature("Bien cordialement,", "  ")).toBe("Bien cordialement,");
  });
});
