"use client";

import * as React from "react";

import {
  THEME_COOKIE,
  applyTheme,
  parseTheme,
  preferenceCookie,
  readCookie,
  type Theme,
} from "@/lib/preferences/preferences";

/**
 * Suit le réglage clair / sombre de l'ordinateur quand le thème choisi est « Système ».
 * Monté une fois dans le layout racine (pages connectées et page de connexion).
 */
export function SystemThemeListener() {
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(parseTheme(readCookie(document.cookie, THEME_COOKIE)), document, media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return null;
}

/**
 * Aligne le cookie de l'appareil sur la préférence enregistrée dans le compte (nouvel appareil,
 * reconnexion) : la préférence du compte fait foi.
 */
export function ThemeFromAccount({ theme }: { theme: Theme }) {
  React.useEffect(() => {
    if (readCookie(document.cookie, THEME_COOKIE) !== theme) {
      document.cookie = preferenceCookie(THEME_COOKIE, theme, window.location.protocol === "https:");
    }
    applyTheme(theme);
  }, [theme]);
  return null;
}
