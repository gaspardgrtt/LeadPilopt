-- Le recalcul s'exécute avec les droits de l'appelant (recommandation de l'audit Supabase,
-- lint 0029) : la Row Level Security limite la lecture des réglages et la mise à jour aux
-- prospects de l'utilisateur connecté. Viser un autre compte ne modifie donc aucune ligne.
-- Le recalcul quotidien (pg_cron) reste exécuté par le propriétaire des tables.

alter function public.recalculer_prospects_de(uuid) security invoker;
alter function public.recalculer_prospects() security invoker;

grant execute on function public.recalculer_prospects_de(uuid) to authenticated;
