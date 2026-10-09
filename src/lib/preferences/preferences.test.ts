import { describe, expect, it } from "vitest";

import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  applyTheme,
  isLangue,
  isTheme,
  parseLangue,
  parseTheme,
  preferenceCookie,
  readCookie,
  resolveDark,
} from "./preferences";

describe("préférences d'affichage", () => {
  it("n'accepte que les thèmes et langues connus, avec des valeurs par défaut sûres", () => {
    expect(["clair", "sombre", "systeme"].every(isTheme)).toBe(true);
    expect(isTheme("violet")).toBe(false);
    expect(parseTheme("<script>")).toBe("systeme");
    expect(parseTheme(undefined)).toBe("systeme");
    expect(isLangue("en")).toBe(true);
    expect(parseLangue("de")).toBe("fr");
  });

  it("résout le thème effectif selon le réglage du système", () => {
    expect(resolveDark("sombre", false)).toBe(true);
    expect(resolveDark("clair", true)).toBe(false);
    expect(resolveDark("systeme", true)).toBe(true);
    expect(resolveDark("systeme", false)).toBe(false);
  });

  it("lit et écrit le cookie de préférence", () => {
    expect(readCookie("sb-x=1; lp-theme=sombre; autre=2", THEME_COOKIE)).toBe("sombre");
    expect(readCookie("xlp-theme=clair", THEME_COOKIE)).toBeNull();
    const cookie = preferenceCookie(THEME_COOKIE, "clair", true);
    expect(cookie).toContain("lp-theme=clair");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(preferenceCookie(THEME_COOKIE, "clair", false)).not.toContain("Secure");
  });
});

/** Document minimal : classes et color-scheme de <html>, cookie, réglage du système. */
function fakeDocument(cookie: string, systemDark: boolean) {
  const classes = new Set<string>();
  const root = {
    classList: { toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)) },
    style: { colorScheme: "" },
  };
  const doc = { cookie, documentElement: root, defaultView: { matchMedia: () => ({ matches: systemDark }) } };
  return { doc, classes, root };
}

function runInitScript(cookie: string, systemDark: boolean) {
  const { doc, classes, root } = fakeDocument(cookie, systemDark);
  new Function("document", "window", THEME_INIT_SCRIPT)(doc, { matchMedia: () => ({ matches: systemDark }) });
  return { dark: classes.has("dark"), scheme: root.style.colorScheme };
}

describe("script d'initialisation du thème (avant le premier affichage)", () => {
  it("applique la préférence du cookie, puis le réglage du système", () => {
    expect(runInitScript("lp-theme=sombre", false)).toEqual({ dark: true, scheme: "dark" });
    expect(runInitScript("lp-theme=clair", true)).toEqual({ dark: false, scheme: "light" });
    expect(runInitScript("lp-theme=systeme", true)).toEqual({ dark: true, scheme: "dark" });
    expect(runInitScript("", false)).toEqual({ dark: false, scheme: "light" });
    expect(runInitScript("", true).dark).toBe(true);
  });

  it("applyTheme change le thème immédiatement", () => {
    const { doc, classes } = fakeDocument("", false);
    expect(applyTheme("sombre", doc as unknown as Document)).toBe(true);
    expect(classes.has("dark")).toBe(true);
    applyTheme("systeme", doc as unknown as Document, false);
    expect(classes.has("dark")).toBe(false);
  });
});
