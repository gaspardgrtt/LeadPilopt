import { beforeEach, describe, expect, it, vi } from "vitest";

// Route /auth/confirm : Supabase est simulé (aucun appel réseau). On vérifie qu'une seule méthode
// est utilisée par requête, que le code n'est échangé qu'une fois, et les redirections d'erreur.

const auth = {
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  getClaims: vi.fn(),
};
let prospectCount = 0;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth,
    from: () => ({ select: async () => ({ count: prospectCount, error: null }) }),
  }),
}));

const { GET } = await import("./route");

const SITE = "https://leadpilot-immo.vercel.app";

function get(query: string) {
  const req = new Request(`${SITE}/auth/confirm${query}`);
  return GET(Object.assign(req, { nextUrl: new URL(req.url) }) as unknown as Parameters<typeof GET>[0]);
}

const location = (response: Response) => response.headers.get("location");
const authError = (code: string) => ({ data: { session: null, user: null }, error: { code, message: code, status: 400 } });

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  auth.exchangeCodeForSession.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
  auth.verifyOtp.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
  auth.getClaims.mockReset().mockResolvedValue({ data: null });
  prospectCount = 0;
});

describe("GET /auth/confirm", () => {
  it("échange le code PKCE une seule fois, avec le flow id du lien, puis ouvre l'import au premier passage", async () => {
    const response = await get("?code=abc&sb_flow_id=flow_123456789");
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("abc", { flowId: "flow_123456789" });
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(location(response)).toBe(`${SITE}/import`);
  });

  it("redirige vers le tableau de bord quand le compte a déjà des prospects, ou vers la page demandée", async () => {
    prospectCount = 12;
    expect(location(await get("?code=abc"))).toBe(`${SITE}/tableau-de-bord`);
    expect(auth.exchangeCodeForSession).toHaveBeenLastCalledWith("abc", undefined);
    expect(location(await get("?code=abc&suivant=%2Fprospects%3Fvue%3Dtous"))).toBe(`${SITE}/prospects?vue=tous`);
  });

  it("refuse une redirection vers un autre site après connexion", async () => {
    expect(location(await get("?code=abc&suivant=https%3A%2F%2Fevil.example"))).toBe(`${SITE}/import`);
    expect(location(await get("?code=abc&suivant=%2F%2Fevil.example"))).toBe(`${SITE}/import`);
  });

  it("utilise token_hash (modèles LeadPilot) sans jamais échanger de code", async () => {
    const response = await get("?token_hash=pkce_abc&type=email");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "pkce_abc" });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(response)).toBe(`${SITE}/import`);
  });

  it.each([
    ["pkce_code_verifier_not_found", "autre-navigateur"],
    ["bad_code_verifier", "ancienne-demande"],
    ["flow_state_not_found", "lien-expire"],
    ["flow_state_expired", "lien-expire"],
    ["inconnu", "lien-invalide"],
  ])("échec de l'échange %s → /connexion?erreur=%s", async (code, reason) => {
    auth.exchangeCodeForSession.mockResolvedValue(authError(code));
    expect(location(await get("?code=abc"))).toBe(`${SITE}/connexion?erreur=${reason}`);
  });

  it("lien refusé par Supabase avant la redirection (expiré, déjà ouvert) : aucun échange tenté", async () => {
    const response = await get("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(location(response)).toBe(`${SITE}/connexion?erreur=lien-expire`);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("token_hash expiré ou de type inconnu", async () => {
    auth.verifyOtp.mockResolvedValue(authError("otp_expired"));
    expect(location(await get("?token_hash=x&type=email"))).toBe(`${SITE}/connexion?erreur=lien-expire`);
    expect(location(await get("?token_hash=x&type=recovery_inconnu"))).toBe(`${SITE}/connexion?erreur=lien-invalide`);
  });

  it("lien incomplet", async () => {
    expect(location(await get(""))).toBe(`${SITE}/connexion?erreur=lien-invalide`);
  });

  it("lien déjà consommé mais session ouverte (double clic) : l'utilisateur continue sans erreur", async () => {
    auth.exchangeCodeForSession.mockResolvedValue(authError("flow_state_not_found"));
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } } });
    expect(location(await get("?code=abc"))).toBe(`${SITE}/tableau-de-bord`);
    expect(location(await get("?code=abc&suivant=%2Fpriorites"))).toBe(`${SITE}/priorites`);
  });
});
