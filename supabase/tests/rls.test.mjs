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
// --- Particuliers (sans entreprise) : jamais d'entreprise inventée, dédoublonnage par e-mail ou nom + téléphone
await db.query("insert into public.prospects (utilisateur_id, contact_nom, contact_email) values ($1, 'Jean Martin', 'jean.martin@example.com')", [A]);
await expectError("particulier en double (même nom, même e-mail)", "insert into public.prospects (utilisateur_id, contact_nom, contact_email) values ($1, 'JEAN MARTIN ', 'jean.martin@example.com')", [A]);
await db.query("insert into public.prospects (utilisateur_id, contact_nom, contact_email) values ($1, 'Marie Martin', 'jean.martin@example.com')", [A]);
ok("deux personnes avec la même adresse (couple) restent deux prospects", (await db.query("select count(*)::int n from public.prospects where contact_email = 'jean.martin@example.com'")).rows[0].n === 2);
await db.query("insert into public.prospects (utilisateur_id, contact_nom, contact_telephone) values ($1, 'Sophie Bernard', '0600000002'), ($1, 'Lucas Petit', '0600000003')", [A]);
ok("deux particuliers sans e-mail ne sont pas fusionnés", (await db.query("select count(*)::int n from public.prospects where entreprise is null and contact_email is null")).rows[0].n === 2);
await expectError("particulier sans e-mail en double (même nom, casse différente, même téléphone)", "insert into public.prospects (utilisateur_id, contact_nom, contact_telephone) values ($1, 'sophie bernard', '0600000002')", [A]);
await expectError("prospect sans entreprise ni nom", "insert into public.prospects (utilisateur_id, contact_email) values ($1, 'anonyme@example.com')", [A]);
await expectError("prospect sans entreprise avec un nom vide", "insert into public.prospects (utilisateur_id, contact_nom) values ($1, '   ')", [A]);
await db.query(`insert into public.prospects (utilisateur_id, contact_nom, contact_email, notes) values ($1, 'Jean Martin', 'jean.martin@example.com', 'ré-import')
  on conflict (utilisateur_id, cle_import) do update set notes = excluded.notes`, [A]);
ok("ré-import d'un particulier : mis à jour sans doublon", (await db.query("select count(*)::int n from public.prospects where contact_nom = 'Jean Martin' and notes = 'ré-import'")).rows[0].n === 1 && (await db.query("select count(*)::int n from public.prospects where contact_email = 'jean.martin@example.com'")).rows[0].n === 2);
ok("un particulier n'a pas d'entreprise inventée", (await db.query("select entreprise from public.prospects where contact_nom = 'Jean Martin'")).rows[0].entreprise === null);
await expectError("cle_import ne peut pas être écrite par l'application", "update public.prospects set cle_import = 'x' where contact_email = 'jean.martin@example.com'");
await db.query("delete from public.prospects where entreprise is null and utilisateur_id = $1", [A]);
// --- Fichier de démonstration (40 particuliers) importé deux fois avec la clé d'import de l'application
{
  const csv = readFileSync(new URL("../../src/lib/import/__fixtures__/izmo_test_prospects_agence.csv", import.meta.url), "utf8").replace(/^\uFEFF/, "");
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(",");
  const rows = lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [cols[i], v])));
  const importer = async () => {
    for (const r of rows) {
      await db.query(`insert into public.prospects (utilisateur_id, entreprise, contact_nom, contact_email, contact_telephone, date_dernier_contact, notes, donnees_brutes)
        values ($1, null, $2, $3, $4, $5, $6, $7)
        on conflict (utilisateur_id, cle_import) do update set notes = excluded.notes, date_dernier_contact = excluded.date_dernier_contact`,
        [A, `${r.prenom} ${r.nom}`, r.email, r.telephone, r.dernier_contact, r.notes, JSON.stringify(r)]);
    }
  };
  await importer();
  await importer();
  const imported = (await db.query("select count(*)::int n, count(*) filter (where entreprise is null)::int sans_entreprise, count(distinct contact_nom)::int noms from public.prospects where import_id is null and contact_email like '%@example.com'")).rows[0];
  ok(`fichier de démonstration importé deux fois : 40 prospects, aucun doublon, aucune entreprise inventée (${JSON.stringify(imported)})`,
    imported.n === 40 && imported.sans_entreprise === 40 && imported.noms === 40);
  await db.query("delete from public.prospects where entreprise is null and utilisateur_id = $1", [A]);
}
await expectError("score hors bornes", "update public.prospects set score = 140 where id = $1", [pidA]);
await expectError("A modifie son email", "update public.utilisateurs set email = 'pirate@ex.fr' where id = $1", [A]);
await db.query("update public.utilisateurs set nom = 'Alice', seuil_inactivite_jours = 30 where id = $1", [A]);
ok("A modifie ses réglages", (await db.query("select nom from public.utilisateurs")).rows[0].nom === "Alice");
const kpi = (await db.query("select * from public.tableau_de_bord()")).rows[0];
ok(`tableau_de_bord : 3 prospects, 1 oublié, 4870 € récupérable ; brouillon seulement copié → rien « récupéré » → ${JSON.stringify(kpi)}`,
  Number(kpi.nb_prospects) === 3 && Number(kpi.nb_oublies) === 1 && Number(kpi.ca_recuperable_eur) === 4870 && Number(kpi.ca_recupere_eur) === 0);
await db.query("update public.relances set envoi_statut = 'envoyee', envoyee_le = now(), envoyee_a = 'x@gagne.fr' where prospect_id = $1", [gagne]);
const kpiEnvoye = (await db.query("select * from public.tableau_de_bord()")).rows[0];
ok("tableau_de_bord : après un envoi confirmé, 9 000 € « gagnés après une relance »", Number(kpiEnvoye.ca_recupere_eur) === 9000 && Number(kpiEnvoye.nb_gagnes_apres_relance) === 1);

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
  on conflict (utilisateur_id, cle_import) do update set montant_eur = excluded.montant_eur, importe_le = now()`, [A]);
await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur) values ($1, 'SansEmail', 1)
  on conflict (utilisateur_id, cle_import) do update set montant_eur = excluded.montant_eur`, [A]);
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

// --- Envoi par e-mail (Brevo) : réservation atomique, isolation, opposition (migration envoi_email_brevo)
await as(A);
const aEnvoyer = (await db.query(
  "insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton) values ($1, $2, 'Objet', 'Corps', 'direct') returning id",
  [pidA, A]
)).rows[0].id;
const reserver = "update public.relances set envoi_statut = 'en_cours', envoi_demande_le = now() where id = $1 and (envoi_statut is null or envoi_statut = 'echec') returning id";
await as(B);
ok("B ne peut pas réserver l'envoi d'une relance de A", (await db.query(reserver, [aEnvoyer])).rows.length === 0);
await as(A);
ok("A réserve l'envoi de sa relance", (await db.query(reserver, [aEnvoyer])).rows.length === 1);
ok("double envoi : une seconde réservation est refusée", (await db.query(reserver, [aEnvoyer])).rows.length === 0);
await expectError("statut « envoyée » sans date ni destinataire", "update public.relances set envoi_statut = 'envoyee' where id = $1", [aEnvoyer]);
await db.query("update public.relances set envoi_statut = 'envoyee', envoyee_le = now(), envoyee_a = 'jonas@exemple.fr', brevo_message_id = '<1@smtp-relay>' where id = $1", [aEnvoyer]);
ok("relance envoyée : statut et identifiant Brevo enregistrés", (await db.query("select envoi_statut, brevo_message_id from public.relances where id = $1", [aEnvoyer])).rows[0].brevo_message_id === "<1@smtp-relay>");
ok("relance envoyée : plus aucune réservation possible", (await db.query(reserver, [aEnvoyer])).rows.length === 0);
await db.query("delete from public.relances where id = $1", [aEnvoyer]);
await db.query("update public.prospects set opposition_prospection_le = now() where id = $1", [pidA]);
ok("A enregistre l'opposition de son prospect", (await db.query("select opposition_prospection_le from public.prospects where id = $1", [pidA])).rows[0].opposition_prospection_le !== null);
await as(B);
ok("B ne peut pas lever l'opposition d'un prospect de A", (await db.query("update public.prospects set opposition_prospection_le = null where id = $1", [pidA])).affectedRows === 0);
await as(A);
await db.query("update public.prospects set opposition_prospection_le = null where id = $1", [pidA]);

// --- Préférences d'affichage (migration preferences_theme_langue)
await as(A);
ok("préférences par défaut : thème système, français", (await db.query("select theme, langue from public.utilisateurs where id = $1", [A])).rows[0].theme === "systeme");
await db.query("update public.utilisateurs set theme = 'sombre', langue = 'en' where id = $1", [A]);
const prefsA = (await db.query("select theme, langue from public.utilisateurs where id = $1", [A])).rows[0];
ok("A enregistre ses préférences (sombre, anglais)", prefsA.theme === "sombre" && prefsA.langue === "en");
await expectError("thème inconnu refusé", "update public.utilisateurs set theme = 'violet' where id = $1", [A]);
await expectError("langue inconnue refusée", "update public.utilisateurs set langue = 'de' where id = $1", [A]);
await as(B);
ok("B ne peut pas modifier les préférences de A", (await db.query("update public.utilisateurs set theme = 'clair' where id = $1", [A])).affectedRows === 0);
ok("B ne lit pas les préférences de A", (await db.query("select theme from public.utilisateurs where id = $1", [A])).rows.length === 0);
await as(A);
await db.query("update public.utilisateurs set theme = 'systeme', langue = 'fr' where id = $1", [A]);

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

// --- Historique des activités et prochaines actions (migration historique_activites)
await as(A);
const pAct = (await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, date_dernier_contact, statut)
  values ($1, 'Activité SAS', 50000, 'negociation', current_date - 60, 'a_traiter') returning id`, [A])).rows[0].id;
await db.query("select public.recalculer_prospects()");
const etat = async () => (await db.query("select date_dernier_contact::text d, statut, est_oublie, ca_recuperable_eur::float ca, prochaine_action_le::text pa from public.prospects where id = $1", [pAct])).rows[0];
const avantAct = await etat();
ok("dossier silencieux depuis 60 j : oublié", avantAct.est_oublie === true);

// 1. Brouillon ouvert dans Gmail (copiee_le) : ni contact, ni date, ni statut
const brouillonGmail = (await db.query("insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton) values ($1, $2, 'o', 'c', 'direct') returning id", [pAct, A])).rows[0].id;
await db.query("update public.relances set copiee_le = now() where id = $1", [brouillonGmail]);
const apresGmail = await etat();
ok("Gmail ouvert : date de dernier contact inchangée, toujours oublié, toujours « à traiter »",
  apresGmail.d === avantAct.d && apresGmail.est_oublie === true && apresGmail.statut === "a_traiter");
ok("les lignes existantes sont des brouillons", (await db.query("select type from public.relances where id = $1", [brouillonGmail])).rows[0].type === "brouillon");
await expectError("brouillon sans objet", "insert into public.relances (prospect_id, utilisateur_id, corps, ton) values ($1, $2, 'c', 'direct')", [pAct, A]);

// 2. Note : historisée, sans effet sur le contact
await db.query("select public.enregistrer_activite($1, $2, 'note', null, 'A demandé à être rappelé en novembre', now(), null, false)", [crypto.randomUUID(), pAct]);
const apresNote = await etat();
ok("note : enregistrée sans changer la date ni le statut", apresNote.d === avantAct.d && apresNote.statut === "a_traiter");
await expectError("note vide", "select public.enregistrer_activite($1, $2, 'note', null, '  ', now(), null, false)", [crypto.randomUUID(), pAct]);

// 3. Relance effectuée manuellement (téléphone) avec prochaine action dans 3 jours
const idRelance = crypto.randomUUID();
const cree = (await db.query("select public.enregistrer_activite($1, $2, 'relance', 'telephone', 'Point sur le financement', now(), current_date + 3, true) as c", [idRelance, pAct])).rows[0].c;
const apresRelance = await etat();
ok(`relance manuelle : date du jour, « relancé », plus oublié, CA recalculé (${avantAct.ca} → ${apresRelance.ca})`,
  cree === true && apresRelance.statut === "relance" && apresRelance.est_oublie === false && apresRelance.ca > avantAct.ca
  && apresRelance.d === (await db.query("select (now() at time zone 'Europe/Paris')::date::text d")).rows[0].d);
ok("prochaine action enregistrée sur le dossier (J+3)", apresRelance.pa === (await db.query("select (current_date + 3)::text d")).rows[0].d);
const rejeu = (await db.query("select public.enregistrer_activite($1, $2, 'relance', 'telephone', 'Point sur le financement', now(), current_date + 3, true) as c", [idRelance, pAct])).rows[0].c;
ok("nouvelle tentative (même identifiant) : aucun doublon", rejeu === false
  && (await db.query("select count(*)::int n from public.relances where prospect_id = $1 and type = 'relance'", [pAct])).rows[0].n === 1);
await expectError("activité datée dans le futur", "select public.enregistrer_activite($1, $2, 'appel', 'telephone', null, now() + interval '2 days', null, false)", [crypto.randomUUID(), pAct]);
await expectError("type d'activité inconnu", "select public.enregistrer_activite($1, $2, 'reponse_recue', null, null, now(), null, false)", [crypto.randomUUID(), pAct]);
await expectError("canal inconnu", "select public.enregistrer_activite($1, $2, 'message', 'pigeon', null, now(), null, false)", [crypto.randomUUID(), pAct]);

// 4. Activité datée d'hier après celle du jour : la date de dernier contact ne recule pas
await db.query("select public.enregistrer_activite($1, $2, 'appel', 'telephone', null, now() - interval '1 day', null, false)", [crypto.randomUUID(), pAct]);
ok("contact antérieur saisi après coup : date de dernier contact conservée", (await etat()).d === apresRelance.d);
ok("prochaine action conservée quand l'activité ne la modifie pas", (await etat()).pa === apresRelance.pa);

// 5. Ré-import d'un export plus ancien : la date ne recule pas, le statut et le rappel restent
await db.query("update public.prospects set date_dernier_contact = current_date - 90 where id = $1", [pAct]);
const apresReimport = await etat();
ok("ré-import plus ancien : date, statut et prochaine action conservés", apresReimport.d === apresRelance.d && apresReimport.statut === "relance" && apresReimport.pa === apresRelance.pa);
await db.query("update public.prospects set date_dernier_contact = null where id = $1", [pAct]);
ok("ré-import sans date : date conservée", (await etat()).d === apresRelance.d);

// 6. Prochaine action seule, puis « aucune prochaine action »
await db.query("select public.enregistrer_activite($1, $2, 'prochaine_action', null, null, now(), current_date + 7, true)", [crypto.randomUUID(), pAct]);
ok("prochaine action programmée seule (J+7)", (await etat()).pa === (await db.query("select (current_date + 7)::text d")).rows[0].d);
await expectError("prochaine action sans date", "select public.enregistrer_activite($1, $2, 'prochaine_action', null, null, now(), null, true)", [crypto.randomUUID(), pAct]);
await db.query("select public.enregistrer_activite($1, $2, 'message', 'whatsapp', null, now(), null, true)", [crypto.randomUUID(), pAct]);
ok("contact avec « aucune prochaine action » : rappel effacé, aucun rappel fictif", (await etat()).pa === null);

// 7. Statut gagné conservé ; « relancé » n'est jamais une réponse
await db.query("update public.prospects set statut = 'gagne' where id = $1", [pAct]);
await db.query("select public.enregistrer_activite($1, $2, 'appel', 'telephone', null, now(), null, false)", [crypto.randomUUID(), pAct]);
ok("contact sur un dossier gagné : statut « gagné » conservé", (await etat()).statut === "gagne");
await db.query("update public.prospects set statut = 'relance' where id = $1", [pAct]);

// 8. Opposition à la prospection : aucun contact enregistrable, note possible
await db.query("update public.prospects set opposition_prospection_le = now() where id = $1", [pAct]);
await expectError("relance sur un prospect opposé", "select public.enregistrer_activite($1, $2, 'relance', 'email', null, now(), null, false)", [crypto.randomUUID(), pAct]);
await db.query("select public.enregistrer_activite($1, $2, 'note', null, 'Opposition confirmée par téléphone', now(), null, false)", [crypto.randomUUID(), pAct]);
ok("note possible sur un prospect opposé", true);
await db.query("update public.prospects set opposition_prospection_le = null where id = $1", [pAct]);

// 9. Envoi Brevo confirmé : enregistrer_contact (appelé par la route après acceptation)
await db.query("update public.prospects set statut = 'a_traiter' where id = $1", [pAct]);
await db.query("select public.enregistrer_contact($1, now())", [pAct]);
ok("e-mail envoyé (confirmé) : « relancé »", (await etat()).statut === "relance");

// 10. Isolation entre comptes
const nbActA = (await db.query("select count(*)::int n from public.relances where prospect_id = $1", [pAct])).rows[0].n;
await as(B);
ok("B ne lit aucune activité de A", (await db.query("select count(*)::int n from public.relances where prospect_id = $1", [pAct])).rows[0].n === 0);
await expectError("B enregistre une activité sur un prospect de A", "select public.enregistrer_activite($1, $2, 'note', null, 'intrusion', now(), null, false)", [crypto.randomUUID(), pAct]);
await expectError("B enregistre un contact sur un prospect de A", "select public.enregistrer_contact($1, now())", [pAct]);
ok("B ne modifie pas la prochaine action de A", (await db.query("update public.prospects set prochaine_action_le = current_date where id = $1", [pAct])).affectedRows === 0);
await as(null);
await expectError("anonyme : enregistrer_activite", "select public.enregistrer_activite($1, $2, 'note', null, 'x', now(), null, false)", [crypto.randomUUID(), pAct]);
await as(A);
ok("A retrouve toutes ses activités", (await db.query("select count(*)::int n from public.relances where prospect_id = $1", [pAct])).rows[0].n === nbActA);

// 10 bis. Accès direct aux tables (sans passer par les fonctions)
await as(null);
await expectError("anonyme : lecture de l'historique", "select count(*) from public.relances");
await expectError("anonyme : écriture directe dans l'historique", "insert into public.relances (prospect_id, utilisateur_id, type, effectuee_le, resume) values ($1, $2, 'note', now(), 'x')", [pAct, A]);
await expectError("anonyme : lecture des prochaines actions", "select prochaine_action_le from public.prospects");
await expectError("anonyme : enregistrer_contact", "select public.enregistrer_contact($1, now())", [pAct]);
await as(B);
await expectError("B écrit une activité au nom de A (utilisateur usurpé)", "insert into public.relances (prospect_id, utilisateur_id, type, effectuee_le, resume) values ($1, $2, 'note', now(), 'x')", [pAct, A]);
await expectError("B rattache sa propre activité au prospect de A", "insert into public.relances (prospect_id, utilisateur_id, type, effectuee_le, resume) values ($1, $2, 'note', now(), 'x')", [pAct, B]);
ok("B ne peut ni modifier ni supprimer l'historique de A",
  (await db.query("update public.relances set resume = 'falsifié' where prospect_id = $1", [pAct])).affectedRows === 0
  && (await db.query("delete from public.relances where prospect_id = $1", [pAct])).affectedRows === 0);
await as(A);
await expectError("A transfère une activité vers le compte de B", "update public.relances set utilisateur_id = $1 where prospect_id = $2", [B, pAct]);
ok("historique de A intact après les tentatives", (await db.query("select count(*)::int n from public.relances where prospect_id = $1", [pAct])).rows[0].n === nbActA);

// 11. Tableau de bord : un dossier gagné après une relance manuelle compte comme « gagné après relance »
const avantKpi = Number((await db.query("select nb_gagnes_apres_relance n from public.tableau_de_bord()")).rows[0].n);
const pGagne2 = (await db.query("insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, statut) values ($1, 'Gagné Manuel', 1000, 'negociation', 'a_traiter') returning id", [A])).rows[0].id;
await db.query("select public.enregistrer_activite($1, $2, 'relance', 'email', null, now(), null, false)", [crypto.randomUUID(), pGagne2]);
await db.query("update public.prospects set statut = 'gagne' where id = $1", [pGagne2]);
ok("tableau de bord : gagné après une relance manuelle compté", Number((await db.query("select nb_gagnes_apres_relance n from public.tableau_de_bord()")).rows[0].n) === avantKpi + 1);
await db.query("delete from public.prospects where id in ($1, $2)", [pAct, pGagne2]);
await db.query("select public.recalculer_prospects()");

// --- Parcours complet : dossier oublié → Gmail → relance confirmée → prochaine action → priorités
await as(A);
const pP = (await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, date_dernier_contact, statut)
  values ($1, 'Parcours SAS', 80000, 'proposition', current_date - 50, 'a_traiter') returning id`, [A])).rows[0].id;
const pAutre = (await db.query(`insert into public.prospects (utilisateur_id, entreprise, montant_eur, etape, date_dernier_contact, statut)
  values ($1, 'Témoin SAS', 30000, 'negociation', current_date - 40, 'a_traiter') returning id`, [A])).rows[0].id;
await db.query("select public.recalculer_prospects()");
// Requêtes reprises des écrans : « Mes priorités » (getProspects oubliés à traiter), « Prochaines actions » (getNextActions)
const priorites = async () => (await db.query("select id from public.prospects where utilisateur_id = $1 and est_oublie and statut = 'a_traiter' order by ca_recuperable_eur desc nulls last", [A])).rows.map((r) => r.id);
const prochaines = async () => (await db.query("select id, prochaine_action_le::text d from public.prospects where utilisateur_id = $1 and prochaine_action_le is not null and statut not in ('gagne','perdu','ignore') order by prochaine_action_le", [A])).rows;
const oubliesKpi = async () => Number((await db.query("select nb_oublies from public.tableau_de_bord()")).rows[0].nb_oublies);
ok("parcours 1 : dossier silencieux depuis 50 j présent dans « Mes priorités »", (await priorites()).includes(pP));
const oubliesAvant = await oubliesKpi();
const scoreTemoinAvant = (await db.query("select score from public.prospects where id = $1", [pAutre])).rows[0].score;

const bP = (await db.query("insert into public.relances (prospect_id, utilisateur_id, objet, corps, ton) values ($1, $2, 'o', 'c', 'direct') returning id", [pP, A])).rows[0].id;
await db.query("update public.relances set copiee_le = now() where id = $1", [bP]);
ok("parcours 2 : brouillon ouvert dans Gmail → toujours dans « Mes priorités », aucun rappel", (await priorites()).includes(pP) && !(await prochaines()).some((r) => r.id === pP));

await db.query("select public.enregistrer_activite($1, $2, 'relance', 'email', 'Relance par e-mail', now(), current_date + 3, true)", [crypto.randomUUID(), pP]);
const apresP = (await db.query("select statut, est_oublie, score, ca_recuperable_eur::float ca, date_dernier_contact::text d from public.prospects where id = $1", [pP])).rows[0];
ok("parcours 3 : relance confirmée → sort de « Mes priorités », « Relancé », plus oublié", !(await priorites()).includes(pP) && apresP.statut === "relance" && apresP.est_oublie === false);
ok("parcours 3 : compteur « oubliés » du tableau de bord diminue d'une unité", (await oubliesKpi()) === oubliesAvant - 1);
const j3 = (await db.query("select (current_date + 3)::text d")).rows[0].d;
ok("parcours 4 : rappel à J+3 dans « Prochaines actions »", (await prochaines()).find((r) => r.id === pP)?.d === j3);
const histo = (await db.query("select type, canal, prochaine_action_le::text pa from public.relances where prospect_id = $1 order by cree_le", [pP])).rows;
ok("parcours 5 : historique = brouillon (Gmail) + relance par e-mail avec prochaine action", histo.length === 2 && histo[0].type === "brouillon" && histo[1].type === "relance" && histo[1].canal === "email" && histo[1].pa !== null);
const scoreTemoinApres = (await db.query("select score from public.prospects where id = $1", [pAutre])).rows[0].score;
ok(`parcours 6 : scores recalculés pour tout le compte (témoin ${scoreTemoinAvant} → ${scoreTemoinApres}, toujours entre 0 et 100)`, scoreTemoinApres >= 0 && scoreTemoinApres <= 100);
await db.query("update public.prospects set statut = 'gagne' where id = $1", [pP]);
ok("parcours 7 : dossier gagné → retiré des « Prochaines actions »", !(await prochaines()).some((r) => r.id === pP));
// « Remplacer toutes les données » : suppression des prospects → historique supprimé en cascade
await db.query("delete from public.prospects where id in ($1, $2)", [pP, pAutre]);
ok("parcours 8 : suppression des prospects (remplacement) → historique supprimé avec eux", (await db.query("select count(*)::int n from public.relances where prospect_id in ($1, $2)", [pP, pAutre])).rows[0].n === 0);
await db.query("select public.recalculer_prospects()");

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
