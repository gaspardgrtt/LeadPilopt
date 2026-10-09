import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { ProspectStatus } from "@/lib/prospects";
import type { Tables } from "@/types/database";
import { buildScoreContext, type ScoreContext } from "@/lib/scoring/score";

// Lectures des écrans E3 à E5. Toutes passent par le client de l'utilisateur connecté :
// la Row Level Security limite les résultats à ses propres données ; le filtre explicite sur
// utilisateur_id permet en plus à Postgres d'utiliser les index.

export type Prospect = Tables<"prospects">;
export type Relance = Tables<"relances">;
export type Profil = Tables<"utilisateurs">;

const LIST_COLUMNS =
  "id, entreprise, contact_nom, contact_email, montant_eur, etape, date_dernier_contact, est_oublie, score, ca_recuperable_eur, statut" as const;

export type ProspectListItem = Pick<
  Prospect,
  | "id"
  | "entreprise"
  | "contact_nom"
  | "contact_email"
  | "montant_eur"
  | "etape"
  | "date_dernier_contact"
  | "est_oublie"
  | "score"
  | "ca_recuperable_eur"
  | "statut"
>;

class DataError extends Error {
  constructor(context: string, cause: { message: string; code?: string }) {
    super(`${context} : ${cause.message}`);
    this.name = "DataError";
  }
}

export const getProfil = cache(async (): Promise<Profil | null> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("utilisateurs").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new DataError("Lecture du profil", error);
  return data;
});

export type DashboardStats = {
  nbProspects: number;
  nbAffairesOuvertes: number;
  nbOublies: number;
  caRecuperable: number;
  caRecupere: number;
  nbGagnesApresRelance: number;
  dernierImportLe: string | null;
};

export const getDashboardStats = cache(async (): Promise<DashboardStats> => {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tableau_de_bord").single();
  if (error) throw new DataError("Lecture du tableau de bord", error);
  return {
    nbProspects: Number(data.nb_prospects),
    nbAffairesOuvertes: Number(data.nb_affaires_ouvertes),
    nbOublies: Number(data.nb_oublies),
    caRecuperable: Number(data.ca_recuperable_eur),
    caRecupere: Number(data.ca_recupere_eur),
    nbGagnesApresRelance: Number(data.nb_gagnes_apres_relance),
    dernierImportLe: data.dernier_import_le,
  };
});

/** Top des opportunités du tableau de bord : oubliés « à traiter », par CA récupérable. */
export async function getTopOpportunities(limit = 10): Promise<ProspectListItem[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select(LIST_COLUMNS)
    .eq("utilisateur_id", user.id)
    .eq("est_oublie", true)
    .eq("statut", "a_traiter")
    .order("ca_recuperable_eur", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(limit);
  if (error) throw new DataError("Lecture des opportunités", error);
  return data;
}

export type ProspectView = "oublies" | "tous";
export type ProspectSort = "ca" | "score" | "montant" | "silence" | "entreprise";

export type ProspectFilters = {
  view: ProspectView;
  statuses: ProspectStatus[];
  sort: ProspectSort;
};

const SORT_COLUMNS: Record<ProspectSort, { column: keyof ProspectListItem; ascending: boolean }> = {
  ca: { column: "ca_recuperable_eur", ascending: false },
  score: { column: "score", ascending: false },
  montant: { column: "montant_eur", ascending: false },
  silence: { column: "date_dernier_contact", ascending: true },
  entreprise: { column: "entreprise", ascending: true },
};

/** Liste E4. Plafonnée à 5 000 lignes, la limite d'un import. */
export async function getProspects(filters: ProspectFilters): Promise<ProspectListItem[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const sort = SORT_COLUMNS[filters.sort];

  let query = supabase.from("prospects").select(LIST_COLUMNS).eq("utilisateur_id", user.id);
  if (filters.view === "oublies") query = query.eq("est_oublie", true);
  if (filters.statuses.length > 0) query = query.in("statut", filters.statuses);

  const { data, error } = await query
    .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
    .order("id")
    .limit(5000);
  if (error) throw new DataError("Lecture des prospects", error);
  return data;
}

export type ProspectCounts = { oublies: number; tous: number };

export const getProspectCounts = cache(async (): Promise<ProspectCounts> => {
  const user = await requireUser();
  const supabase = await createClient();
  const [oublies, tous] = await Promise.all([
    supabase
      .from("prospects")
      .select("id", { count: "exact", head: true })
      .eq("utilisateur_id", user.id)
      .eq("est_oublie", true)
      .eq("statut", "a_traiter"),
    supabase.from("prospects").select("id", { count: "exact", head: true }).eq("utilisateur_id", user.id),
  ]);
  if (oublies.error) throw new DataError("Comptage des prospects oubliés", oublies.error);
  if (tous.error) throw new DataError("Comptage des prospects", tous.error);
  return { oublies: oublies.count ?? 0, tous: tous.count ?? 0 };
});

export type ProspectDetail = {
  prospect: Prospect;
  relance: Relance | null;
  position: { index: number; total: number; previousId: string | null; nextId: string | null } | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

/** Fiche E5 : le prospect, sa dernière relance et sa position dans la liste « oubliés ». */
export async function getProspectDetail(id: string): Promise<ProspectDetail | null> {
  if (!isUuid(id)) return null;
  const user = await requireUser();
  const supabase = await createClient();

  const [prospectResult, relanceResult, orderResult] = await Promise.all([
    supabase.from("prospects").select("*").eq("utilisateur_id", user.id).eq("id", id).maybeSingle(),
    supabase
      .from("relances")
      .select("*")
      .eq("utilisateur_id", user.id)
      .eq("prospect_id", id)
      .order("cree_le", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("prospects")
      .select("id")
      .eq("utilisateur_id", user.id)
      .eq("est_oublie", true)
      .order("ca_recuperable_eur", { ascending: false, nullsFirst: false })
      .order("id")
      .limit(5000),
  ]);

  if (prospectResult.error) throw new DataError("Lecture du prospect", prospectResult.error);
  if (relanceResult.error) throw new DataError("Lecture de la relance", relanceResult.error);
  if (orderResult.error) throw new DataError("Lecture de l'ordre des prospects", orderResult.error);
  if (!prospectResult.data) return null;

  const ids = orderResult.data.map((row) => row.id);
  const index = ids.indexOf(id);

  return {
    prospect: prospectResult.data,
    relance: relanceResult.data,
    position:
      index === -1
        ? null
        : {
            index: index + 1,
            total: ids.length,
            previousId: ids[index - 1] ?? null,
            nextId: ids[index + 1] ?? null,
          },
  };
}

export type SilenceBucket = { label: string; total: number; count: number };

const SILENCE_BUCKETS = [
  { label: "Moins de 30 j", max: 29 },
  { label: "30 à 59 j", max: 59 },
  { label: "60 à 89 j", max: 89 },
  { label: "90 à 179 j", max: 179 },
  { label: "180 j et plus", max: Number.POSITIVE_INFINITY },
];

/**
 * Graphique E3 : CA récupérable des prospects oubliés (à traiter ou relancés, comme la carte KPI),
 * réparti par ancienneté du dernier contact.
 */
export async function getRecoverableBySilence(): Promise<SilenceBucket[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prospects")
    .select("date_dernier_contact, ca_recuperable_eur")
    .eq("utilisateur_id", user.id)
    .eq("est_oublie", true)
    .in("statut", ["a_traiter", "relance"])
    .limit(5000);
  if (error) throw new DataError("Lecture de la répartition par ancienneté", error);

  const buckets = SILENCE_BUCKETS.map((bucket) => ({ label: bucket.label, total: 0, count: 0 }));
  const today = Date.now();
  for (const row of data) {
    if (!row.date_dernier_contact || row.ca_recuperable_eur === null) continue;
    const days = Math.floor((today - new Date(row.date_dernier_contact).getTime()) / 86_400_000);
    const index = SILENCE_BUCKETS.findIndex((bucket) => days <= bucket.max);
    buckets[index].total += Number(row.ca_recuperable_eur);
    buckets[index].count += 1;
  }
  return buckets;
}

/**
 * Contexte de « Pourquoi ce score ? » : meilleure affaire (référence 100) et prospect moyen du compte,
 * calculés sur toutes les affaires ouvertes. Mémorisé pour la requête.
 */
export const getScoreContext = cache(async (): Promise<ScoreContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  const [prospects, profil] = await Promise.all([
    supabase
      .from("prospects")
      .select("entreprise, montant_eur, etape, date_dernier_contact")
      .eq("utilisateur_id", user.id)
      .limit(5000),
    getProfil(),
  ]);
  if (prospects.error) throw new DataError("Lecture du contexte de score", prospects.error);
  return buildScoreContext(prospects.data, profil?.panier_moyen_eur ?? null);
});

/** Minuit (heure de Paris) du jour courant, en ISO UTC. */
function startOfParisDay(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  );
  const parisAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = parisAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset).toISOString();
}

export type DailyProgress = { done: number; total: number };

/**
 * Progression du brief : dossiers dont une relance a été envoyée aujourd'hui (Gmail ou copie),
 * sur ces dossiers + les opportunités encore à relancer (un même dossier n'est compté qu'une fois).
 */
export async function getDailyProgress(): Promise<DailyProgress> {
  const user = await requireUser();
  const supabase = await createClient();
  const [sent, pending] = await Promise.all([
    supabase.from("relances").select("prospect_id").eq("utilisateur_id", user.id).gte("copiee_le", startOfParisDay()),
    supabase
      .from("prospects")
      .select("id")
      .eq("utilisateur_id", user.id)
      .eq("est_oublie", true)
      .eq("statut", "a_traiter")
      .limit(5000),
  ]);
  if (sent.error) throw new DataError("Lecture de la progression du jour", sent.error);
  if (pending.error) throw new DataError("Lecture de la progression du jour", pending.error);
  const done = new Set(sent.data.map((row) => row.prospect_id));
  const remaining = pending.data.filter((row) => !done.has(row.id)).length;
  return { done: done.size, total: done.size + remaining };
}

/** Onboarding : au moins une relance envoyée (Gmail ou copie) sur le compte. */
export async function hasSentFollowup(): Promise<boolean> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("relances")
    .select("id", { count: "exact", head: true })
    .eq("utilisateur_id", user.id)
    .not("copiee_le", "is", null);
  if (error) throw new DataError("Lecture de l'onboarding", error);
  return (count ?? 0) > 0;
}

export type WeeklyActivity = { generated: number; copied: number };

/** Activité des 7 derniers jours : relances rédigées par l'IA et relances copiées pour envoi. */
export async function getWeeklyActivity(): Promise<WeeklyActivity> {
  const user = await requireUser();
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [generated, copied] = await Promise.all([
    supabase.from("relances").select("id", { count: "exact", head: true }).eq("utilisateur_id", user.id).gte("cree_le", since),
    supabase.from("relances").select("id", { count: "exact", head: true }).eq("utilisateur_id", user.id).gte("copiee_le", since),
  ]);
  if (generated.error) throw new DataError("Lecture de l'activité", generated.error);
  if (copied.error) throw new DataError("Lecture de l'activité", copied.error);
  return { generated: generated.count ?? 0, copied: copied.count ?? 0 };
}
