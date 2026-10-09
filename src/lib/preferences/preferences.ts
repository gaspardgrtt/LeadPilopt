// Préférences d'affichage (page Paramètres) : thème et langue. Source de vérité par utilisateur :
// colonnes `utilisateurs.theme` / `utilisateurs.langue` (RLS). Une copie en cookie permet
// d'appliquer la préférence dès le premier affichage (avant hydratation) et sur la page de
// connexion, où aucun compte n'est encore connu. Module partagé serveur / navigateur.

export const THEMES = ["clair", "sombre", "systeme"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export const DEFAULT_THEME: Theme = "systeme";
export const DEFAULT_LANGUE: Langue = "fr";

export const THEME_COOKIE = "lp-theme";
export const LANGUE_COOKIE = "lp-langue";
/** Un an : la préférence survit aux redémarrages et aux déconnexions sur cet appareil. */
export const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isLangue(value: unknown): value is Langue {
  return typeof value === "string" && (LANGUES as readonly string[]).includes(value);
}

export const parseTheme = (value: unknown): Theme => (isTheme(value) ? value : DEFAULT_THEME);
export const parseLangue = (value: unknown): Langue => (isLangue(value) ? value : DEFAULT_LANGUE);

/** Thème sombre effectif : choix explicite, ou réglage de l'ordinateur pour « systeme ». */
export function resolveDark(theme: Theme, systemPrefersDark: boolean): boolean {
  return theme === "sombre" || (theme === "systeme" && systemPrefersDark);
}

/** Valeur d'un cookie dans une chaîne `document.cookie`. */
export function readCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Attributs du cookie de préférence (lisible par le script : pas httpOnly ; ne contient aucun secret). */
export function preferenceCookie(name: string, value: string, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${PREFERENCE_COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/**
 * Script exécuté dans <head> avant le premier affichage : pose la classe `dark` sur <html> d'après
 * le cookie et le réglage du système, pour éviter tout flash de thème clair.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/);var t=m?decodeURIComponent(m[1]):"${DEFAULT_THEME}";var d=t==="sombre"||(t!=="clair"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(_){}})();`;

/** Applique le thème au document (changement immédiat depuis la page Paramètres). */
export function applyTheme(theme: Theme, doc: Document = document, systemPrefersDark?: boolean): boolean {
  const prefersDark = systemPrefersDark ?? doc.defaultView?.matchMedia("(prefers-color-scheme: dark)").matches ?? false;
  const dark = resolveDark(theme, prefersDark);
  doc.documentElement.classList.toggle("dark", dark);
  doc.documentElement.style.colorScheme = dark ? "dark" : "light";
  return dark;
}
