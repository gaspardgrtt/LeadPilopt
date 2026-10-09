import { describe, expect, it } from "vitest";

import { en, fr, getMessages, resolveLocale } from "./index";

// Cohérence des dictionnaires : l'anglais doit couvrir exactement les mêmes clés que le français,
// sans texte vide, et les fonctions doivent produire un texte avec les mêmes arguments.

type Entry = { path: string; value: unknown };

function flatten(value: unknown, path = ""): Entry[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, path ? `${path}.${key}` : key));
  }
  return [{ path, value }];
}

const SAMPLE_ARGS = ["Acme", "Claire", "12 000 €", "3"];
const call = (fn: (...args: unknown[]) => unknown, arity: number) =>
  fn(...Array.from({ length: arity }, (_, index) => (index % 2 === 0 ? 2 : SAMPLE_ARGS[index % SAMPLE_ARGS.length])));

describe("dictionnaires", () => {
  const frEntries = flatten(fr);
  const enEntries = new Map(flatten(en).map((entry) => [entry.path, entry.value]));

  it("l'anglais a exactement les mêmes clés que le français", () => {
    expect([...enEntries.keys()].sort()).toEqual(frEntries.map((entry) => entry.path).sort());
  });

  it("aucun texte vide, mêmes types et paramètres compatibles dans les deux langues", () => {
    for (const { path, value } of frEntries) {
      const other = enEntries.get(path);
      expect(typeof other, path).toBe(typeof value);
      if (typeof value === "string") {
        expect(value.trim(), path).not.toBe("");
        expect((other as string).trim(), path).not.toBe("");
      } else if (typeof value === "function") {
        // Une langue peut ignorer un paramètre (accord inutile en anglais), jamais en exiger un de plus.
        expect((other as (...args: unknown[]) => unknown).length, path).toBeLessThanOrEqual(value.length);
        for (const fn of [value, other] as ((...args: unknown[]) => unknown)[]) {
          const text = call(fn, value.length);
          expect(typeof text, path).toBe("string");
          expect((text as string).trim(), path).not.toBe("");
          expect(text as string, path).not.toContain("undefined");
        }
      } else if (Array.isArray(value)) {
        expect((other as unknown[]).length, path).toBe(value.length);
        for (const item of [...value, ...(other as unknown[])]) expect(String(item).trim(), path).not.toBe("");
      }
    }
  });

  it("le français est la langue par défaut", () => {
    expect(resolveLocale(undefined, undefined)).toBe("fr");
    expect(resolveLocale("de", "de-DE,de;q=0.9")).toBe("fr");
    expect(resolveLocale(undefined, "en-US,en;q=0.9")).toBe("en");
    expect(resolveLocale("fr", "en-US")).toBe("fr");
    expect(resolveLocale("en", "fr-FR")).toBe("en");
    expect(getMessages("fr").nav).toBe(fr.nav);
  });
});
