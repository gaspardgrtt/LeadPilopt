import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests de la route d'envoi : Supabase et Brevo sont simulés, aucun e-mail réel n'est envoyé et
// aucune base n'est contactée. La clé ci-dessous est factice.

type Row = Record<string, unknown>;
const db: { relances: Row[]; prospects: Row[]; utilisateurs: Row[] } = { relances: [], prospects: [], utilisateurs: [] };
let currentUser: string | null = "user-a";

// Constructeur de requêtes minimal : filtres eq / gte / or(statut), select, update, maybeSingle.
function table(name: keyof typeof db) {
  const filters: ((row: Row) => boolean)[] = [];
  let patch: Row | null = null;
  let countMode = false;
  const builder = {
    select(_columns?: string, options?: { count?: string; head?: boolean }) {
      countMode = Boolean(options?.head);
      return builder;
    },
    update(values: Row) {
      patch = values;
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    gte(column: string, value: string) {
      filters.push((row) => typeof row[column] === "string" && (row[column] as string) >= value);
      return builder;
    },
    or(expression: string) {
      if (expression === "envoi_statut.is.null,envoi_statut.eq.echec") {
        filters.push((row) => row.envoi_statut == null || row.envoi_statut === "echec");
      }
      return builder;
    },
    run() {
      // RLS simulée : un compte ne voit que ses lignes.
      const visible = db[name].filter((row) => (name === "utilisateurs" ? row.id : row.utilisateur_id) === currentUser);
      const rows = visible.filter((row) => filters.every((filter) => filter(row)));
      if (patch) rows.forEach((row) => Object.assign(row, patch));
      return rows;
    },
    async maybeSingle() {
      return { data: builder.run()[0] ?? null, error: null };
    },
    then(resolve: (value: unknown) => void) {
      const rows = builder.run();
      resolve(countMode ? { count: rows.length, error: null } : { data: rows, error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getClaims: async () => ({ data: currentUser ? { claims: { sub: currentUser } } : null }) },
    from: (name: keyof typeof db) => table(name),
  }),
}));

vi.mock("@/lib/data/prospects", () => ({
  isUuid: (value: string) => /^[0-9a-f-]{36}$/.test(value),
}));

const brevoConfig = { apiKey: "cle-de-test-factice", senderEmail: "relances@agence.fr", senderName: "Agence Dupont" };
const senderCheck = vi.fn(async () => ({ ok: true as const }));
let configured = true;
vi.mock("@/lib/brevo/config", () => ({
  getBrevoConfig: () => (configured ? brevoConfig : null),
  ensureVerifiedSender: () => senderCheck(),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const { POST } = await import("./route");

const RELANCE = "11111111-1111-4111-8111-111111111111";
const PROSPECT = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "http://localhost:3000";

function request(body: unknown, origin: string | null = ORIGIN) {
  const headers = new Headers({ "content-type": "application/json" });
  if (origin) headers.set("origin", origin);
  const req = new Request(`${ORIGIN}/api/relances/envoyer`, { method: "POST", headers, body: JSON.stringify(body) });
  return Object.assign(req, { nextUrl: new URL(req.url) }) as unknown as Parameters<typeof POST>[0];
}

const valid = { relanceId: RELANCE, objet: "Prochaines étapes · Nordwind GmbH", corps: "Bonjour Jonas,\n\nOù en êtes-vous ?" };

beforeEach(() => {
  currentUser = "user-a";
  configured = true;
  senderCheck.mockClear();
  senderCheck.mockResolvedValue({ ok: true });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ messageId: "<msg-1@smtp-relay.mailin.fr>" }), { status: 201 }));
  db.utilisateurs = [{ id: "user-a", email: "paul@agence.fr", nom: "paul durand" }, { id: "user-b", email: "b@autre.fr", nom: null }];
  db.prospects = [
    {
      id: PROSPECT,
      utilisateur_id: "user-a",
      entreprise: "Nordwind GmbH",
      contact_nom: "Jonas Weber",
      contact_email: "jonas@nordwind.de",
      statut: "a_traiter",
      opposition_prospection_le: null,
    },
  ];
  db.relances = [
    {
      id: RELANCE,
      utilisateur_id: "user-a",
      prospect_id: PROSPECT,
      objet: valid.objet,
      corps: valid.corps,
      copiee_le: null,
      envoi_statut: null,
      envoi_demande_le: null,
    },
  ];
});

describe("POST /api/relances/envoyer", () => {
  it("envoie via Brevo, enregistre le statut et l'identifiant, puis passe le dossier en « Relancé »", async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, envoyeeA: "jonas@nordwind.de" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    const sent = JSON.parse(String(init.body));
    expect(sent.to).toEqual([{ email: "jonas@nordwind.de", name: "Jonas Weber" }]);
    expect(sent.sender).toEqual({ email: "relances@agence.fr", name: "Agence Dupont" });
    expect(sent.replyTo).toEqual({ email: "paul@agence.fr", name: "Paul Durand" });
    expect(sent.textContent).toContain("répondez simplement « STOP »");

    expect(db.relances[0]).toMatchObject({
      envoi_statut: "envoyee",
      envoyee_a: "jonas@nordwind.de",
      brevo_message_id: "<msg-1@smtp-relay.mailin.fr>",
    });
    expect(db.prospects[0].statut).toBe("relance");
  });

  it("refuse une requête venant d'un autre site ou sans session", async () => {
    expect((await POST(request(valid, "https://evil.example"))).status).toBe(403);
    expect((await POST(request(valid, null))).status).toBe(403);
    currentUser = null;
    expect((await POST(request(valid))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("n'envoie jamais la relance d'une autre agence", async () => {
    currentUser = "user-b";
    expect((await POST(request(valid))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.relances[0].envoi_statut).toBeNull();
  });

  it("respecte l'opposition à la prospection", async () => {
    db.prospects[0].opposition_prospection_le = "2026-10-01T10:00:00Z";
    const response = await POST(request(valid));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain("opposé");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse une adresse absente ou invalide, et un objet multiligne", async () => {
    db.prospects[0].contact_email = "jonas@nordwind";
    expect((await POST(request(valid))).status).toBe(422);
    db.prospects[0].contact_email = "jonas@nordwind.de";
    expect((await POST(request({ ...valid, objet: "Objet\nBcc: x@y.fr" }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuse un message modifié depuis l'aperçu", async () => {
    expect((await POST(request({ ...valid, corps: "Autre texte" }))).status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("évite les doubles envois", async () => {
    expect((await POST(request(valid))).status).toBe(200);
    const again = await POST(request(valid));
    expect(again.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    db.relances[0].envoi_statut = "en_cours";
    expect((await POST(request(valid))).status).toBe(409);
  });

  it("ne suppose pas l'expéditeur validé : sans confirmation de Brevo, rien n'est envoyé", async () => {
    senderCheck.mockResolvedValue({ ok: false, message: "L'expéditeur n'est pas encore validé dans Brevo." } as never);
    const response = await POST(request(valid));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toContain("pas encore validé");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.relances[0].envoi_statut).toBeNull();
  });

  it("désactive l'envoi tant que Brevo n'est pas configuré", async () => {
    configured = false;
    expect((await POST(request(valid))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enregistre l'échec Brevo sans divulguer la clé, et permet de réessayer", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: "unauthorized", message: "Key not found cle-de-test-factice" }), { status: 401 }));
    const response = await POST(request(valid));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain("cle-de-test-factice");
    expect(text).not.toContain("Key not found");
    expect(db.relances[0]).toMatchObject({ envoi_statut: "echec" });

    expect((await POST(request(valid))).status).toBe(200);
    expect(db.relances[0].envoi_statut).toBe("envoyee");
  });
});
