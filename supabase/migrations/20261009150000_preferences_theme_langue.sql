-- Préférences d'affichage par utilisateur (page Paramètres) : thème et langue de l'interface.
-- Migration additive : valeurs par défaut pour les comptes existants, aucune donnée modifiée.
-- Modifiables uniquement par l'utilisateur lui-même (RLS « utilisateurs_modification_soi » et
-- droits par colonne, comme les autres réglages).

alter table public.utilisateurs
  add column theme text not null default 'systeme' check (theme in ('clair', 'sombre', 'systeme')),
  add column langue text not null default 'fr' check (langue in ('fr', 'en'));

comment on column public.utilisateurs.theme is 'Thème de l''interface : clair, sombre ou systeme (réglage de l''ordinateur).';
comment on column public.utilisateurs.langue is 'Langue de l''interface (fr, en). Les relances envoyées aux prospects restent en français.';

grant update (theme, langue) on public.utilisateurs to authenticated;
