// Formats d'affichage (spéc. UX/UI §2) : « 48 300 € », « 1,2 M€ », « il y a 34 jours », « 4 sept. 2026 ».

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactEuro = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const numericDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const integer = new Intl.NumberFormat("fr-FR");

/** Montant en euros sans décimales ; au-delà d'un million : « 1,2 M€ ». */
export function formatEuro(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `${compactEuro.format(amount / 1_000_000)} M€`;
  }
  return euro.format(amount);
}

export function formatInteger(value: number): string {
  return integer.format(value);
}

/** Date longue des fiches : « 4 sept. 2026 ». */
export function formatDate(date: Date | string): string {
  return shortDate.format(typeof date === "string" ? new Date(date) : date);
}

/** Date compacte des tableaux : « 12/09/2026 ». */
export function formatNumericDate(date: Date | string): string {
  return numericDate.format(typeof date === "string" ? new Date(date) : date);
}

/** Nombre de jours entiers écoulés depuis une date. */
export function daysSince(date: Date | string, now: Date = new Date()): number {
  const from = typeof date === "string" ? new Date(date) : date;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/** Ancienneté relative des listes : « aujourd'hui », « hier », « il y a 34 jours ». */
export function formatDaysAgo(days: number): string {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}
