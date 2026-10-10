import { beforeEach, describe, expect, it, vi } from "vitest";

// « Remplacer toutes les données » : la suppression (prospects et, en cascade, leur historique)
// n'a lieu qu'avec le jeton de confirmation envoyé après la case cochée. Supabase est simulé.

const deletes: string[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      delete: () => ({
        eq: async () => {
          deletes.push(table);
          return { error: null };
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user-a" }) }));
vi.mock("@/lib/data/prospects", () => ({ isUuid: () => true }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/i18n/server", async () => {
  const { getMessages } = await import("@/i18n");
  return { getI18n: async () => ({ locale: "fr", t: getMessages("fr") }) };
});

const { startImport } = await import("./actions");

beforeEach(() => {
  deletes.length = 0;
});

describe("startImport", () => {
  it("« Mettre à jour » ne supprime rien", async () => {
    expect((await startImport(false)).ok).toBe(true);
    expect(deletes).toEqual([]);
  });

  it("remplacement sans confirmation explicite : refusé, aucune suppression", async () => {
    const result = await startImport(true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("aucune donnée n'a été supprimée");
    expect((await startImport(true, "oui")).ok).toBe(false);
    expect(deletes).toEqual([]);
  });

  it("remplacement confirmé : suppression des prospects du compte (historique en cascade)", async () => {
    expect((await startImport(true, "supprimer-prospects-et-historique")).ok).toBe(true);
    expect(deletes).toEqual(["prospects"]);
  });
});
