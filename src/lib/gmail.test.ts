import { describe, expect, it } from "vitest";

import { GMAIL_URL_MAX_LENGTH, buildGmailComposeUrl } from "./gmail";

describe("buildGmailComposeUrl", () => {
  it("pré-remplit destinataire, objet et corps dans une URL de rédaction Gmail", () => {
    const { url, bodyIncluded } = buildGmailComposeUrl({
      to: "jonas@nordwind.com",
      subject: "Suite à notre échange concernant votre projet",
      body: "Bonjour Jonas,\n\nOù en êtes-vous ?\n\nCordialement\nPaul",
    });
    expect(bodyIncluded).toBe(true);
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe("https://mail.google.com/mail/");
    expect(parsed.searchParams.get("view")).toBe("cm");
    expect(parsed.searchParams.get("fs")).toBe("1");
    expect(parsed.searchParams.get("to")).toBe("jonas@nordwind.com");
    expect(parsed.searchParams.get("su")).toBe("Suite à notre échange concernant votre projet");
    expect(parsed.searchParams.get("body")).toBe("Bonjour Jonas,\n\nOù en êtes-vous ?\n\nCordialement\nPaul");
  });

  it("encode les caractères spéciaux sans les confondre avec la syntaxe de l'URL", () => {
    const body = "Prix : 15 000 € HT & remise 10 % ?\nVoir #2 + annexe = OK\r\nFin";
    const { url } = buildGmailComposeUrl({ to: "a+b@acme.fr", subject: "Q&A ? #1 + 2", body });
    expect(url).not.toMatch(/ /);
    expect(url).toContain("%20");
    expect(url).not.toMatch(/[?&]body=[^&]*\+/);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("to")).toBe("a+b@acme.fr");
    expect(parsed.searchParams.get("su")).toBe("Q&A ? #1 + 2");
    expect(parsed.searchParams.get("body")).toBe(body.replace("\r\n", "\n"));
  });

  it("omet le destinataire quand le prospect n'a pas d'email", () => {
    const { url } = buildGmailComposeUrl({ to: null, subject: "Objet", body: "Corps" });
    expect(new URL(url).searchParams.has("to")).toBe(false);
  });

  it("retire le corps si l'URL deviendrait trop longue, en gardant destinataire et objet", () => {
    const { url, bodyIncluded } = buildGmailComposeUrl({ to: "x@y.fr", subject: "Objet", body: "é".repeat(5000) });
    expect(bodyIncluded).toBe(false);
    expect(url.length).toBeLessThanOrEqual(GMAIL_URL_MAX_LENGTH);
    expect(new URL(url).searchParams.get("su")).toBe("Objet");
    expect(new URL(url).searchParams.has("body")).toBe(false);
  });
});
