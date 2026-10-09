"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { safeRedirectPath } from "@/lib/auth/routes";

export type MagicLinkState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; email: string; message: string; field?: "email" };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Envoie un lien magique. Connexion et inscription suivent le même chemin (architecture
 * produit) : le compte est créé au premier lien. La réponse est identique que l'adresse
 * existe ou non, pour ne pas révéler quels emails ont un compte.
 */
export async function requestMagicLink(_previous: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeRedirectPath(String(formData.get("suivant") ?? ""));

  if (!email || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return { status: "error", email, field: "email", message: "Cette adresse ne semble pas valide" };
  }

  const redirectTo = new URL("/auth/confirm", getSiteUrl());
  if (next) redirectTo.searchParams.set("suivant", next);

  // Un verifier PKCE par demande : l'email reçu reste valable même si l'utilisateur en redemande un.
  const supabase = await createClient({ pkceFlowPerRequest: true });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo.toString() },
  });

  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit") {
      return {
        status: "error",
        email,
        message: "Trop de demandes rapprochées. Patientez une minute avant de redemander un lien.",
      };
    }
    console.error("[auth] envoi du lien magique impossible", { code: error.code, status: error.status });
    return { status: "error", email, message: "L'envoi du lien a échoué. Réessayez dans un instant." };
  }

  return { status: "sent", email };
}
