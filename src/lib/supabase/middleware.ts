import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { HOME_PATH, LOGIN_PATH, isPublicPath } from "@/lib/auth/routes";
import { getSupabaseEnv } from "./env";

/**
 * Rafraîchit la session Supabase à chaque requête et protège les routes :
 * - sans session, toute route non publique redirige vers /connexion?suivant=<chemin> ;
 * - avec session, /connexion redirige vers le tableau de bord.
 * Les pages revérifient l'utilisateur côté serveur (requireUser) : le middleware n'est pas
 * la seule barrière.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // En-têtes fournis par @supabase/ssr avec les cookies renouvelés (Cache-Control: private,
  // no-store…) : une réponse qui pose une session ne doit jamais être mise en cache par un CDN.
  let authHeaders: Record<string, string> = {};

  const env = getSupabaseEnv();
  if (!env) {
    // Sans configuration, aucune page protégée ne peut s'afficher : requireUser lève une erreur
    // explicite. En production, on refuse directement.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Configuration Supabase manquante.", { status: 500 });
    }
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        authHeaders = { ...authHeaders, ...headers };
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Ne rien placer entre la création du client et getClaims() : c'est cet appel
  // qui vérifie le jeton et le renouvelle si nécessaire.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && !isPublicPath(pathname)) {
    // Les routes d'API répondent en JSON : une redirection vers une page HTML serait illisible côté client.
    if (pathname.startsWith("/api/")) {
      const unauthorized = NextResponse.json({ message: "Session expirée : reconnectez-vous." }, { status: 401 });
      response.cookies.getAll().forEach((cookie) => unauthorized.cookies.set(cookie));
      Object.entries(authHeaders).forEach(([key, value]) => unauthorized.headers.set(key, value));
      return unauthorized;
    }
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.search = "";
    if (pathname !== "/") url.searchParams.set("suivant", `${pathname}${search}`);
    return redirectWithCookies(url, response, authHeaders);
  }

  if (isAuthenticated && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PATH;
    url.search = "";
    return redirectWithCookies(url, response, authHeaders);
  }

  return response;
}

/** Redirige en conservant les cookies de session éventuellement renouvelés et leurs en-têtes. */
function redirectWithCookies(url: URL, from: NextResponse, headers: Record<string, string>) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  Object.entries(headers).forEach(([key, value]) => redirect.headers.set(key, value));
  return redirect;
}
