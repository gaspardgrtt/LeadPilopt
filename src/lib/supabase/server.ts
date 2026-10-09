import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

type ClientOptions = {
  /**
   * Un « code verifier » PKCE par demande de lien, identifié par `sb_flow_id` dans l'URL de
   * retour : redemander un lien n'invalide plus les précédents (sinon le cookie ne garde que le
   * dernier verifier et l'ancien lien échoue). Option `experimental` de supabase-js, version figée.
   */
  pkceFlowPerRequest?: boolean;
};

/** Client Supabase pour les Server Components, Server Actions et Route Handlers. */
export async function createClient({ pkceFlowPerRequest = false }: ClientOptions = {}) {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    ...(pkceFlowPerRequest ? { auth: { experimental: { appendPkceFlowIdToRedirects: true } } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le middleware se charge de rafraîchir la session.
        }
      },
    },
  });
}
