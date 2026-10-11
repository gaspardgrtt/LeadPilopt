import { beforeEach, describe, expect, it, vi } from "vitest";

// « Remplacer toutes les données » : la suppression (prospects et, en cascade, leur historique)
// n'a lieu qu'avec le jeton de confirmation envoyé après la case cochée. Supabase est simulé.

const deletes: string[] = [];
const upserts: { rows: Record<string, unknown>[]; onConflict: string }[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => ({
      upsert: async (rows: Record<string, unknown>[], options: { onConflict: string }) => {
        upserts.push({ rows, onConflict: options.onConflict });
        return { error: null };
      },
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

const { importBatch, startImport } = await import("./actions");

beforeEach(() => {
  deletes.length = 0;
  upserts.length = 0;
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

describe("importBatch", () => {
  const particulier = {
    entreprise: null,
    contact_nom: "Jean Martin",
    contact_email: "jean.martin@example.com",
    contact_telephone: "0600000001",
    montant_eur: null,
    date_dernier_contact: "2026-09-18",
    etape: null,
    etape_brute: null,
    notes: "Acheteur ; maison T4",
    donnees_brutes: { nom: "Martin", prenom: "Jean" },
  };
  const importId = "8f6b1c2e-1d2a-4c3b-9a8e-7f6d5c4b3a21";

  it("enregistre un particulier sans entreprise, dédoublonné par la clé d'import, sans toucher au statut", async () => {
    expect(await importBatch(importId, [particulier])).toEqual({ ok: true, count: 1 });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].onConflict).toBe("utilisateur_id,cle_import");
    expect(upserts[0].rows[0]).toMatchObject({ ...particulier, utilisateur_id: "user-a", import_id: importId });
    expect(upserts[0].rows[0]).not.toHaveProperty("statut");
    expect(upserts[0].rows[0]).not.toHaveProperty("cle_import");
  });

  it("refuse un lot contenant une ligne sans nom ni entreprise, sans rien enregistrer", async () => {
    const result = await importBatch(importId, [particulier, { ...particulier, contact_nom: null }]);
    expect(result.ok).toBe(false);
    expect(upserts).toEqual([]);
  });
});
