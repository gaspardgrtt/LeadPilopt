// Règles de routage de l'authentification, partagées par le middleware et les handlers.

export const LOGIN_PATH = "/connexion";
export const HOME_PATH = "/tableau-de-bord";
export const FIRST_RUN_PATH = "/import";

/** Routes accessibles sans session. */
const PUBLIC_PATHS = [LOGIN_PATH, "/auth/"];

/** Catalogue UI : public en développement uniquement (404 en production). */
const DEV_PUBLIC_PATHS = ["/ui"];

export function isPublicPath(pathname: string) {
  const matches = (path: string) =>
    path.endsWith("/") ? pathname.startsWith(path) : pathname === path || pathname.startsWith(`${path}/`);
  if (PUBLIC_PATHS.some(matches)) return true;
  return process.env.NODE_ENV !== "production" && DEV_PUBLIC_PATHS.some(matches);
}

/**
 * N'accepte qu'un chemin interne (« /prospects?vue=tous ») comme destination après connexion :
 * empêche les redirections ouvertes vers un autre domaine (« //evil.com », « https://… »).
 */
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith(LOGIN_PATH) || value.startsWith("/auth/")) return null;
  return value;
}
