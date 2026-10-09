"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./routes";

/** Termine la session (cookies supprimés) et renvoie vers la connexion. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
