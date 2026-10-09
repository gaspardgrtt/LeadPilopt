import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Persistance de la session : le vrai middleware (updateSession) et la vraie bibliothèque
// @supabase/ssr, face à un serveur Supabase Auth simulé. Aucun appel réseau, aucun email.
// Scénarios : navigateur rouvert le lendemain, jeton expiré renouvelé, session révoquée,
// déconnexion de cet appareil.

const SUPABASE_URL = "https://projet-test.supabase.co";
const SITE = "https://leadpilot-immo.vercel.app";
const COOKIE = "sb-projet-test-auth-token";
const FOUR_HUNDRED_DAYS = 400 * 24 * 60 * 60;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "cle-publishable-de-test";

const b64url = (value: string) => Buffer.from(value).toString("base64url");
const user = { id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", email: "agence@exemple.fr", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" };

function jwt(expiresAt: number) {
  return [
    b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    b64url(JSON.stringify({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", exp: expiresAt, iat: expiresAt - 3600, session_id: "s1" })),
    b64url("signature-de-test"),
  ].join(".");
}

function session(expiresAt: number, refreshToken = "rafraichissement-1") {
  return { access_token: jwt(expiresAt), refresh_token: refreshToken, token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user };
}

const sessionCookie = (value: object) => `${COOKIE}=base64-${b64url(JSON.stringify(value))}`;

const calls = { refresh: 0, user: 0, logout: [] as string[] };
let refreshResponse: () => Response;

const fakeFetch = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
    calls.refresh += 1;
    return refreshResponse();
  }
  if (url.pathname === "/auth/v1/user") {
    calls.user += 1;
    return Response.json(user);
  }
  if (url.pathname === "/auth/v1/logout") {
    calls.logout.push(url.searchParams.get("scope") ?? "");
    return new Response(null, { status: 204 });
  }
  return new Response("{}", { status: 404 });
});
vi.stubGlobal("fetch", fakeFetch);

const { updateSession } = await import("./middleware");

const now = () => Math.floor(Date.now() / 1000);
const request = (path: string, cookie?: string) =>
  new NextRequest(`${SITE}${path}`, { headers: cookie ? { cookie } : {} });

/** Attributs d'un cookie posé par la réponse (Set-Cookie). */
function setCookie(response: Response, name: string) {
  return response.headers.getSetCookie().find((header) => header.startsWith(`${name}=`)) ?? null;
}

beforeEach(() => {
  calls.refresh = 0;
  calls.user = 0;
  calls.logout = [];
  refreshResponse = () => Response.json(session(now() + 3600, "rafraichissement-2"));
});

describe("persistance de la session (middleware)", () => {
  it("navigateur rouvert, session encore valide : accès direct, aucun nouveau lien demandé", async () => {
    const response = await updateSession(request("/tableau-de-bord", sessionCookie(session(now() + 1800))));
    expect(response.headers.get("location")).toBeNull();
    expect(calls.refresh).toBe(0);
  });

  it("le lendemain, jeton d'accès expiré : renouvelé avec le refresh token, cookie persistant de 400 jours", async () => {
    const response = await updateSession(request("/tableau-de-bord", sessionCookie(session(now() - 20 * 3600))));
    expect(response.headers.get("location")).toBeNull();
    expect(calls.refresh).toBe(1);
    const cookie = setCookie(response, COOKIE);
    expect(cookie).not.toBeNull();
    expect(cookie).toContain(`Max-Age=${FOUR_HUNDRED_DAYS}`);
    expect(cookie).toContain("Path=/");
    expect(cookie?.toLowerCase()).toContain("samesite=lax");
    // Une réponse qui renouvelle la session ne doit pas être mise en cache par un CDN.
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("session révoquée (refresh token invalide) : retour à la connexion et cookies effacés", async () => {
    refreshResponse = () => Response.json({ error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }, { status: 400 });
    const response = await updateSession(request("/priorites", sessionCookie(session(now() - 3600))));
    expect(response.headers.get("location")).toBe(`${SITE}/connexion?suivant=%2Fpriorites`);
    const cleared = setCookie(response, COOKIE);
    expect(cleared === null || /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(cleared)).toBe(true);
  });

  it("protège toujours les pages privées sans session", async () => {
    const response = await updateSession(request("/tableau-de-bord"));
    expect(response.headers.get("location")).toBe(`${SITE}/connexion?suivant=%2Ftableau-de-bord`);
    const api = await updateSession(request("/api/relances/envoyer"));
    expect(api.status).toBe(401);
  });

  it("utilisateur déjà connecté sur /connexion : renvoyé au tableau de bord, sans nouveau lien", async () => {
    const response = await updateSession(request("/connexion", sessionCookie(session(now() + 1800))));
    expect(response.headers.get("location")).toBe(`${SITE}/tableau-de-bord`);
  });
});

describe("déconnexion", () => {
  it("révoque la session de cet appareil uniquement (portée local) et efface ses cookies", async () => {
    const jar = new Map<string, string>([[COOKIE, `base64-${b64url(JSON.stringify(session(now() + 1800)))}`]]);
    const supabase = createServerClient(SUPABASE_URL, "cle-publishable-de-test", {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) => (!value || options?.maxAge === 0 ? jar.delete(name) : jar.set(name, value))),
      },
    });
    const { error } = await supabase.auth.signOut({ scope: "local" });
    expect(error).toBeNull();
    expect(calls.logout).toEqual(["local"]);
    expect([...jar.keys()].some((name) => name.startsWith(COOKIE))).toBe(false);
  });

  it("le code de LeadPilot déconnecte avec la portée local", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../auth/actions.ts", import.meta.url), "utf8");
    expect(source).toContain('signOut({ scope: "local" })');
  });
});
