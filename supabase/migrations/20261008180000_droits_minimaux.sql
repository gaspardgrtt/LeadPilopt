-- Droits minimaux sur les tables métier.
-- Supabase accorde par défaut tous les droits à `authenticated`, dont TRUNCATE, qui contourne la
-- Row Level Security (il vide la table entière sans évaluer les policies). L'API PostgREST ne
-- l'expose pas, mais on retire ces droits inutiles par défense en profondeur.

revoke truncate, trigger, references on public.utilisateurs, public.prospects, public.relances from authenticated;
revoke all on public.utilisateurs, public.prospects, public.relances from anon;
