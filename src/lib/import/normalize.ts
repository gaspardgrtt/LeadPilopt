import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";
import type { DealStage } from "@/lib/prospects";

// Lecture tolérante des valeurs d'un export CRM. Partagé entre le navigateur (aperçu) et le
// serveur (revalidation) : aucune dépendance au DOM ni à Node.

export type Parsed<T> = { value: T | null; error?: string };

/** « Date dernier contact » → « date dernier contact » (minuscules, sans accents ni ponctuation). */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Texte nettoyé (espaces superflus), tronqué, null si vide. */
export function cleanText(value: string | undefined | null, maxLength: number): string | null {
  if (value == null) return null;
  const text = value.replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

/**
 * Montants : « 15 000 € », « 15000,50 », « 15.000 », « $15,000.00 », « 1’250 ».
 * Une virgule ou un point suivi d'exactement 3 chiffres est lu comme un séparateur de milliers.
 */
export function parseAmount(raw: string | undefined | null, locale: Langue = "fr"): Parsed<number> {
  const text = (raw ?? "").trim();
  if (!text) return { value: null };
  if (/^-|\(.*\)$/.test(text)) return { value: null, error: getMessages(locale).import.errors.negativeAmount(text) };

  let digits = text.replace(/[^\d,.]/g, "");
  if (!/\d/.test(digits)) return { value: null, error: getMessages(locale).import.errors.badAmount(text) };

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    digits = digits.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? "," : ".";
    const parts = digits.split(separator);
    const thousandsGrouping = parts.length > 2 || (parts.length === 2 && parts[1].length === 3 && parts[0] !== "0");
    digits = thousandsGrouping ? parts.join("") : parts.join(".");
  }

  const value = Number(digits);
  if (!Number.isFinite(value) || value > 1e10) return { value: null, error: getMessages(locale).import.errors.badAmount(text) };
  return { value: Math.round(value * 100) / 100 };
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1, jan: 1, january: 1,
  fevrier: 2, fevr: 2, fev: 2, feb: 2, february: 2,
  mars: 3, mar: 3, march: 3,
  avril: 4, avr: 4, apr: 4, april: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6, june: 6,
  juillet: 7, juil: 7, jul: 7, july: 7,
  aout: 8, aug: 8, august: 8,
  septembre: 9, sept: 9, sep: 9, september: 9,
  octobre: 10, oct: 10, october: 10,
  novembre: 11, nov: 11, november: 11,
  decembre: 12, dec: 12, december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const maxYear = new Date().getUTCFullYear() + 1;
  if (year < 1990 || year > maxYear) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Dates : « 2026-09-04 », « 2026-09-04T10:30:00Z », « 04/09/2026 », « 4.9.26 », « 4 sept. 2026 »,
 * « Sep 4, 2026 », numéro de série Excel. JJ/MM par défaut ; MM/JJ si le jour ne peut pas être le
 * premier nombre (« 09/24/2026 »).
 */
export function parseDate(raw: string | undefined | null, locale: Langue = "fr"): Parsed<string> {
  const text = (raw ?? "").trim();
  if (!text) return { value: null };
  const invalid = { value: null, error: getMessages(locale).import.errors.badDate(text) };

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    const value = isoDate(+match[1], +match[2], +match[3]);
    return value ? { value } : invalid;
  }

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T\s].*)?$/);
  if (match) {
    const [a, b, year] = [+match[1], +match[2], +match[3]];
    const [day, month] = a > 12 || b <= 12 ? [a, b] : [b, a];
    const value = isoDate(year, month, day);
    return value ? { value } : invalid;
  }

  const words = normalizeLabel(text).split(" ");
  if (words.length === 3) {
    const [first, second, third] = words;
    const dayFirst = MONTHS[second] && /^\d{1,2}$/.test(first) && /^\d{2,4}$/.test(third);
    const monthFirst = MONTHS[first] && /^\d{1,2}$/.test(second) && /^\d{2,4}$/.test(third);
    const value = dayFirst
      ? isoDate(+third, MONTHS[second], +first)
      : monthFirst
        ? isoDate(+third, MONTHS[first], +second)
        : null;
    if (value) return { value };
  }

  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const serial = Math.floor(Number(text));
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    const value = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    if (value) return { value };
  }

  return invalid;
}

// Mots-clés d'étapes, du plus spécifique au plus général (« closed won » avant « won »).
const STAGE_KEYWORDS: [DealStage, string[]][] = [
  ["perdu", ["closed lost", "perdu", "perdue", "lost", "abandon", "abandonne", "sans suite", "refuse", "annule"]],
  ["gagne", ["closed won", "gagne", "gagnee", "won", "signe", "signee", "conclu"]],
  ["negociation", ["negociation", "negotiation", "contract sent", "contrat envoye", "closing", "decision", "engagement"]],
  ["proposition", ["proposition", "proposal", "devis", "offre", "quote", "presentation", "demo"]],
  ["qualification", ["qualification", "qualifie", "qualified", "contacte", "contact made", "rendez vous", "rdv", "appointment"]],
  ["decouverte", ["decouverte", "discovery", "nouveau", "new", "lead", "prospect", "premier contact", "a contacter"]],
];

/** Statut ou étape CRM → étape LeadPilot (null si non reconnu ; la valeur brute est conservée). */
export function parseStage(raw: string | undefined | null): { etape: DealStage | null; brute: string | null } {
  const brute = cleanText(raw, 200);
  if (!brute) return { etape: null, brute: null };
  const label = ` ${normalizeLabel(brute)} `;
  for (const [stage, keywords] of STAGE_KEYWORDS) {
    if (keywords.some((keyword) => label.includes(` ${keyword} `))) return { etape: stage, brute };
  }
  return { etape: null, brute };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseEmail(raw: string | undefined | null, locale: Langue = "fr"): Parsed<string> {
  const text = (raw ?? "").trim().toLowerCase();
  if (!text) return { value: null };
  if (text.length > 320 || !EMAIL_PATTERN.test(text)) return { value: null, error: getMessages(locale).import.errors.badEmail(text) };
  return { value: text };
}

export function parsePhone(raw: string | undefined | null, locale: Langue = "fr"): Parsed<string> {
  const text = cleanText(raw, 60);
  if (!text) return { value: null };
  if (!/\d{4,}/.test(text.replace(/[\s.\-()]/g, "")) || text.length > 40) {
    return { value: null, error: getMessages(locale).import.errors.badPhone(text) };
  }
  return { value: text };
}
