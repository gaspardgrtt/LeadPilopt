import { describe, expect, it } from "vitest";

import { displayName, formatPersonName } from "./display-name";

describe("displayName", () => {
  it("met en forme le nom saisi, prénom composé compris", () => {
    expect(displayName("  jean   martin ", "x@y.fr")).toEqual({ full: "Jean Martin", first: "Jean", isFallback: false });
    expect(formatPersonName("JEAN-LUC d'arc")).toBe("Jean-Luc D'arc");
  });

  it("sépare prénom et nom d'après l'email quand c'est possible", () => {
    expect(displayName(null, "claire.martin@acme.fr")).toEqual({ full: "Claire Martin", first: "Claire", isFallback: true });
    expect(displayName(null, "jeanmartin@exemple.fr")).toEqual({ full: "Jeanmartin", first: "Jeanmartin", isFallback: true });
    expect(displayName("", "")).toEqual({ full: "Mon compte", first: "", isFallback: true });
  });
});
