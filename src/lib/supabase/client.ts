import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

/** Client Supabase pour les composants client. */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
