// Formats d'affichage (spéc. UX/UI §2) : « 48 300 € », « 1,2 M€ », « il y a 34 jours », « 4 sept. 2026 ».

import type { Langue } from "@/lib/preferences/preferences";

/** Locale Intl de chaque langue de l'interface (euros dans les deux cas). */
const INTL_LOCALE: Record<Langue, string> = { fr: "fr-FR", en: "en-GB" };

type Formatters = {
  euro: Intl.NumberFormat;
  compactEuro: Intl.NumberFormat;
  shortDate: Intl.DateTimeFormat;
  numericDate: Intl.DateTimeFormat;
  integer: Intl.NumberFormat;
};

const cache = new Map<Langue, Formatters>();

function formatters(locale: Langue): Formatters {
  let value = cache.get(locale);
  if (!value) {
    const tag = INTL_LOCALE[locale];
    value = {
      euro: new Intl.NumberFormat(tag, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
      compactEuro: new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }),
      shortDate: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" }),
      numericDate: new Intl.DateTimeFormat(tag, { day: "2-digit", month: "2-digit", year: "numeric" }),
      integer: new Intl.NumberFormat(tag),
    };
    cache.set(locale, value);
  }
  return value;
}

// Intl sépare les milliers par une espace fine insécable (U+202F), que la police ne rend pas aux
// petites tailles (« 21406 € ») : on la remplace par l'espace insécable classique (U+00A0).
const nbsp = (text: string) => text.replace(/\u202f/g, "\u00a0");

/** Montant en euros sans décimales ; au-delà d'un million : « 1,2 M€ » / « €1.2M ». */
export function formatEuro(amount: number, locale: Langue = "fr"): string {
  const f = formatters(locale);
  if (Math.abs(amount) >= 1_000_000) {
    const millions = nbsp(f.compactEuro.format(amount / 1_000_000));
    return locale === "en" ? `€${millions}M` : `${millions}\u00a0M€`;
  }
  return nbsp(f.euro.format(amount));
}

export function formatInteger(value: number, locale: Langue = "fr"): string {
  return nbsp(formatters(locale).integer.format(value));
}

/** Date longue des fiches : « 4 sept. 2026 » / « 4 Sept 2026 ». */
export function formatDate(date: Date | string, locale: Langue = "fr"): string {
  return formatters(locale).shortDate.format(typeof date === "string" ? new Date(date) : date);
}

/** Date compacte des tableaux : « 12/09/2026 ». */
export function formatNumericDate(date: Date | string, locale: Langue = "fr"): string {
  return formatters(locale).numericDate.format(typeof date === "string" ? new Date(date) : date);
}

/** Nombre de jours entiers écoulés depuis une date. */
export function daysSince(date: Date | string, now: Date = new Date()): number {
  const from = typeof date === "string" ? new Date(date) : date;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/** Ancienneté relative des listes : « aujourd'hui », « hier », « il y a 34 jours ». */
export function formatDaysAgo(days: number, locale: Langue = "fr"): string {
  if (locale === "en") return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Formateurs liés à une langue (composants : `useFormat()`, serveur : `getFormat()`). */
export function createFormat(locale: Langue) {
  return {
    locale,
    euro: (amount: number) => formatEuro(amount, locale),
    integer: (value: number) => formatInteger(value, locale),
    date: (date: Date | string) => formatDate(date, locale),
    numericDate: (date: Date | string) => formatNumericDate(date, locale),
    daysAgo: (days: number) => formatDaysAgo(days, locale),
  };
}

export type Format = ReturnType<typeof createFormat>;
