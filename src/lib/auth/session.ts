import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./routes";

export type SessionUser = { id: string; email: string };

/**
 * Utilisateur de la requête, vérifié auprès de Supabase Auth (signature du JWT).
 * Mémorisé pour la durée du rendu : plusieurs composants peuvent l'appeler sans surcoût.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : "" };
});

/** À appeler en tête de toute page ou action protégée (défense en profondeur après le middleware). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}
