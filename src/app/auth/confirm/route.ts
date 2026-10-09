import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { FIRST_RUN_PATH, HOME_PATH, LOGIN_PATH, safeRedirectPath } from "@/lib/auth/routes";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "email_change"];

/**
 * Atterrissage du lien magique.
 * - `token_hash` + `type` : modèles d'email LeadPilot (supabase/templates), fonctionne même si
 *   le lien est ouvert dans un autre navigateur que celui de la demande ;
 * - `code` : flux PKCE du modèle d'email par défaut de Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("suivant"));

  const supabase = await createClient();
  let error: unknown = null;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = new Error("Lien incomplet");
  }

  if (error) {
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?erreur=lien-invalide`, request.url));
  }

  if (next) return NextResponse.redirect(new URL(next, request.url));

  // Premier passage (aucun prospect) → import ; sinon tableau de bord (spéc. UX/UI E1).
  const { count } = await supabase.from("prospects").select("id", { count: "exact", head: true });
  return NextResponse.redirect(new URL(count ? HOME_PATH : FIRST_RUN_PATH, request.url));
}
