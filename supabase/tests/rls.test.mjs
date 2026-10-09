// Applique toutes les migrations sur un Postgres embarqué avec un schéma `auth` simulé,
// puis vérifie contraintes, triggers et Row Level Security.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../migrations/", import.meta.url);
const migration = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
const db = new PGlite();
let failures = 0;
const ok = (label, cond) => { console.log(`${cond ? "OK  " : "FAIL"} ${label}`); if (!cond) failures++; };
const expectError = async (label, sql, params) => {
  try { await db.query(sql, params); ok(label + " (refusé)", false); }
  catch (e) { ok(label + " (refusé : " + e.message.split("\n")[0].slice(0, 70) + ")", true); }
};

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
await db.exec(migration);
ok("migration appliquée", true);

const A = "11111111-1111-1111-1111-111111111111", B = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users (id, email) values ($1, 'a@ex.fr'), ($2, 'b@ex.fr')", [A, B]);
const u = await db.query("select id, email, seuil_inactivite_jours, ton_relance from public.utilisateurs order by email");
ok("trigger d'inscription crée 2 utilisateurs avec défauts", u.rows.length === 2 && u.rows[0].seuil_inactivite_jours === 21 && u.rows[0].ton_relance === "direct");
await db.query("update auth.users set email = 'a2@ex.fr' where id = $1", [A]);
ok("email synchronisé", (await db.query("select email from public.utilisateurs where id = $1", [A])).rows[0].email === "a2@ex.fr");

const as = async (uid) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]); await db.exec(uid ? "set role authenticated" : "set role anon"); };

// --- Utilisateur A
await as(A);
const pa = await db.query(`insert into public.prospects (utilisateur_id, entreprise, contact_email, montant_eur, etape, est_oublie, ca_recuperable_eur, statut)
  values ($1, 'Acme SAS', 'claire@acme.fr', 15000, 'proposition', true, 4870, 'a_traiter') returning id`, [A]);
const pidA = pa.rows[0].id;
await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, statut) values ($1, 'Gagné SA', 9000, 'negociation', 'gagne')`, [A]);
const gagne = (await db.query("select id from public.prospects where entreprise = 'Gagné SA'")).rows[0].id;
await db.query("insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton, copiee_le) values ($1, $2, 'o', 'c', 'direct', now())", [gagne, A]);
ok("A lit ses 2 prospects", (await db.query("select count(*)::int n from public.prospects")).rows[0].n === 2);
await expectError("A insère un prospect pour B", "insert into public.prospects (utilisateur_id, entreprise) values ($1, 'X')", [B]);
await expectError("doublon (utilisateur, email, entreprise) à l'import", "insert into public.prospects (utilisateur_id, entreprise, contact_email) values ($1, 'Acme SAS', 'claire@acme.fr')", [A]);
await db.query("insert into public.prospects (utilisateur_id, entreprise) values ($1, 'SansEmail')", [A]);
await expectError("doublon sans email (nulls not distinct)", "insert into public.prospects (utilisateur_id, entreprise) values ($1, 'SansEmail')", [A]);
await expectError("score hors bornes", "update public.prospects set score = 140 where id = $1", [pidA]);
await expectError("A modifie son email", "update public.utilisateurs set email = 'pirate@ex.fr' where id = $1", [A]);
await db.query("update public.utilisateurs set nom = 'Alice', seuil_inactivite_jours = 30 where id = $1", [A]);
ok("A modifie ses réglages", (await db.query("select nom from public.utilisateurs")).rows[0].nom === "Alice");
const kpi = (await db.query("select * from public.tableau_de_bord()")).rows[0];
ok(`tableau_de_bord : 3 prospects, 1 oublié, 4870 € récupérable, 9000 € récupéré → ${JSON.stringify(kpi)}`,
  Number(kpi.nb_prospects) === 3 && Number(kpi.nb_oublies) === 1 && Number(kpi.ca_recuperable_eur) === 4870 && Number(kpi.ca_recupere_eur) === 9000);

// --- Utilisateur B
await as(B);
ok("B ne voit aucun prospect de A", (await db.query("select count(*)::int n from public.prospects")).rows[0].n === 0);
ok("B ne voit que sa ligne utilisateurs", (await db.query("select count(*)::int n from public.utilisateurs")).rows[0].n === 1);
ok("B ne voit aucune relance de A", (await db.query("select count(*)::int n from public.relances")).rows[0].n === 0);
const upd = await db.query("update public.prospects set statut = 'perdu' where id = $1", [pidA]);
ok("B ne peut pas modifier un prospect de A", upd.affectedRows === 0);
const del = await db.query("delete from public.prospects where id = $1", [pidA]);
ok("B ne peut pas supprimer un prospect de A", del.affectedRows === 0);
await expectError("B rattache une relance au prospect de A", "insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton) values ($1, $2, 'o', 'c', 'direct')", [pidA, B]);
ok("tableau_de_bord de B vide", Number((await db.query("select * from public.tableau_de_bord()")).rows[0].nb_prospects) === 0);

// --- Anonyme
await as(null);
await expectError("anon lit les prospects", "select * from public.prospects");
await expectError("anon appelle tableau_de_bord", "select * from public.tableau_de_bord()");
await expectError("authenticated appelle une fonction de trigger", "select public.creer_utilisateur()");

// --- Import et calcul (migration import_et_calcul)
await as(A);
await db.query("update public.utilisateurs set seuil_inactivite_jours = 21, panier_moyen_eur = 8000 where id = $1", [A]);
await db.query(`insert into public.prospects (utilisateur_id, entreprise, contact_email, contact_telephone, montant_eur, etape, date_dernier_contact)
  values ($1, 'Calc Proposition', 'p@calc.fr', '06 12 34 56 78', 15000, 'proposition', current_date - 34),
         ($1, 'Calc Récent', 'r@calc.fr', null, 15000, 'proposition', current_date - 5),
         ($1, 'Calc Sans montant', 's@calc.fr', null, null, 'negociation', current_date - 30),
         ($1, 'Calc Gagné', 'g@calc.fr', null, 50000, 'gagne', current_date - 90),
         ($1, 'Calc Sans date', 'd@calc.fr', null, 9000, 'proposition', null),
         ($1, 'Calc Étape inconnue', 'e@calc.fr', null, 10000, null, current_date - 40)`, [A]);
await db.query("update public.prospects set statut = 'relance' where entreprise = 'Calc Proposition'");
// Ré-import (même clé utilisateur + email + entreprise) : met à jour sans doublon ni écraser le statut.
await db.query(`insert into public.prospects (utilisateur_id, entreprise, contact_email, montant_eur, etape, date_dernier_contact)
  values ($1, 'Calc Proposition', 'p@calc.fr', 15000, 'proposition', current_date - 34)
  on conflict (utilisateur_id, contact_email, entreprise) do update set montant_eur = excluded.montant_eur, importe_le = now()`, [A]);
await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur) values ($1, 'SansEmail', 1)
  on conflict (utilisateur_id, contact_email, entreprise) do update set montant_eur = excluded.montant_eur`, [A]);
ok("ré-import : aucun doublon (email nul compris)", (await db.query("select count(*)::int n from public.prospects where entreprise in ('Calc Proposition', 'SansEmail')")).rows[0].n === 2);
ok("ré-import : statut LeadPilot conservé", (await db.query("select statut from public.prospects where entreprise = 'Calc Proposition'")).rows[0].statut === "relance");
const updated = (await db.query("select public.recalculer_prospects() as n")).rows[0].n;
ok(`recalculer_prospects met à jour des lignes (${updated})`, updated > 0);
const calc = Object.fromEntries((await db.query("select entreprise, est_oublie, proba_recuperation::float p, ca_recuperable_eur::float ca, score from public.prospects where entreprise like 'Calc %'")).rows.map((r) => [r.entreprise, r]));
ok(`proposition à 34 j : p = 0,4 × (1 − 34/180) = 0,3244, CA 4 866,67 €, oublié → ${JSON.stringify(calc["Calc Proposition"])}`,
  calc["Calc Proposition"].est_oublie === true && calc["Calc Proposition"].p === 0.3244 && calc["Calc Proposition"].ca === 4866.67);
ok("contact récent (5 j < 21 j) : non oublié", calc["Calc Récent"].est_oublie === false);
ok(`montant absent : panier moyen 8 000 € × 0,6 × (1 − 30/180) = 4 000 € → ${calc["Calc Sans montant"].ca}`, calc["Calc Sans montant"].ca === 4000);
ok("affaire gagnée : ni oubliée ni chiffrée", calc["Calc Gagné"].est_oublie === false && calc["Calc Gagné"].ca === null);
ok("date de contact absente : non oublié, pas de CA", calc["Calc Sans date"].est_oublie === false && calc["Calc Sans date"].ca === null);
ok(`étape inconnue : poids 0,20 → CA ${calc["Calc Étape inconnue"].ca}`, calc["Calc Étape inconnue"].ca === Math.round(10000 * 0.2 * (1 - 40 / 180) * 100) / 100);
const maxScore = (await db.query("select max(score)::int m from public.prospects")).rows[0].m;
ok("score ramené à 100 pour le meilleur prospect ouvert", maxScore === 100);
ok("second recalcul sans changement : 0 ligne réécrite", (await db.query("select public.recalculer_prospects() as n")).rows[0].n === 0);
ok("A vise le compte de B (recalculer_prospects_de) : RLS → 0 ligne", (await db.query("select public.recalculer_prospects_de($1) as n", [B])).rows[0].n === 0);
await expectError("authenticated lance le recalcul global", "select public.recalculer_tous_les_prospects()");
await as(B);
ok("recalcul de B sans effet sur A", (await db.query("select public.recalculer_prospects() as n")).rows[0].n === 0);
await as(null);
await expectError("anon lance un recalcul", "select public.recalculer_prospects()");
await db.exec("reset role");
await db.query("update public.prospects set score = null where entreprise = 'Calc Proposition'");
await db.query("select public.recalculer_tous_les_prospects()");
ok("recalcul global (cron, propriétaire des tables) recalcule tous les comptes",
  (await db.query("select score from public.prospects where entreprise = 'Calc Proposition'")).rows[0].score === 83);

// --- Relances par modèles (action prepareFollowup) : brouillon réécrit par son propriétaire seulement
await as(A);
const brouillon = (await db.query(
  "insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton, modele_ia) values ($1, $2, 'o', 'c', 'direct', 'modele:suivi_echange') returning id",
  [pidA, A]
)).rows[0].id;
await db.query("update public.relances set objet = 'Prochaines étapes', corps = 'Bonjour', ton = 'formel', modele_ia = 'modele:decision' where id = $1", [brouillon]);
ok("A réécrit son brouillon (modèle et ton)", (await db.query("select modele_ia, ton from public.relances where id = $1", [brouillon])).rows[0].modele_ia === "modele:decision");
await as(B);
const reecriture = await db.query("update public.relances set corps = 'piraté' where id = $1", [brouillon]);
ok("B ne peut pas réécrire le brouillon de A", reecriture.affectedRows === 0);
await as(A);
await db.query("delete from public.relances where id = $1", [brouillon]);

// --- Séparation stricte entre comptes (agences) : cas complémentaires
await as(A);
const relanceA = (await db.query(
  "insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton) values ($1, $2, 'o', 'c', 'direct') returning id",
  [pidA, A]
)).rows[0].id;
await as(B);
const suppressionRelance = await db.query("delete from public.relances where id = $1", [relanceA]);
ok("B ne peut pas supprimer une relance de A", suppressionRelance.affectedRows === 0);
const pidB = (await db.query("insert into public.prospects (utilisateur_id, entreprise) values ($1, 'Transfert SA') returning id", [B])).rows[0].id;
await expectError("B transfère son prospect vers le compte de A", "update public.prospects set utilisateur_id = $1 where id = $2", [A, pidB]);
await db.query("delete from public.prospects where id = $1", [pidB]);
await as(A);
await db.query("delete from public.relances where id = $1", [relanceA]);

// --- Kanban « Mes dossiers » : changement d'étape puis recalcul (action updateProspectStage)
await as(A);
await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, date_dernier_contact)
  values ($1, 'Kanban SAS', 10000, 'decouverte', current_date - 30)`, [A]);
await db.query("select public.recalculer_prospects()");
const caAvant = Number((await db.query("select ca_recuperable_eur from public.prospects where entreprise = 'Kanban SAS'")).rows[0].ca_recuperable_eur);
await db.query("update public.prospects set etape = 'negociation' where entreprise = 'Kanban SAS' and utilisateur_id = $1", [A]);
await db.query("select public.recalculer_prospects()");
const caApres = Number((await db.query("select ca_recuperable_eur from public.prospects where entreprise = 'Kanban SAS'")).rows[0].ca_recuperable_eur);
ok("A déplace son dossier en négociation : argent récupérable recalculé (×6)", Math.abs(caApres - caAvant * 6) < 0.05);
await as(B);
const deplacement = await db.query("update public.prospects set etape = 'perdu' where entreprise = 'Kanban SAS'");
ok("B ne peut pas déplacer un dossier de A", deplacement.affectedRows === 0);
await as(A);
await db.query("delete from public.prospects where entreprise = 'Kanban SAS' and utilisateur_id = $1", [A]);
await db.query("select public.recalculer_prospects()");

// --- Taux de commission (migration taux_commission)
await as(A);
await db.query("update public.utilisateurs set taux_commission = 4.5 where id = $1", [A]);
ok("A renseigne son taux de commission", Number((await db.query("select taux_commission from public.utilisateurs where id = $1", [A])).rows[0].taux_commission) === 4.5);
await expectError("taux de commission > 100 %", "update public.utilisateurs set taux_commission = 150 where id = $1", [A]);
await db.query("update public.utilisateurs set taux_commission = null where id = $1", [A]);
await as(B);
const pirate = await db.query("update public.utilisateurs set taux_commission = 9 where id = $1", [A]);
ok("B ne peut pas modifier le taux de A", pirate.affectedRows === 0);

// --- Droits minimaux
await as(A);
await expectError("authenticated vide une table (TRUNCATE contourne la RLS)", "truncate public.prospects");

// --- Cascade
await db.exec("reset role");
await db.query("delete from auth.users where id = $1", [A]);
ok("suppression du compte → cascade sur prospects et relances",
  (await db.query("select (select count(*) from public.prospects)::int p, (select count(*) from public.relances)::int r")).rows[0].p === 0);

console.log(failures ? `\n${failures} échec(s)` : "\nTous les tests passent");
process.exit(failures ? 1 : 0);
