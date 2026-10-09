// Filet de sécurité des tests : aucun appel réseau réel (Brevo, Supabase…). Un test qui a besoin
// de `fetch` doit le simuler (vi.stubGlobal ou fetch injecté) ; sinon l'appel échoue ici, avant
// tout envoi. Les variables Brevo éventuellement présentes dans l'environnement sont masquées.
import { vi } from "vitest";

for (const name of ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"]) delete process.env[name];

vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
  throw new Error(`Appel réseau interdit pendant les tests : ${String(input instanceof Request ? input.url : input)}`);
});
