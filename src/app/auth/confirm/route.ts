import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { FIRST_RUN_PATH, HOME_PATH, LOGIN_PATH, safeRedirectPath } from "@/lib/auth/routes";
import { linkErrorFromCode, type LinkError } from "@/lib/auth/link-errors";
import { LANGUE_COOKIE, PREFERENCE_COOKIE_MAX_AGE, THEME_COOKIE, isLangue, isTheme } from "@/lib/preferences/preferences";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "email_change"];

/**
 * Atterrissage du lien magique. Une requête n'utilise qu'une seule méthode, choisie d'après les
 * paramètres du lien :
 * - `code` (+ `sb_flow_id`) : flux PKCE du modèle d'email par défaut de Supabase, celui utilisé
 *   aujourd'hui. Supabase a déjà vérifié le lien et redirige ici avec un code, échangé contre une
 *   session grâce au « code verifier » posé en cookie par le navigateur qui a demandé le lien.
 *   `sb_flow_id` désigne le verifier de cette demande précise (un nouveau lien n'invalide plus
 *   les précédents) ;
 * - `token_hash` + `type` : modèles d'email LeadPilot (supabase/templates), utilisables une fois un
 *   SMTP personnalisé configuré ; fonctionne depuis n'importe quel navigateur.
 * - `error` / `error_code` : Supabase a refusé le lien avant de rediriger (expiré, déjà ouvert).
 * Chaque échec renvoie vers /connexion avec sa cause précise, journalisée sans secret.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("suivant"));
  const supabase = await createClient();

  async function fail(reason: LinkError, details: { method: string; code: string | null }) {
    console.warn("[auth] lien de connexion refusé", { ...details, reason });
    // Lien déjà consommé alors qu'une session est ouverte (double clic, messagerie qui ouvre le
    // lien deux fois) : inutile d'afficher une erreur, l'utilisateur est connecté.
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) return NextResponse.redirect(new URL(next ?? HOME_PATH, request.url));
    return NextResponse.redirect(new URL(`${LOGIN_PATH}?erreur=${reason}`, request.url));
  }

  const supabaseError = searchParams.get("error_code") ?? searchParams.get("error");
  if (supabaseError) {
    return fail(linkErrorFromCode(searchParams.get("error_code")), { method: "supabase", code: supabaseError });
  }

  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");

  if (tokenHash) {
    const type = searchParams.get("type") as EmailOtpType | null;
    if (!type || !OTP_TYPES.includes(type)) return fail("lien-invalide", { method: "token_hash", code: "type_invalide" });
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail(linkErrorFromCode(error.code), { method: "token_hash", code: error.code ?? null });
  } else if (code) {
    const flowId = searchParams.get("sb_flow_id");
    const { error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) return fail(linkErrorFromCode(error.code), { method: "pkce", code: error.code ?? null });
  } else {
    return fail("lien-invalide", { method: "aucune", code: "parametres_absents" });
  }

  // Préférences du compte (thème, langue) recopiées en cookies dès la connexion : sur un nouvel
  // appareil, la première page s'affiche directement dans la bonne langue et le bon thème.
  const { data: preferences } = await supabase.from("utilisateurs").select("theme, langue").maybeSingle();
  const withPreferences = (response: NextResponse) => {
    const options = { path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: "lax" as const, secure: request.nextUrl.protocol === "https:" };
    if (isTheme(preferences?.theme)) response.cookies.set(THEME_COOKIE, preferences.theme, options);
    if (isLangue(preferences?.langue)) response.cookies.set(LANGUE_COOKIE, preferences.langue, options);
    return response;
  };

  if (next) return withPreferences(NextResponse.redirect(new URL(next, request.url)));

  // Premier passage (aucun prospect) → import ; sinon tableau de bord (spéc. UX/UI E1).
  const { count } = await supabase.from("prospects").select("id", { count: "exact", head: true });
  return withPreferences(NextResponse.redirect(new URL(count ? HOME_PATH : FIRST_RUN_PATH, request.url)));
}
