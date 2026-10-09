-- LeadPilot — schéma initial (architecture produit §4).
-- Trois tables métier : utilisateurs 1—n prospects 1—n relances.
-- Chaque ligne appartient à un utilisateur ; la Row Level Security garantit qu'aucun
-- utilisateur ne lit ni n'écrit les données d'un autre.

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------

create type public.etape_affaire as enum (
  'decouverte',
  'qualification',
  'proposition',
  'negociation',
  'gagne',
  'perdu'
);

create type public.statut_prospect as enum (
  'a_traiter',
  'relance',
  'gagne',
  'perdu',
  'ignore'
);

create type public.ton_relance as enum (
  'formel',
  'direct',
  'chaleureux'
);

-- ---------------------------------------------------------------------------
-- Horodatage de mise à jour
-- ---------------------------------------------------------------------------

create function public.definir_maj_le()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- utilisateurs : le compte et ses réglages (1 ligne par compte auth.users)
-- ---------------------------------------------------------------------------

create table public.utilisateurs (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  nom text check (char_length(nom) <= 120),
  entreprise text check (char_length(entreprise) <= 120),
  seuil_inactivite_jours integer not null default 21
    check (seuil_inactivite_jours between 1 and 365),
  panier_moyen_eur numeric(12, 2) check (panier_moyen_eur >= 0),
  ton_relance public.ton_relance not null default 'direct',
  signature text check (char_length(signature) <= 1000),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

comment on table public.utilisateurs is 'Compte LeadPilot et réglages de détection et de relance.';
comment on column public.utilisateurs.seuil_inactivite_jours is 'Au-delà de ce nombre de jours sans contact, une affaire ouverte est considérée comme oubliée.';
comment on column public.utilisateurs.panier_moyen_eur is 'Montant utilisé quand une affaire importée n''a pas de montant.';

create trigger utilisateurs_maj_le
  before update on public.utilisateurs
  for each row execute function public.definir_maj_le();

-- Crée la ligne `utilisateurs` à l'inscription (premier lien magique).
create function public.creer_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.utilisateurs (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_users_creer_utilisateur
  after insert on auth.users
  for each row execute function public.creer_utilisateur();

-- Garde l'email synchronisé si l'utilisateur le change dans Supabase Auth.
create function public.synchroniser_email_utilisateur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.utilisateurs set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger auth_users_synchroniser_email
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.synchroniser_email_utilisateur();

-- ---------------------------------------------------------------------------
-- prospects : une ligne par affaire importée, avec les calculs stockés
-- ---------------------------------------------------------------------------

create table public.prospects (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.utilisateurs (id) on delete cascade,
  import_id uuid,
  contact_nom text check (char_length(contact_nom) <= 200),
  contact_email text check (char_length(contact_email) <= 320),
  entreprise text not null check (char_length(entreprise) between 1 and 200),
  montant_eur numeric(12, 2) check (montant_eur >= 0),
  etape public.etape_affaire,
  etape_brute text check (char_length(etape_brute) <= 200),
  date_dernier_contact date,
  notes text check (char_length(notes) <= 5000),
  donnees_brutes jsonb not null default '{}'::jsonb,
  est_oublie boolean not null default false,
  proba_recuperation numeric(5, 4) check (proba_recuperation between 0 and 1),
  ca_recuperable_eur numeric(12, 2) check (ca_recuperable_eur >= 0),
  score smallint check (score between 0 and 100),
  statut public.statut_prospect not null default 'a_traiter',
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  -- Un ré-import met à jour la ligne existante au lieu de la dupliquer.
  constraint prospects_unicite_import unique nulls not distinct (utilisateur_id, contact_email, entreprise),
  -- Cible de la clé étrangère composite de `relances` (empêche de rattacher une relance
  -- au prospect d'un autre utilisateur).
  constraint prospects_id_utilisateur unique (id, utilisateur_id)
);

comment on table public.prospects is 'Affaires importées depuis un export CRM, avec score et CA récupérable calculés.';
comment on column public.prospects.donnees_brutes is 'Ligne CSV d''origine complète, pour ne rien perdre à l''import.';

create index prospects_tableau_de_bord_idx
  on public.prospects (utilisateur_id, est_oublie, ca_recuperable_eur desc nulls last);
create index prospects_statut_idx
  on public.prospects (utilisateur_id, statut);

create trigger prospects_maj_le
  before update on public.prospects
  for each row execute function public.definir_maj_le();

-- ---------------------------------------------------------------------------
-- relances : chaque message généré par l'IA
-- ---------------------------------------------------------------------------

create table public.relances (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null,
  utilisateur_id uuid not null,
  objet text not null check (char_length(objet) between 1 and 300),
  corps text not null check (char_length(corps) between 1 and 10000),
  ton public.ton_relance not null,
  modele_ia text check (char_length(modele_ia) <= 200),
  copiee_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint relances_prospect_fk
    foreign key (prospect_id, utilisateur_id)
    references public.prospects (id, utilisateur_id)
    on delete cascade
);

comment on table public.relances is 'Relances rédigées par l''IA ; copiee_le mesure l''usage réel.';

create index relances_prospect_idx on public.relances (prospect_id, cree_le desc);
create index relances_utilisateur_idx on public.relances (utilisateur_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.utilisateurs enable row level security;
alter table public.prospects enable row level security;
alter table public.relances enable row level security;

-- Aucun accès anonyme.
revoke all on public.utilisateurs, public.prospects, public.relances from anon;

-- utilisateurs : lecture et modification de son propre compte. La ligne est créée par le
-- trigger d'inscription et supprimée avec le compte auth : ni insert ni delete côté client.
create policy "utilisateurs_lecture_soi"
  on public.utilisateurs for select to authenticated
  using ((select auth.uid()) = id);

create policy "utilisateurs_modification_soi"
  on public.utilisateurs for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Seuls les réglages sont modifiables (pas l'id, l'email ni les horodatages).
revoke insert, update, delete on public.utilisateurs from authenticated;
grant update (nom, entreprise, seuil_inactivite_jours, panier_moyen_eur, ton_relance, signature)
  on public.utilisateurs to authenticated;

-- prospects : accès complet à ses propres prospects.
create policy "prospects_lecture_soi"
  on public.prospects for select to authenticated
  using ((select auth.uid()) = utilisateur_id);

create policy "prospects_creation_soi"
  on public.prospects for insert to authenticated
  with check ((select auth.uid()) = utilisateur_id);

create policy "prospects_modification_soi"
  on public.prospects for update to authenticated
  using ((select auth.uid()) = utilisateur_id)
  with check ((select auth.uid()) = utilisateur_id);

create policy "prospects_suppression_soi"
  on public.prospects for delete to authenticated
  using ((select auth.uid()) = utilisateur_id);

-- relances : accès complet à ses propres relances.
create policy "relances_lecture_soi"
  on public.relances for select to authenticated
  using ((select auth.uid()) = utilisateur_id);

create policy "relances_creation_soi"
  on public.relances for insert to authenticated
  with check ((select auth.uid()) = utilisateur_id);

create policy "relances_modification_soi"
  on public.relances for update to authenticated
  using ((select auth.uid()) = utilisateur_id)
  with check ((select auth.uid()) = utilisateur_id);

create policy "relances_suppression_soi"
  on public.relances for delete to authenticated
  using ((select auth.uid()) = utilisateur_id);

-- ---------------------------------------------------------------------------
-- Tableau de bord (E3) : un seul aller-retour, en droits de l'appelant (RLS appliquée)
-- ---------------------------------------------------------------------------

create function public.tableau_de_bord()
returns table (
  nb_prospects bigint,
  nb_affaires_ouvertes bigint,
  nb_oublies bigint,
  ca_recuperable_eur numeric,
  ca_recupere_eur numeric,
  nb_gagnes_apres_relance bigint,
  dernier_import_le timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) as nb_prospects,
    count(*) filter (where p.etape is distinct from 'gagne' and p.etape is distinct from 'perdu') as nb_affaires_ouvertes,
    count(*) filter (where p.est_oublie and p.statut in ('a_traiter', 'relance')) as nb_oublies,
    coalesce(sum(p.ca_recuperable_eur) filter (where p.est_oublie and p.statut in ('a_traiter', 'relance')), 0) as ca_recuperable_eur,
    coalesce(sum(p.montant_eur) filter (where p.statut = 'gagne' and r.copiee), 0) as ca_recupere_eur,
    count(*) filter (where p.statut = 'gagne' and r.copiee) as nb_gagnes_apres_relance,
    max(p.cree_le) as dernier_import_le
  from public.prospects p
  left join lateral (
    select true as copiee
    from public.relances rl
    where rl.prospect_id = p.id and rl.copiee_le is not null
    limit 1
  ) r on true
  where p.utilisateur_id = (select auth.uid());
$$;

comment on function public.tableau_de_bord() is 'Indicateurs du tableau de bord pour l''utilisateur connecté.';

revoke execute on function public.tableau_de_bord() from public, anon;
grant execute on function public.tableau_de_bord() to authenticated;

-- Les fonctions de trigger ne doivent pas être appelables via l'API.
revoke execute on function public.creer_utilisateur() from public, anon, authenticated;
revoke execute on function public.synchroniser_email_utilisateur() from public, anon, authenticated;
revoke execute on function public.definir_maj_le() from public, anon, authenticated;
