-- Taux de commission (facultatif) : affiche la « commission potentielle » dans le brief du matin,
-- uniquement quand il est renseigné. Aucune nouvelle table.

alter table public.utilisateurs
  add column taux_commission numeric(5, 2) check (taux_commission > 0 and taux_commission <= 100);

comment on column public.utilisateurs.taux_commission is 'Taux de commission en % du montant des affaires, pour estimer la commission potentielle.';

-- Réglage modifiable par l'utilisateur, comme les autres colonnes de réglages.
grant update (taux_commission) on public.utilisateurs to authenticated;
