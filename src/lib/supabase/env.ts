export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Clé publishable (sb_publishable_…) ; l'ancienne clé anon reste acceptée.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      "Variables Supabase manquantes : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.local (voir .env.example)."
    );
  }
  return env;
}

/**
 * URL publique de l'application, utilisée dans les liens envoyés par email.
 * En production elle doit être fixée par NEXT_PUBLIC_SITE_URL : on ne fait jamais confiance
 * à l'en-tête Host de la requête pour construire un lien de connexion.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL doit être défini en production (voir .env.example).");
  }
  return "http://localhost:3000";
}
