# LeadPilot

LeadPilot repère les prospects oubliés dans un export CRM, estime le chiffre d'affaires récupérable et rédige la relance à envoyer. Ce n'est pas un CRM.

Stack : Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Supabase.

## Démarrer

```bash
npm install
cp .env.example .env.local   # URL, clé publishable Supabase et URL du site
npm run dev                  # http://localhost:3000
```

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Vérification des types |
| `npm test` | Tests unitaires (lecture des CSV : montants, dates, étapes, colonnes) |
| `npm run test:db` | Tests du schéma, du calcul et de la Row Level Security (Postgres embarqué, sans Docker) |
| `npm run db:push` | Applique les migrations au projet Supabase lié |
| `npm run db:types` | Régénère `src/types/database.ts` depuis le projet lié |

En développement uniquement (404 en production) : catalogue des composants sur [`/ui`](http://localhost:3000/ui), aperçus sans connexion remplis avec des données d'exemple sur [`/ui/apercu`](http://localhost:3000/ui/apercu) (dashboard), `/ui/apercu/prospect`, `/ui/apercu/priorites`, `/ui/apercu/dossiers` et `/ui/apercu/dossiers-a-risque`.

## Mettre en place Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région UE recommandée pour le RGPD).
2. Relier le dépôt et appliquer les migrations :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>
   npm run db:push
   npm run db:types
   ```
3. Pousser la configuration Auth (URLs de redirection, lien valable 15 minutes) après avoir relu le diff :
   ```bash
   npx supabase config diff   # toujours relire : en non-interactif, config push applique sans demander
   npx supabase config push
   ```
   En production, remplacer `site_url` et `additional_redirect_urls` dans `supabase/config.toml` par l'URL publique.
4. Modèles d'email en français (`supabase/templates/`) : **nécessitent un SMTP personnalisé**. Sur l'offre gratuite avec l'envoi par défaut, Supabase refuse toute modification des modèles ; l'email reste en anglais et son lien (flux PKCE, `?code=`) doit être ouvert dans le navigateur qui a demandé la connexion. Une fois le SMTP configuré (Authentication > SMTP Settings), décommenter les sections `[auth.email.template.*]` de `supabase/config.toml` et refaire `config push` : le lien passe alors en `token_hash` et fonctionne depuis n'importe quel navigateur.
5. L'envoi par défaut de Supabase est limité à 2 emails par heure : indispensable de configurer un SMTP avant d'ouvrir l'application à des utilisateurs.
6. Renseigner `.env.local` (ou les variables de l'hébergeur) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## Mise en ligne (Vercel)

- Région des fonctions : Paris (`cdg1`, `vercel.json`), à côté de la base Supabase (eu-west-3).
- Variables d'environnement (Production, et Preview si besoin) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` (URL publique exacte, sans `/` final) ; pour l'envoi par e-mail, `BREVO_API_KEY` (secrète), `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`. La seule clé secrète est `BREVO_API_KEY`, lue côté serveur ; la clé `service_role` / `sb_secret_` de Supabase n'est jamais utilisée par l'application. Les variables `NEXT_PUBLIC_` sont figées au build : après une modification, redéployer.
- Supabase > Authentication > URL Configuration : Site URL = l'URL publique ; Redirect URLs = `https://<domaine>/**` (garder `http://localhost:3000/**` pour le développement). À faire dans le tableau de bord plutôt qu'avec `config push`, dont le fichier local pointe vers localhost.
- SMTP personnalisé (Authentication > SMTP Settings) avant d'ouvrir à de vrais utilisateurs : sans lui, 2 emails de connexion par heure pour tout le projet.
- Isolation des données : chaque compte (une agence) ne voit que ses propres lignes ; Row Level Security sur les 3 tables, aucun droit pour les visiteurs anonymes, vérifié par `npm run test:db`.

## Import CSV

L'écran **Importer** accepte un CSV (10 Mo, 5 000 lignes max), séparé par virgules ou points-virgules, en UTF-8 ou en encodage Excel français. Colonnes reconnues automatiquement (noms FR/EN, HubSpot, Pipedrive, Salesforce) : `entreprise`*, `contact`, `email`, `téléphone`, `montant`, `date dernier contact`*, `statut`, `notes` (* obligatoires). Voir `public/exemple-prospects.csv`.

- Le **statut** du CSV (« Proposition envoyée », « Gagné »…) devient l'étape de l'affaire ; le statut de suivi LeadPilot n'est jamais écrasé par un ré-import.
- Un ré-import met à jour les prospects existants (même entreprise + même email) ; l'option « Remplacer toutes les données » supprime d'abord les prospects et leurs relances.
- Après l'import, `recalculer_prospects()` calcule oubli, probabilité, CA récupérable et score (formule de l'architecture produit). Un recalcul de tous les comptes tourne chaque nuit à 3 h UTC (pg_cron).

## Pourquoi ce score ?

Le score (0 à 100) compare le CA récupérable d'un prospect à celui de la meilleure affaire ouverte du compte (= 100). Le CA récupérable vaut montant × poids de l'étape × fraîcheur du contact. La fiche prospect l'explique : un verdict en une phrase, les facteurs (montant, étape, silence) classés par influence avec leurs points, et une cascade « prospect moyen du compte → score ». Les points sont des valeurs de Shapley : chaque facteur est comparé au prospect moyen du compte et la somme retombe exactement sur le score. Sur le dashboard, survoler un anneau de score affiche le même résumé.

## Relances (modèles, sans IA)

Sur la fiche d'un prospect, « Préparer la relance » complète un modèle rédigé à l'avance (`src/lib/followups/templates.ts`), sans aucun appel à une API d'IA ni coût par relance :

- **Situation détectée** d'après le dossier : plus de 120 jours sans contact → « Dernière relance » ; plus de 60 jours → « Reprise de contact » ; sinon selon l'étape : négociation → « Aide à la décision », proposition → « Suivi de proposition », autres → « Suite à un premier échange ». Le modèle conseillé et ses raisons sont affichés ; l'utilisateur peut en choisir un autre.
- **Trois tons** : Direct, Professionnel, Amical (valeurs en base : `direct`, `formel`, `chaleureux`), soit 15 variantes.
- **Personnalisation** avec les seules données réelles : prénom du contact (sinon « Bonjour, »), entreprise, date du dernier échange (sinon la phrase est reformulée sans date), mention de la proposition uniquement aux étapes proposition et négociation. Les notes importées ne sont jamais recopiées dans le message (notes internes). La signature du compte est ajoutée telle quelle.
- La relance est préparée côté serveur (action `prepareFollowup`, données relues en base) et enregistrée dans `relances` (`modele_ia` = `modele:<scénario>`). Tant qu'elle n'a été ni copiée ni ouverte dans Gmail, changer de modèle ou de ton réécrit le même brouillon. Le texte reste modifiable avant envoi.
- **Ouvrir dans Gmail** : ouvre un nouveau message Gmail pré-rempli (destinataire = email du prospect, objet, corps) dans un nouvel onglet, via l'URL de rédaction de Gmail (`mail.google.com/mail/?view=cm`) : aucune connexion Google, aucun OAuth, aucune API. LeadPilot n'envoie rien : le message part quand l'utilisateur clique sur « Envoyer » dans Gmail. « Copier le message » reste disponible pour tout autre client mail. Ouvrir ou copier horodate la relance (`copiee_le`) ; l'interface parle alors de relance « copiée ou ouverte », jamais « envoyée ».

## Envoi par e-mail (Brevo)

En plus de Gmail, une relance peut être envoyée depuis LeadPilot via l'API transactionnelle officielle de Brevo (`POST https://api.brevo.com/v3/smtp/email`, clé dans l'en-tête `api-key`).

- **Explicite** : bouton « Envoyer par e-mail », aperçu (destinataire, expéditeur, adresse de réponse, objet, texte exact) puis « Confirmer l'envoi ». Aucun envoi automatique.
- **Route serveur** `POST /api/relances/envoyer` (`src/app/api/relances/envoyer/route.ts`) : vérifie l'origine de la requête, la session, la configuration, que la relance et le prospect appartiennent au compte (RLS + filtre explicite), l'opposition à la prospection, l'adresse du destinataire, que le texte est identique à l'aperçu, la limite de 30 envois par heure et par compte, et que l'expéditeur est **déclaré et actif dans Brevo** (`GET /v3/senders`, jamais supposé). La relance est ensuite réservée de façon atomique (`envoi_statut = 'en_cours'`) : un double clic ou deux onglets ne peuvent pas l'envoyer deux fois.
- **Après l'envoi** : `envoi_statut = 'envoyee'`, date, adresse et identifiant Brevo (`brevo_message_id`) enregistrés ; le message n'est plus modifiable et le dossier passe en « Relancé ». En cas d'échec, `envoi_statut = 'echec'` avec un message sans détail technique ni clé ; on peut réessayer.
- **Expéditeur** : `BREVO_SENDER_NAME <BREVO_SENDER_EMAIL>` ; les réponses vont à l'adresse du compte LeadPilot (`replyTo`).
- **Prospection** : chaque e-mail se termine par une mention permettant de s'opposer (« répondez STOP »). Une opposition enregistrée sur la fiche (`prospects.opposition_prospection_le`) bloque tout contact depuis LeadPilot, Gmail compris, et passe le dossier en « Ignoré ».
- Variables (serveur uniquement) : `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`. Sans elles, le bouton reste désactivé.
- Migration requise : `supabase/migrations/20261009120000_envoi_email_brevo.sql` (colonnes ajoutées, aucune donnée modifiée).
- RGPD : l'adresse, le nom du contact et le message sont transmis à Brevo pour l'envoi (sous-traitant à mentionner dans la politique de confidentialité).

Pour essayer l'application sans fichier : se connecter une fois, remplacer l'adresse dans `supabase/demo-data.sql` puis l'exécuter dans le SQL Editor.

## Écrans V1

| Écran | Route |
| --- | --- |
| E1 Connexion | `/connexion` |
| E2 Import et réglages | `/import` |
| E3 Tableau de bord | `/tableau-de-bord` |
| E4 Liste des prospects | `/prospects` |
| E5 Fiche prospect et relance | `/prospects/[id]` |
