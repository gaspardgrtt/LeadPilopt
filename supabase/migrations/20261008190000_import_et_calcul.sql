-- Import CSV et calcul du score (architecture produit §2, règle de calcul V1).

-- ---------------------------------------------------------------------------
-- Colonnes ajoutées à `prospects`
-- ---------------------------------------------------------------------------

alter table public.prospects
  add column contact_telephone text check (char_length(contact_telephone) <= 40),
  add column importe_le timestamptz not null default now();

comment on column public.prospects.importe_le is 'Date du dernier import ayant créé ou mis à jour la ligne.';

-- ---------------------------------------------------------------------------
-- Calcul : oublié, probabilité de récupération, CA récupérable, score
-- ---------------------------------------------------------------------------
-- p = poids de l'étape × max(0,2 ; 1 − jours sans contact / 180)
-- CA récupérable = montant (ou panier moyen) × p
-- score = CA récupérable ramené de 0 à 100 sur les affaires ouvertes du compte
-- oublié = affaire ouverte dont le dernier contact dépasse le seuil d'inactivité
-- Étape inconnue : poids de la qualification (0,20). Affaire gagnée ou perdue : aucun calcul.

create function public.recalculer_prospects_de(p_utilisateur uuid)
returns integer
language sql
security definer
set search_path = ''
as $$
  with reglages as (
    select seuil_inactivite_jours as seuil, panier_moyen_eur as panier
    from public.utilisateurs
    where id = p_utilisateur
  ),
  base as (
    select
      p.id,
      coalesce(p.etape in ('gagne', 'perdu'), false) as ferme,
      case when p.date_dernier_contact is null then null else greatest(current_date - p.date_dernier_contact, 0) end as jours,
      coalesce(p.montant_eur, r.panier) as montant,
      case p.etape
        when 'decouverte' then 0.10
        when 'qualification' then 0.20
        when 'proposition' then 0.40
        when 'negociation' then 0.60
        else 0.20
      end as poids,
      r.seuil
    from public.prospects p
    cross join reglages r
    where p.utilisateur_id = p_utilisateur
  ),
  probas as (
    select
      b.*,
      case
        when b.ferme or b.jours is null then null
        else b.poids * greatest(0.2, 1 - b.jours::numeric / 180)
      end as proba_exacte
    from base b
  ),
  montants as (
    -- Le CA utilise la probabilité exacte ; seule la valeur stockée est arrondie.
    select pr.*, round(pr.proba_exacte, 4) as proba, round(pr.montant * pr.proba_exacte, 2) as ca
    from probas pr
  ),
  scores as (
    select
      m.*,
      case
        when m.ca is null then null
        else coalesce(round(100 * m.ca / nullif(max(m.ca) over (), 0)), 0)::smallint
      end as score
    from montants m
  ),
  maj as (
    update public.prospects p
    set
      est_oublie = (not s.ferme and s.jours is not null and s.jours > s.seuil),
      proba_recuperation = s.proba,
      ca_recuperable_eur = s.ca,
      score = s.score
    from scores s
    where p.id = s.id
      and (
        p.est_oublie is distinct from (not s.ferme and s.jours is not null and s.jours > s.seuil)
        or p.proba_recuperation is distinct from s.proba
        or p.ca_recuperable_eur is distinct from s.ca
        or p.score is distinct from s.score
      )
    returning 1
  )
  select count(*)::integer from maj;
$$;

comment on function public.recalculer_prospects_de(uuid) is 'Recalcule oubli, probabilité, CA récupérable et score des prospects d''un utilisateur. Usage interne.';

-- Appelée par l'application après un import ou un changement de réglages : ne peut viser que
-- les prospects de l'utilisateur connecté.
create function public.recalculer_prospects()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  return public.recalculer_prospects_de(uid);
end;
$$;

comment on function public.recalculer_prospects() is 'Recalcule les prospects de l''utilisateur connecté.';

-- Recalcul quotidien de tous les comptes : le nombre de jours sans contact augmente chaque jour.
create function public.recalculer_tous_les_prospects()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  total integer := 0;
  compte record;
begin
  for compte in select id from public.utilisateurs loop
    total := total + public.recalculer_prospects_de(compte.id);
  end loop;
  return total;
end;
$$;

revoke execute on function public.recalculer_prospects_de(uuid) from public, anon, authenticated;
revoke execute on function public.recalculer_tous_les_prospects() from public, anon, authenticated;
revoke execute on function public.recalculer_prospects() from public, anon;
grant execute on function public.recalculer_prospects() to authenticated;

-- Planification quotidienne (03:00 UTC) quand pg_cron est disponible (projets Supabase).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    execute $cron$select cron.schedule('recalcul-quotidien-prospects', '0 3 * * *', 'select public.recalculer_tous_les_prospects()')$cron$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tableau de bord : « dernier import » suit désormais la date d'import
-- ---------------------------------------------------------------------------

create or replace function public.tableau_de_bord()
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
    max(p.importe_le) as dernier_import_le
  from public.prospects p
  left join lateral (
    select true as copiee
    from public.relances rl
    where rl.prospect_id = p.id and rl.copiee_le is not null
    limit 1
  ) r on true
  where p.utilisateur_id = (select auth.uid());
$$;
