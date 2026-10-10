import { beforeEach, describe, expect, it, vi } from "vitest";

// Actions serveur de l'historique : Supabase simulé (aucune base contactée). On vérifie la
// validation et les paramètres transmis à la fonction SQL enregistrer_activite.

type Call = { fn: string; args: Record<string, unknown> };
const calls: Call[] = [];
const updates: Record<string, unknown>[] = [];
let rpcResult: { data: unknown; error: { code: string } | null } = { data: true, error: null };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return rpcResult;
    },
    from: () => {
      const builder = {
        update(values: Record<string, unknown>) {
          updates.push(values);
          return builder;
        },
        eq: () => builder,
        select: async () => ({ data: [{ id: "p" }], error: null }),
      };
      return builder;
    },
  }),
}));
vi.mock("@/lib/data/prospects", () => ({ isUuid: (value: string) => /^[0-9a-f-]{36}$/.test(value) }));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user-a" }) }));
vi.mock("@/lib/brevo/config", () => ({ getBrevoSenderIdentity: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => undefined }) }));
vi.mock("@/i18n/server", async () => {
  const { getMessages } = await import("@/i18n");
  return { getI18n: async () => ({ locale: "fr", t: getMessages("fr") }) };
});

const { recordActivity, scheduleNextAction } = await import("./actions");

const ID = "11111111-1111-4111-8111-111111111111";
const PROSPECT = "22222222-2222-4222-8222-222222222222";
const base = { id: ID, prospectId: PROSPECT, type: "relance", channel: "telephone", summary: " Point financement ", when: "maintenant", next: "3j", nextDate: null };

beforeEach(() => {
  calls.length = 0;
  updates.length = 0;
  rpcResult = { data: true, error: null };
});

describe("recordActivity", () => {
  it("relance manuelle : une seule fonction SQL, résumé nettoyé, prochaine action à J+3", async () => {
    const result = await recordActivity(base);
    expect(result).toMatchObject({ ok: true, created: true, contact: true, nextChanged: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("enregistrer_activite");
    expect(calls[0].args).toMatchObject({ p_id: ID, p_prospect: PROSPECT, p_type: "relance", p_canal: "telephone", p_resume: "Point financement", p_modifier_prochaine: true });
    expect(calls[0].args.p_prochaine_action).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("note : pas de canal, prochaine action non modifiée, note obligatoire", async () => {
    expect(await recordActivity({ ...base, type: "note", channel: "email", summary: "Rappeler en novembre", next: null })).toMatchObject({ ok: true, contact: false });
    expect(calls[0].args).toMatchObject({ p_type: "note", p_canal: null, p_modifier_prochaine: false, p_prochaine_action: null });
    calls.length = 0;
    expect(await recordActivity({ ...base, type: "note", summary: "   ", next: null })).toMatchObject({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it("« aucune prochaine action » : efface le rappel sans en créer", async () => {
    await recordActivity({ ...base, next: "aucune" });
    expect(calls[0].args).toMatchObject({ p_modifier_prochaine: true, p_prochaine_action: null });
  });

  it("refuse une date future, un canal inattendu, un type inconnu, une date de rappel passée", async () => {
    const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await recordActivity({ ...base, when: tomorrow })).ok).toBe(false);
    expect((await recordActivity({ ...base, type: "appel", channel: "sms" })).ok).toBe(false);
    expect((await recordActivity({ ...base, type: "reponse_recue" })).ok).toBe(false);
    expect((await recordActivity({ ...base, next: "date", nextDate: "2020-01-01" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("nouvelle tentative : même identifiant transmis, signalée comme déjà enregistrée", async () => {
    rpcResult = { data: false, error: null };
    expect(await recordActivity(base)).toMatchObject({ ok: true, created: false });
    expect(calls[0].args.p_id).toBe(ID);
  });

  it("prospect opposé à la prospection : message clair, rien d'enregistré côté interface", async () => {
    rpcResult = { data: null, error: { code: "P0001" } };
    const result = await recordActivity(base);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("opposé");
  });
});

describe("scheduleNextAction", () => {
  it("date programmée : tracée dans l'historique (type prochaine_action)", async () => {
    expect(await scheduleNextAction({ id: ID, prospectId: PROSPECT, next: "7j", nextDate: null })).toMatchObject({ ok: true });
    expect(calls[0].args).toMatchObject({ p_type: "prochaine_action", p_modifier_prochaine: true });
  });

  it("« aucune » : retire le rappel, aucune activité fictive", async () => {
    expect(await scheduleNextAction({ id: ID, prospectId: PROSPECT, next: "aucune", nextDate: null })).toMatchObject({ ok: true, nextAction: null });
    expect(calls).toHaveLength(0);
    expect(updates).toEqual([{ prochaine_action_le: null }]);
  });
});
