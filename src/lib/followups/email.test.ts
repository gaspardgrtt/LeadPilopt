import { describe, expect, it } from "vitest";

import { OPPOSITION_NOTICE, buildEmailContent, checkEmailContent, isValidEmail } from "./email";

describe("isValidEmail", () => {
  it("accepte les adresses courantes et refuse les autres", () => {
    for (const ok of ["jonas@nordwind.de", "j.weber+crm@nord-wind.co.uk", "A@B.FR"]) expect(isValidEmail(ok), ok).toBe(true);
    for (const ko of [null, "", "jonas", "jonas@", "@nordwind.de", "jonas@nordwind", "jo nas@nordwind.de", "jonas@@nordwind.de", "jonas@nordwind..de", "a<b>@c.de", "x".repeat(250) + "@a.fr"]) {
      expect(isValidEmail(ko), String(ko)).toBe(false);
    }
  });
});

describe("checkEmailContent", () => {
  it("refuse un objet multiligne (injection d'en-tête), vide ou trop long", () => {
    expect(checkEmailContent("Objet\r\nBcc: x@y.fr", "Corps").ok).toBe(false);
    expect(checkEmailContent("  ", "Corps").ok).toBe(false);
    expect(checkEmailContent("o".repeat(301), "Corps").ok).toBe(false);
    expect(checkEmailContent("Objet", "  ").ok).toBe(false);
    expect(checkEmailContent("Objet", "c".repeat(10001)).ok).toBe(false);
    expect(checkEmailContent(undefined, "Corps").ok).toBe(false);
    expect(checkEmailContent("  Objet ", " Corps ")).toEqual({ ok: true, subject: "Objet", body: "Corps" });
  });
});

describe("buildEmailContent", () => {
  it("ajoute la mention d'opposition et échappe le HTML", () => {
    const { text, html } = buildEmailContent("Bonjour <Jonas> & co,\n\nLigne 1\nLigne 2");
    expect(text.endsWith(OPPOSITION_NOTICE)).toBe(true);
    expect(html).toContain("Bonjour &lt;Jonas&gt; &amp; co,");
    expect(html).toContain("Ligne 1<br>Ligne 2");
    expect(html).not.toContain("<Jonas>");
    expect(html).toContain("répondez simplement « STOP »");
  });
});
