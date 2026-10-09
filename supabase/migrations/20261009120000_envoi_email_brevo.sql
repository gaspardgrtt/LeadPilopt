-- Envoi des relances par e-mail (Brevo) et respect de l'opposition à la prospection.
-- Migration additive : aucune donnée existante n'est modifiée ni supprimée.

-- Opposition à la prospection (désabonnement, « STOP », demande orale…) : tant qu'elle est
-- renseignée, LeadPilot refuse tout envoi et désactive l'ouverture dans Gmail pour ce prospect.
alter table public.prospects
  add column opposition_prospection_le timestamptz;

comment on column public.prospects.opposition_prospection_le is
  'Date à laquelle le prospect s''est opposé à la prospection ; null = aucune opposition enregistrée.';

-- Suivi de l'envoi par Brevo. Le passage à « en_cours » est atomique (une seule requête peut
-- réserver une relance) : c'est la protection contre les doubles envois.
alter table public.relances
  add column envoi_statut text check (envoi_statut in ('en_cours', 'envoyee', 'echec')),
  add column envoi_demande_le timestamptz,
  add column envoyee_le timestamptz,
  add column envoyee_a text check (char_length(envoyee_a) <= 320),
  add column brevo_message_id text check (char_length(brevo_message_id) <= 300),
  add column envoi_erreur text check (char_length(envoi_erreur) <= 300),
  add constraint relances_envoi_coherent check (
    (envoi_statut = 'envoyee') = (envoyee_le is not null and envoyee_a is not null)
  );

comment on column public.relances.envoi_statut is
  'Envoi par e-mail (Brevo) : en_cours (réservé), envoyee (accepté par Brevo), echec ; null = jamais envoyé.';
comment on column public.relances.brevo_message_id is 'Identifiant du message renvoyé par Brevo (messageId).';

-- Limite d'envoi par compte (calculée sur les envois récents) : index dédié.
create index relances_envoyees_recentes on public.relances (utilisateur_id, envoi_demande_le)
  where envoi_demande_le is not null;
