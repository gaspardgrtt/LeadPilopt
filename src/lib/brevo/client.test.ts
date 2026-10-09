import { describe, expect, it, vi } from "vitest";

import { BREVO_API_URL, BrevoError, checkBrevoSender, sendBrevoEmail, type BrevoConfig } from "./client";

// Aucun appel réseau : `fetch` est simulé. La clé ci-dessous est factice.
const config: BrevoConfig = { apiKey: "cle-de-test-factice", senderEmail: "relances@agence.fr", senderName: "Agence Dupont" };
const email = {
  to: { email: "jonas@nordwind.de", name: "Jonas Weber" },
  replyTo: { email: "paul@agence.fr", name: "Paul Durand" },
  subject: "Prochaines étapes · Nordwind GmbH",
  textContent: "Bonjour Jonas,",
  htmlContent: "<p>Bonjour Jonas,</p>",
  tags: ["leadpilot-relance"],
};

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("sendBrevoEmail", () => {
  it("appelle POST /v3/smtp/email avec la clé dans l'en-tête api-key et renvoie le messageId", async () => {
    const fetchMock = respond(201, { messageId: "<202610091200.123@smtp-relay.mailin.fr>" });
    const result = await sendBrevoEmail(config, email, fetchMock as unknown as typeof fetch);
    expect(result.messageId).toBe("<202610091200.123@smtp-relay.mailin.fr>");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BREVO_API_URL}/smtp/email`);
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("cle-de-test-factice");
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      sender: { email: "relances@agence.fr", name: "Agence Dupont" },
      to: [{ email: "jonas@nordwind.de", name: "Jonas Weber" }],
      replyTo: { email: "paul@agence.fr", name: "Paul Durand" },
      subject: "Prochaines étapes · Nordwind GmbH",
      textContent: "Bonjour Jonas,",
      htmlContent: "<p>Bonjour Jonas,</p>",
      tags: ["leadpilot-relance"],
    });
    expect(String(init.body)).not.toContain("cle-de-test-factice");
  });

  it.each([
    [400, "adresse ou contenu invalide"],
    [401, "clé Brevo refusée"],
    [402, "crédits"],
    [403, "expéditeur"],
    [429, "Réessayez dans une minute"],
    [503, "momentanément indisponible"],
  ])("traduit l'erreur %i sans divulguer la clé ni la réponse brute", async (status, expected) => {
    const fetchMock = respond(status, { code: "x", message: "détail interne cle-de-test-factice" });
    const error = await sendBrevoEmail(config, email, fetchMock as unknown as typeof fetch).catch((caught) => caught);
    expect(error).toBeInstanceOf(BrevoError);
    expect(error.userMessage).toContain(expected);
    expect(error.userMessage).not.toContain("cle-de-test-factice");
    expect(error.userMessage).not.toContain("détail interne");
    expect(error.uncertain).toBe(false);
  });

  it("signale un résultat incertain en cas de coupure réseau ou de délai dépassé", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await sendBrevoEmail(config, email, fetchMock as unknown as typeof fetch).catch((caught) => caught);
    expect(error).toBeInstanceOf(BrevoError);
    expect(error.uncertain).toBe(true);
  });
});

describe("checkBrevoSender", () => {
  it("accepte uniquement un expéditeur déclaré et actif", async () => {
    const actif = respond(200, { senders: [{ email: "Relances@Agence.fr", active: true }] });
    expect(await checkBrevoSender(config, actif as unknown as typeof fetch)).toEqual({ ok: true });
    const [url, init] = actif.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/senders");
    expect(init.method).toBe("GET");

    const inactif = respond(200, { senders: [{ email: "relances@agence.fr", active: false }] });
    expect((await checkBrevoSender(config, inactif as unknown as typeof fetch)).ok).toBe(false);

    const absent = respond(200, { senders: [{ email: "autre@agence.fr", active: true }] });
    const status = await checkBrevoSender(config, absent as unknown as typeof fetch);
    expect(status.ok).toBe(false);
    if (!status.ok) expect(status.message).toContain("n'est pas déclarée");

    const refus = respond(401, {});
    expect((await checkBrevoSender(config, refus as unknown as typeof fetch)).ok).toBe(false);
  });
});
