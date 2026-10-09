import { describe, expect, it } from "vitest";

import { sendBrevoEmail } from "./client";

// Vérifie le filet de sécurité de vitest.setup.ts : sans simulation, un envoi Brevo ne part pas.
describe("tests sans réseau", () => {
  it("bloque tout appel réel à l'API Brevo", async () => {
    const error = await sendBrevoEmail(
      { apiKey: "cle-de-test-factice", senderEmail: "relances@agence.fr", senderName: "Test" },
      { to: { email: "jonas@nordwind.de" }, subject: "Objet", textContent: "Texte", htmlContent: "<p>Texte</p>" }
    ).catch((caught) => caught);
    // L'appel est intercepté avant le réseau : le client le signale comme une coupure (résultat incertain).
    expect(error.uncertain).toBe(true);
    await expect(fetch("https://api.brevo.com/v3/smtp/email")).rejects.toThrow("Appel réseau interdit");
  });

  it("ignore les variables Brevo de l'environnement", () => {
    expect(process.env.BREVO_API_KEY).toBeUndefined();
  });
});
