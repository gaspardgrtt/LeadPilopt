// Préservation des données par la dernière migration : on construit le schéma tel qu'il est avant
// elle (toutes les migrations précédentes), on le remplit de données variées, on prend un instantané,
// puis on applique la dernière migration et on vérifie qu'aucune ligne ni aucune valeur n'a changé.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const last = files.at(-1);
const read = (f) => readFileSync(new URL(f, dir), "utf8");
const db = new PGlite();
let failures = 0;
const ok = (label, cond) => { console.log(`${cond ? "OK  " : "FAIL"} ${label}`); if (!cond) failures++; };

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
for (const f of files.slice(0, -1)) await db.exec(read(f));
console.log(`Schéma avant « ${last} » : ${files.length - 1} migrations appliquées`);

// Données représentatives de la production (propriétaire des tables, sans RLS).
const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users (id, email) values ($1, 'a@ex.fr'), ($2, 'b@ex.fr')", [A, B]);
await db.query("update public.utilisateurs set nom = 'Alice', taux_commission = 4.5, signature = 'Alice\nAgence', theme = 'sombre', langue = 'en' where id = $1", [A]);
await db.exec(`
  insert into public.prospects (id, utilisateur_id, entreprise, contact_email, contact_nom, montant_eur, etape, etape_brute, date_dernier_contact, notes, donnees_brutes, statut, opposition_prospection_le, contact_telephone)
  values
    ('aaaaaaaa-0000-4000-8000-000000000001', '${A}', 'Acme SAS', 'claire@acme.fr', 'Claire', 15000, 'proposition', 'Proposition envoyée', current_date - 34, 'Attend le budget', '{"col": "val"}', 'a_traiter', null, '06 12 34 56 78'),
    ('aaaaaaaa-0000-4000-8000-000000000002', '${A}', 'Gagné SA', null, null, 9000, 'gagne', null, current_date - 5, null, '{}', 'gagne', null, null),
    ('aaaaaaaa-0000-4000-8000-000000000003', '${A}', 'Sans date', 'x@y.fr', null, null, null, 'Inconnue', null, null, '{}', 'relance', now() - interval '3 days', null),
    ('aaaaaaaa-0000-4000-8000-000000000004', '${B}', 'Autre compte', 'z@b.fr', 'Zoé', 120000, 'negociation', null, current_date - 90, 'Note B', '{}', 'ignore', null, null);
  insert into public.relances (id, prospect_id, utilisateur_id, objet, corps, ton, modele_ia, copiee_le, cree_le)
  values
    ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '${A}', 'Objet brouillon', 'Corps brouillon', 'direct', 'modele:decision', null, now() - interval '2 days'),
    ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '${A}', 'Objet copié', 'Corps copié', 'formel', 'modele:suivi_proposition', now() - interval '1 day', now() - interval '1 day'),
    ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000002', '${A}', 'Objet envoyé', 'Corps envoyé', 'chaleureux', null, now(), now()),
    ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000004', '${B}', 'Objet échec', 'Corps échec', 'direct', null, null, now());
  update public.relances set envoi_statut = 'envoyee', envoi_demande_le = now(), envoyee_le = now(), envoyee_a = 'claire@acme.fr', brevo_message_id = '<1@relay>' where id = 'bbbbbbbb-0000-4000-8000-000000000003';
  update public.relances set envoi_statut = 'echec', envoi_demande_le = now(), envoi_erreur = 'Brevo indisponible' where id = 'bbbbbbbb-0000-4000-8000-000000000004';
`);
await db.query("select public.recalculer_tous_les_prospects()");

const snapshot = async () => {
  const out = {};
  for (const table of ["utilisateurs", "prospects", "relances"]) {
    out[table] = (await db.query(`select to_jsonb(t) j from public.${table} t order by id`)).rows.map((r) => r.j);
  }
  return out;
};
const before = await snapshot();
const kpiBefore = {};
for (const uid of [A, B]) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  kpiBefore[uid] = (await db.query("select * from public.tableau_de_bord()")).rows[0];
}
await db.query("select set_config('request.jwt.claim.sub', '', false)");

await db.exec(read(last));
ok(`migration « ${last} » appliquée sans erreur sur des données existantes`, true);
const after = await snapshot();

for (const table of Object.keys(before)) {
  ok(`${table} : même nombre de lignes (${before[table].length} → ${after[table].length})`, before[table].length === after[table].length);
  let changed = 0;
  for (let i = 0; i < before[table].length; i++) {
    for (const [column, value] of Object.entries(before[table][i])) {
      if (JSON.stringify(after[table][i][column]) !== JSON.stringify(value)) changed++;
    }
  }
  ok(`${table} : aucune valeur existante modifiée (${changed} écart)`, changed === 0);
}
const newRelanceCols = after.relances.map((r) => [r.type, r.canal, r.resume, r.effectuee_le, r.prochaine_action_le]);
ok("relances existantes : type « brouillon », nouvelles colonnes vides", newRelanceCols.every(([type, ...rest]) => type === "brouillon" && rest.every((v) => v === null)));
ok("prospects existants : aucune prochaine action inventée", after.prospects.every((p) => p.prochaine_action_le === null));
if (after.prospects[0].cle_import !== undefined) {
  const keys = after.prospects.map((p) => `${p.utilisateur_id}|${p.cle_import}`);
  ok("prospects existants : clé d'import calculée pour chaque ligne, sans doublon", keys.every((k) => !k.endsWith("|null")) && new Set(keys).size === keys.length);
}
for (const uid of [A, B]) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  const kpi = (await db.query("select * from public.tableau_de_bord()")).rows[0];
  ok(`tableau de bord du compte ${uid === A ? "A" : "B"} inchangé hors indicateurs redéfinis`,
    ["nb_prospects", "nb_affaires_ouvertes", "nb_oublies", "ca_recuperable_eur", "dernier_import_le"].every((k) => String(kpi[k]) === String(kpiBefore[uid][k])));
}
const recalcul = (await db.query("select public.recalculer_tous_les_prospects() n")).rows[0].n;
ok(`recalcul après migration : aucun score modifié (${recalcul} ligne)`, recalcul === 0);

console.log(failures ? `\n${failures} échec(s)` : "\nDonnées préservées : tous les contrôles passent");
process.exit(failures ? 1 : 0);
