import { createHash } from "node:crypto";

import { createServerClient } from "@supabase/ssr";
import { describe, expect, it } from "vitest";

// Flux complet du lien magique avec les vraies bibliothèques (@supabase/ssr + supabase-js), réglées
// comme dans LeadPilot : demande du lien → retour depuis l'email → création de la session.
// Le serveur Supabase Auth est simulé : aucun email, aucun appel réseau.

const SUPABASE_URL = "https://projet-test.supabase.co";
const SITE = "https://leadpilot-immo.vercel.app";

type Cookie = { name: string; value: string };

/** Navigateur minimal : un pot de cookies partagé entre les requêtes. */
function browser() {
  const jar = new Map<string, string>();
  const maxAges = new Map<string, number | undefined>();
  return {
    jar,
    maxAges,
    cookies: {
      getAll: (): Cookie[] => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet: { name: string; value: string; options?: { maxAge?: number } }[]) => {
        for (const { name, value, options } of toSet) {
          maxAges.set(name, options?.maxAge);
          if (!value || options?.maxAge === 0) jar.delete(name);
          else jar.set(name, value);
        }
      },
    },
  };
}

/** Serveur Auth simulé : émet un code par demande et vérifie le challenge PKCE à l'échange. */
function fakeAuthServer() {
  const challenges = new Map<string, string>();
  const redirects: string[] = [];
  const calls = { token: 0 };
  let next = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname.endsWith("/otp")) {
      next += 1;
      challenges.set(`code-${next}`, body.code_challenge);
      redirects.push(String(url.searchParams.get("redirect_to")));
      return new Response("{}", { status: 200 });
    }
    if (url.pathname.endsWith("/token") && url.searchParams.get("grant_type") === "pkce") {
      calls.token += 1;
      const expected = challenges.get(body.auth_code);
      const actual = createHash("sha256").update(body.code_verifier ?? "").digest("base64url");
      if (!expected) return Response.json({ error_code: "flow_state_not_found", msg: "invalid flow state" }, { status: 404 });
      if (expected !== actual) return Response.json({ error_code: "bad_code_verifier", msg: "code challenge does not match" }, { status: 400 });
      challenges.delete(body.auth_code);
      const now = Math.floor(Date.now() / 1000);
      return Response.json({
        access_token: "jeton-test",
        refresh_token: "rafraichissement-test",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: now + 3600,
        user: { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", email: "agence@exemple.fr", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      });
    }
    return new Response("{}", { status: 404 });
  };
  return { fetchImpl, redirects, calls };
}

function client(b: ReturnType<typeof browser>, fetchImpl: typeof fetch, pkceFlowPerRequest: boolean) {
  return createServerClient(SUPABASE_URL, "cle-publishable-de-test", {
    cookies: b.cookies,
    global: { fetch: fetchImpl },
    ...(pkceFlowPerRequest ? { auth: { experimental: { appendPkceFlowIdToRedirects: true } } } : {}),
  });
}

async function requestLink(b: ReturnType<typeof browser>, server: ReturnType<typeof fakeAuthServer>) {
  const { error } = await client(b, server.fetchImpl, true).auth.signInWithOtp({
    email: "agence@exemple.fr",
    options: { shouldCreateUser: true, emailRedirectTo: `${SITE}/auth/confirm` },
  });
  expect(error).toBeNull();
  return new URL(server.redirects.at(-1)!);
}

/** Ce que fait /auth/confirm avec le lien : échange du code avec le flow id de l'URL. */
async function openLink(b: ReturnType<typeof browser>, server: ReturnType<typeof fakeAuthServer>, redirect: URL, code: string) {
  const flowId = redirect.searchParams.get("sb_flow_id");
  return client(b, server.fetchImpl, false).auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
}

describe("lien magique (PKCE, un verifier par demande)", () => {
  it("ajoute sb_flow_id à l'URL de retour et pose le verifier en cookie", async () => {
    const b = browser();
    const server = fakeAuthServer();
    const redirect = await requestLink(b, server);
    expect(redirect.origin + redirect.pathname).toBe(`${SITE}/auth/confirm`);
    expect(redirect.searchParams.get("sb_flow_id")).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect([...b.jar.keys()].some((name) => name.endsWith("-code-verifier") || name.includes("-code-verifier."))).toBe(true);
  });

  it("crée la session au retour depuis l'email, dans le même navigateur", async () => {
    const b = browser();
    const server = fakeAuthServer();
    const redirect = await requestLink(b, server);
    const { data, error } = await openLink(b, server, redirect, "code-1");
    expect(error).toBeNull();
    expect(data.session?.access_token).toBe("jeton-test");
    const sessionCookies = [...b.jar.keys()].filter((name) => name.includes("-auth-token") && !name.includes("verifier"));
    expect(sessionCookies.length).toBeGreaterThan(0);
    // Cookie persistant (400 jours) : la session survit à la fermeture du navigateur.
    for (const name of sessionCookies) expect(b.maxAges.get(name)).toBe(400 * 24 * 60 * 60);
  });

  it("garde le premier lien valable quand l'utilisateur en redemande un (cause du bug)", async () => {
    const b = browser();
    const server = fakeAuthServer();
    const first = await requestLink(b, server);
    const second = await requestLink(b, server);
    const firstResult = await openLink(b, server, first, "code-1");
    expect(firstResult.error).toBeNull();
    expect(firstResult.data.session).not.toBeNull();
    // Le second email reste lui aussi utilisable (autre onglet, autre moment).
    const secondResult = await openLink(browserWith(b), server, second, "code-2");
    expect(secondResult.error).toBeNull();
  });

  it("sans verifier par demande, le premier lien échoue après un renvoi : comportement corrigé", async () => {
    const b = browser();
    const server = fakeAuthServer();
    // Ancien réglage : pas de sb_flow_id, un seul verifier conservé (le dernier).
    for (let i = 0; i < 2; i += 1) {
      await client(b, server.fetchImpl, false).auth.signInWithOtp({ email: "agence@exemple.fr", options: { emailRedirectTo: `${SITE}/auth/confirm` } });
    }
    const { error } = await client(b, server.fetchImpl, false).auth.exchangeCodeForSession("code-1");
    expect(error?.code).toBe("bad_code_verifier");
  });

  it("refuse proprement un lien ouvert dans un autre navigateur, sans consommer le code", async () => {
    const server = fakeAuthServer();
    const redirect = await requestLink(browser(), server);
    const other = browser();
    const { error } = await openLink(other, server, redirect, "code-1");
    expect(error?.code).toBe("pkce_code_verifier_not_found");
    // Aucune requête d'échange n'est partie : le code n'a pas été consommé.
    expect(server.calls.token).toBe(0);
  });

  it("refuse un lien déjà utilisé", async () => {
    const b = browser();
    const server = fakeAuthServer();
    const redirect = await requestLink(b, server);
    expect((await openLink(b, server, redirect, "code-1")).error).toBeNull();
    const again = await openLink(b, server, redirect, "code-1");
    expect(again.error).not.toBeNull();
  });
});

/** Même navigateur (mêmes cookies) : copie le pot de cookies courant. */
function browserWith(b: ReturnType<typeof browser>) {
  const copy = browser();
  for (const [name, value] of b.jar) copy.jar.set(name, value);
  return copy;
}
