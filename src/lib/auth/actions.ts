"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./routes";

/**
 * Déconnecte cet appareil : la session est révoquée côté Supabase et ses cookies supprimés.
 * Portée « local » : les autres appareils de l'utilisateur restent connectés (la portée par défaut
 * de supabase-js, « global », déconnectait aussi le téléphone ou l'autre navigateur).
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(LOGIN_PATH);
}
