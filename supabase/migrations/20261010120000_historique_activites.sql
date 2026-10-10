-- Historique des activités commerciales et prochaines actions.
-- Migration additive : aucune donnée existante n'est supprimée ni réécrite.
--
-- Pas de quatrième table (contrainte V1) : `relances` devient le journal des actions d'un dossier.
--   type 'brouillon'        : message préparé à partir d'un modèle (toutes les lignes existantes) ;
--                              copié / ouvert dans Gmail (copiee_le) ou envoyé par Brevo (envoi_statut).
--   type 'relance'           : relance effectuée par l'agent, hors Izmo (canal précisé) ;
--   type 'appel'             : appel effectué ;
--   type 'message'           : message envoyé par un autre canal (SMS, WhatsApp, LinkedIn…) ;
--   type 'note'              : note libre, sans effet sur la date de dernier contact ;
--   type 'prochaine_action'  : prochaine action programmée seule (par ex. après un envoi Brevo).
-- Seuls relance, appel et message (et un e-mail réellement envoyé par Brevo) comptent comme un
-- contact : ils avancent la date de dernier contact et recalculent le score. Ouvrir un brouillon
-- dans Gmail n'est jamais compté comme un envoi.

-- ---------------------------------------------------------------------------
-- relances : colonnes d'activité
-- ---------------------------------------------------------------------------

alter table public.relances
  add column type text not null default 'brouillon'
    check (type in ('brouillon', 'relance', 'appel', 'message', 'note', 'prochaine_action')),
  add column canal text
    check (canal in ('email', 'telephone', 'sms', 'whatsapp', 'linkedin', 'en_personne', 'autre')),
  add column resume text check (char_length(resume) <= 2000),
  add column effectuee_le timestamptz,
  add column prochaine_action_le date;

-- Les activités n'ont ni objet, ni corps, ni ton : ces colonnes restent obligatoires pour les brouillons.
alter table public.relances
  alter column objet drop not null,
  alter column corps drop not null,
  alter column ton drop not null;

alter table public.relances
  add constraint relances_brouillon_complet
    check (type <> 'brouillon' or (objet is not null and corps is not null and ton is not null)),
  add constraint relances_activite_datee
    check (type = 'brouillon' or effectuee_le is not null),
  add constraint relances_prochaine_action_datee
    check (type <> 'prochaine_action' or prochaine_action_le is not null),
  add constraint relances_note_resumee
    check (type <> 'note' or (resume is not null and char_length(btrim(resume)) > 0));

comment on column public.relances.type is
  'brouillon (message préparé) ou activité : relance, appel, message, note, prochaine_action.';
comment on column public.relances.effectuee_le is 'Date et heure où l''action a été réalisée (activités).';
comment on column public.relances.prochaine_action_le is 'Prochaine action programmée lors de cette activité.';

-- ---------------------------------------------------------------------------
-- prospects : prochaine action en cours
-- ---------------------------------------------------------------------------

alter table public.prospects
  add column prochaine_action_le date;

comment on column public.prospects.prochaine_action_le is
  'Rappel interne : date de la prochaine action prévue sur ce dossier ; null = aucune.';

create index prospects_prochaine_action_idx
  on public.prospects (utilisateur_id, prochaine_action_le)
  where prochaine_action_le is not null;

-- ---------------------------------------------------------------------------
-- Date de dernier contact : elle n'avance qu'avec un contact et ne recule jamais
-- ---------------------------------------------------------------------------
-- Un ré-import d'un export CRM plus ancien (ou sans date) ne doit pas effacer un contact
-- enregistré dans Izmo.

create function public.conserver_dernier_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.date_dernier_contact is not null
     and (new.date_dernier_contact is null or new.date_dernier_contact < old.date_dernier_contact) then
    new.date_dernier_contact := old.date_dernier_contact;
  end if;
  return new;
end;
$$;

create trigger prospects_dernier_contact_monotone
  before update of date_dernier_contact on public.prospects
  for each row execute function public.conserver_dernier_contact();

revoke execute on function public.conserver_dernier_contact() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contact effectué : date de dernier contact, statut, recalcul (droits de l'appelant)
-- ---------------------------------------------------------------------------

create function public.enregistrer_contact(p_prospect uuid, p_le timestamptz)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  jour date := (p_le at time zone 'Europe/Paris')::date;
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  update public.prospects
  set
    date_dernier_contact = greatest(coalesce(date_dernier_contact, jour), jour),
    -- « Relancé » ne signifie pas « réponse reçue » : seul « À traiter » change.
    statut = case when statut = 'a_traiter' then 'relance'::public.statut_prospect else statut end
  where id = p_prospect and utilisateur_id = uid;
  if not found then
    raise exception 'Prospect introuvable' using errcode = 'P0002';
  end if;
  perform public.recalculer_prospects();
end;
$$;

comment on function public.enregistrer_contact(uuid, timestamptz) is
  'Prend en compte un contact réellement effectué : date de dernier contact, statut, score.';

-- ---------------------------------------------------------------------------
-- Enregistrement d'une activité (une transaction, idempotent)
-- ---------------------------------------------------------------------------
-- p_id est généré par l'application : rejouer la même demande (nouvelle tentative après une
-- coupure réseau) ne crée pas de doublon et n'applique pas deux fois les effets.
-- p_modifier_prochaine : la prochaine action du dossier est remplacée par p_prochaine_action
-- (null = aucune). Sinon, elle est laissée telle quelle.

create function public.enregistrer_activite(
  p_id uuid,
  p_prospect uuid,
  p_type text,
  p_canal text,
  p_resume text,
  p_effectuee_le timestamptz,
  p_prochaine_action date,
  p_modifier_prochaine boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  opposition timestamptz;
  inserees integer;
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_type is null or p_type not in ('relance', 'appel', 'message', 'note', 'prochaine_action') then
    raise exception 'Type d''activité inconnu' using errcode = '22023';
  end if;
  if p_effectuee_le is null or p_effectuee_le > now() + interval '5 minutes' then
    raise exception 'Date d''activité invalide' using errcode = '22023';
  end if;
  if p_type = 'prochaine_action' and (p_prochaine_action is null or not p_modifier_prochaine) then
    raise exception 'Date de prochaine action manquante' using errcode = '22023';
  end if;

  if p_type in ('relance', 'appel', 'message') then
    select opposition_prospection_le into opposition
    from public.prospects where id = p_prospect and utilisateur_id = uid;
    if opposition is not null then
      raise exception 'Opposition à la prospection enregistrée' using errcode = 'P0001';
    end if;
  end if;

  insert into public.relances (id, prospect_id, utilisateur_id, type, canal, resume, effectuee_le, prochaine_action_le)
  values (
    p_id, p_prospect, uid, p_type, p_canal, nullif(btrim(p_resume), ''), p_effectuee_le,
    case when p_modifier_prochaine then p_prochaine_action end
  )
  on conflict (id) do nothing;
  get diagnostics inserees = row_count;
  if inserees = 0 then
    return false; -- déjà enregistrée : aucun effet appliqué une seconde fois
  end if;

  if p_modifier_prochaine then
    update public.prospects set prochaine_action_le = p_prochaine_action
    where id = p_prospect and utilisateur_id = uid;
  end if;

  if p_type in ('relance', 'appel', 'message') then
    perform public.enregistrer_contact(p_prospect, p_effectuee_le);
  end if;
  return true;
end;
$$;

comment on function public.enregistrer_activite(uuid, uuid, text, text, text, timestamptz, date, boolean) is
  'Enregistre une activité de l''utilisateur connecté et ses effets (contact, prochaine action).';

revoke execute on function public.enregistrer_contact(uuid, timestamptz) from public, anon;
revoke execute on function public.enregistrer_activite(uuid, uuid, text, text, text, timestamptz, date, boolean) from public, anon;
grant execute on function public.enregistrer_contact(uuid, timestamptz) to authenticated;
grant execute on function public.enregistrer_activite(uuid, uuid, text, text, text, timestamptz, date, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Tableau de bord : « gagné après une relance » ne compte que des relances vérifiables
-- (e-mail accepté par Brevo, ou relance / appel / message confirmé par l'agent). Une simple
-- copie ou ouverture dans Gmail n'est plus comptée comme une relance.
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
    where rl.prospect_id = p.id
      and (rl.envoi_statut = 'envoyee' or rl.type in ('relance', 'appel', 'message'))
    limit 1
  ) r on true
  where p.utilisateur_id = (select auth.uid());
$$;
