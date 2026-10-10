"use server";

import { getI18n } from "@/i18n/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { isUuid } from "@/lib/data/prospects";
import { BATCH_SIZE } from "@/lib/import/fields";
import { validateImportRow } from "@/lib/import/rows";
import { FOLLOWUP_TONES, type FollowupTone } from "@/lib/prospects";

// Import en trois temps, piloté par l'assistant E2 :
// 1. startImport : identifiant d'import, et suppression des données si « Remplacer » ;
// 2. importBatch : enregistrement par lots (idempotent : un lot rejoué met à jour sans doublon) ;
// 3. finishImport : réglages du compte, puis calcul (oubli, CA récupérable, score).

export type ImportActionResult<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/**
 * Jeton de confirmation de « Remplacer toutes les données ». La suppression (prospects et, en
 * cascade, tout leur historique) n'a lieu que si l'interface le transmet après la case cochée par
 * l'utilisateur : un appel incomplet ou accidentel ne supprime rien.
 */
const REPLACE_CONFIRMATION = "supprimer-prospects-et-historique";

export async function startImport(replace: boolean, confirmation?: string): Promise<ImportActionResult<{ importId: string }>> {
  const { t } = await getI18n();
  const user = await requireUser();
  if (replace && confirmation !== REPLACE_CONFIRMATION) {
    return { ok: false, message: t.import.errors.replaceNotConfirmed };
  }
  if (replace) {
    const supabase = await createClient();
    const { error } = await supabase.from("prospects").delete().eq("utilisateur_id", user.id);
    if (error) {
      console.error("[import] suppression des données impossible", { code: error.code });
      return { ok: false, message: t.import.errors.deleteFailed };
    }
  }
  return { ok: true, importId: crypto.randomUUID() };
}

export async function importBatch(importId: string, rows: unknown[]): Promise<ImportActionResult<{ count: number }>> {
  const { t } = await getI18n();
  if (!isUuid(importId) || !Array.isArray(rows) || rows.length === 0 || rows.length > BATCH_SIZE) {
    return { ok: false, message: t.actions.invalidRequest };
  }
  const validated = rows.map(validateImportRow);
  if (validated.some((row) => row === null)) return { ok: false, message: t.import.errors.invalidRows };

  const user = await requireUser();
  const now = new Date().toISOString();
  const payload = validated.map((row) => ({ ...row!, utilisateur_id: user.id, import_id: importId, importe_le: now }));

  const supabase = await createClient();
  // Pas de `statut` dans la charge utile : un ré-import ne touche jamais au suivi LeadPilot.
  const { error } = await supabase
    .from("prospects")
    .upsert(payload, { onConflict: "utilisateur_id,contact_email,entreprise" });
  if (error) {
    console.error("[import] enregistrement d'un lot impossible", { code: error.code, message: error.message });
    return { ok: false, message: t.import.errors.generic };
  }
  return { ok: true, count: payload.length };
}

export type ImportSettings = {
  seuil: number;
  panier: number | null;
  /** Taux de commission en %, facultatif. */
  commission: number | null;
  ton: FollowupTone;
  signature: string;
};

export type ImportSummary = { nbProspects: number; nbOublies: number; caRecuperable: number };

export async function finishImport(settings: ImportSettings): Promise<ImportActionResult<{ summary: ImportSummary }>> {
  const { t } = await getI18n();
  const seuil = Number(settings?.seuil);
  const panier = settings?.panier === null ? null : Number(settings?.panier);
  const signature = typeof settings?.signature === "string" ? settings.signature.trim() : "";
  if (!Number.isInteger(seuil) || seuil < 1 || seuil > 365) {
    return { ok: false, message: t.import.errors.threshold };
  }
  if (panier !== null && (!Number.isFinite(panier) || panier < 0 || panier > 1e10)) {
    return { ok: false, message: t.import.errors.basket };
  }
  const commission = settings?.commission === null || settings?.commission === undefined ? null : Number(settings.commission);
  if (commission !== null && (!Number.isFinite(commission) || commission <= 0 || commission > 100)) {
    return { ok: false, message: t.import.errors.commission };
  }
  if (!(FOLLOWUP_TONES as readonly string[]).includes(settings?.ton)) return { ok: false, message: t.import.errors.tone };
  if (signature.length > 1000) return { ok: false, message: t.import.errors.signature };

  const user = await requireUser();
  const supabase = await createClient();

  const { error: settingsError } = await supabase
    .from("utilisateurs")
    .update({
      seuil_inactivite_jours: seuil,
      panier_moyen_eur: panier,
      ton_relance: settings.ton,
      signature: signature || null,
      taux_commission: commission === null ? null : Math.round(commission * 100) / 100,
    })
    .eq("id", user.id);
  if (settingsError) {
    console.error("[import] enregistrement des réglages impossible", { code: settingsError.code });
    return { ok: false, message: t.import.errors.settings };
  }

  const { error: computeError } = await supabase.rpc("recalculer_prospects");
  if (computeError) {
    console.error("[import] calcul impossible", { code: computeError.code });
    return { ok: false, message: t.import.errors.compute };
  }

  const { data, error } = await supabase.rpc("tableau_de_bord").single();
  if (error) return { ok: false, message: t.import.errors.summary };

  revalidatePath("/", "layout");
  return {
    ok: true,
    summary: {
      nbProspects: Number(data.nb_prospects),
      nbOublies: Number(data.nb_oublies),
      caRecuperable: Number(data.ca_recuperable_eur),
    },
  };
}
