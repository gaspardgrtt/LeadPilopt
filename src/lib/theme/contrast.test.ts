import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Contrastes des deux thèmes, lus directement dans globals.css : un changement de couleur qui
// rend un texte illisible fait échouer ce test (WCAG AA : 4,5:1 pour le texte).

const css = readFileSync(fileURLToPath(new URL("../../app/globals.css", import.meta.url)), "utf8");

function block(selector: RegExp): Record<string, string> {
  const match = css.match(selector);
  if (!match) throw new Error(`bloc introuvable : ${selector}`);
  const tokens: Record<string, string> = {};
  for (const [, name, value] of match[1].matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[name] = value;
  return tokens;
}

const light = block(/:root,\s*\.light\s*\{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/\n\.dark\s*\{([\s\S]*?)\n\}/) };

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [texte, fond] : couples réellement utilisés par les composants.
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "surface"],
  ["foreground", "background"],
  ["foreground-secondary", "surface"],
  ["foreground-secondary", "surface-subtle"],
  ["foreground-tertiary", "surface"],
  ["foreground-tertiary", "surface-subtle"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["info", "info-soft"],
  ["primary-hover", "primary-soft"],
  ["sidebar-muted", "sidebar"],
  ["sidebar-foreground", "sidebar"],
  ["hero-muted", "hero"],
  ["on-dark-positive", "hero"],
  ["on-dark-negative", "tooltip"],
];

describe.each([
  ["clair", light],
  ["sombre", dark],
])("thème %s", (_name, tokens) => {
  it.each(TEXT_PAIRS)("%s sur %s ≥ 4,5:1", (text, background) => {
    expect(tokens[text], text).toBeDefined();
    expect(tokens[background], background).toBeDefined();
    expect(contrast(tokens[text], tokens[background])).toBeGreaterThanOrEqual(4.5);
  });

  it("texte blanc sur les fonds pleins (boutons) ≥ 4,5:1", () => {
    for (const solid of ["primary-solid", "danger-solid", "success-solid"]) {
      expect(contrast("#ffffff", tokens[solid]), solid).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#ffffff", tokens.tooltip)).toBeGreaterThanOrEqual(4.5);
  });
});

it("thème sombre : le violet reste lisible comme texte sur les cartes", () => {
  expect(contrast(dark.primary, dark.surface)).toBeGreaterThanOrEqual(4.5);
});
