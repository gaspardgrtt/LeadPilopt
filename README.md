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

En développement uniquement : catalogue des composants sur [`/ui`](http://localhost:3000/ui), aperçus remplis avec des données d'exemple sur [`/apercu/dashboard`](http://localhost:3000/apercu/dashboard) et [`/apercu/prospect`](http://localhost:3000/apercu/prospect) (connexion requise).

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

## Import CSV

L'écran **Importer** accepte un CSV (10 Mo, 5 000 lignes max), séparé par virgules ou points-virgules, en UTF-8 ou en encodage Excel français. Colonnes reconnues automatiquement (noms FR/EN, HubSpot, Pipedrive, Salesforce) : `entreprise`*, `contact`, `email`, `téléphone`, `montant`, `date dernier contact`*, `statut`, `notes` (* obligatoires). Voir `public/exemple-prospects.csv`.

- Le **statut** du CSV (« Proposition envoyée », « Gagné »…) devient l'étape de l'affaire ; le statut de suivi LeadPilot n'est jamais écrasé par un ré-import.
- Un ré-import met à jour les prospects existants (même entreprise + même email) ; l'option « Remplacer toutes les données » supprime d'abord les prospects et leurs relances.
- Après l'import, `recalculer_prospects()` calcule oubli, probabilité, CA récupérable et score (formule de l'architecture produit). Un recalcul de tous les comptes tourne chaque nuit à 3 h UTC (pg_cron).

## Pourquoi ce score ?

Le score (0 à 100) compare le CA récupérable d'un prospect à celui de la meilleure affaire ouverte du compte (= 100). Le CA récupérable vaut montant × poids de l'étape × fraîcheur du contact. La fiche prospect l'explique : un verdict en une phrase, les facteurs (montant, étape, silence) classés par influence avec leurs points, et une cascade « prospect moyen du compte → score ». Les points sont des valeurs de Shapley : chaque facteur est comparé au prospect moyen du compte et la somme retombe exactement sur le score. Sur le dashboard, survoler un anneau de score affiche le même résumé.

## Relances IA

Sur la fiche d'un prospect, « Générer une relance » appelle `POST /api/relances/generer`, qui rédige l'email avec Claude (API Anthropic, modèle `claude-opus-5-5`) et le diffuse en streaming, puis l'enregistre dans `relances`. Trois tons : Direct, Professionnel, Amical (valeurs en base : `direct`, `formel`, `chaleureux`). La signature du compte est ajoutée telle quelle à la fin. Changer de ton ou « Régénérer » crée une nouvelle relance ; les précédentes restent en base.

- **Ouvrir dans Gmail** : ouvre un nouveau message Gmail pré-rempli (destinataire = email du prospect, objet, corps) dans un nouvel onglet, via l'URL de rédaction de Gmail (`mail.google.com/mail/?view=cm`) : aucune connexion Google, aucun OAuth, aucune API. Le message s'ouvre dans le compte Gmail connecté du navigateur ; il ne reste qu'à cliquer sur « Envoyer ». « Copier le message » reste disponible pour tout autre client mail.
- Variable requise : `ANTHROPIC_API_KEY` (serveur uniquement).
- Limite : 20 relances par utilisateur et par heure (`FOLLOWUP_HOURLY_LIMIT`).
- En cas de refus par les filtres de sécurité du modèle, l'API relance automatiquement sur le modèle de secours recommandé (`fallbacks: "default"`).
- RGPD : le nom, l'entreprise, l'étape, le montant, la date de dernier contact et les notes du prospect sont envoyés à Anthropic pour la rédaction. À mentionner dans la politique de confidentialité.

Pour essayer l'application sans fichier : se connecter une fois, remplacer l'adresse dans `supabase/demo-data.sql` puis l'exécuter dans le SQL Editor.

## Écrans V1

| Écran | Route |
| --- | --- |
| E1 Connexion | `/connexion` |
| E2 Import et réglages | `/import` |
| E3 Tableau de bord | `/tableau-de-bord` |
| E4 Liste des prospects | `/prospects` |
| E5 Fiche prospect et relance IA | `/prospects/[id]` |
