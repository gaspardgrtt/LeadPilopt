import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";
import { DEAL_STAGES, type DealStage } from "@/lib/prospects";

import {
  IMPORT_FIELDS,
  MAX_RAW_VALUE_LENGTH,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ImportFieldKey,
} from "./fields";
import { cleanText, normalizeLabel, parseAmount, parseDate, parseEmail, parsePhone, parseStage } from "./normalize";

/** Ligne prête à être enregistrée dans `prospects` (hors utilisateur, import et calculs). */
export type ImportRow = {
  entreprise: string;
  contact_nom: string | null;
  contact_email: string | null;
  contact_telephone: string | null;
  montant_eur: number | null;
  date_dernier_contact: string | null;
  etape: DealStage | null;
  etape_brute: string | null;
  notes: string | null;
  donnees_brutes: Record<string, string>;
};

export type ImportIssue = { line: number; message: string };

export type ImportPreview = {
  rows: ImportRow[];
  /** Lignes écartées (entreprise manquante…). */
  skipped: ImportIssue[];
  /** Valeurs ignorées dans des lignes conservées (montant illisible…). */
  warnings: ImportIssue[];
  /** Lignes en double (même entreprise et même email) : la dernière est conservée. */
  duplicates: number;
  averageAmount: number | null;
};

/** Devine la colonne du fichier correspondant à chaque champ : nom exact, puis nom contenant le synonyme. */
export function guessMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((header) => ({ header, label: normalizeLabel(header) }));
  const used = new Set<string>();
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, null])) as ColumnMapping;

  const assign = (match: (label: string, synonym: string) => boolean) => {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field.key]) continue;
      for (const synonym of field.synonyms) {
        const found = normalized.find(({ header, label }) => !used.has(header) && match(label, synonym));
        if (found) {
          mapping[field.key] = found.header;
          used.add(found.header);
          break;
        }
      }
    }
  };

  assign((label, synonym) => label === synonym);
  // Correspondance partielle uniquement pour les synonymes de plusieurs mots ou assez longs,
  // pour éviter que « mail » ne capture « mail du commercial ».
  assign((label, synonym) => (synonym.includes(" ") || synonym.length >= 6) && ` ${label} `.includes(` ${synonym} `));
  return mapping;
}

export function missingRequiredFields(mapping: ColumnMapping): ImportFieldKey[] {
  return REQUIRED_FIELDS.filter((key) => !mapping[key]);
}

/** Construit les lignes à importer à partir des enregistrements du fichier (ligne 1 = en-têtes). */
export function buildImportRows(records: Record<string, string>[], mapping: ColumnMapping, locale: Langue = "fr"): ImportPreview {
  const get = (record: Record<string, string>, key: ImportFieldKey) => {
    const column = mapping[key];
    return column ? record[column] : undefined;
  };

  const byKey = new Map<string, ImportRow>();
  const skipped: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  let duplicates = 0;

  records.forEach((record, index) => {
    const line = index + 2;
    const entreprise = cleanText(get(record, "entreprise"), 200);
    if (!entreprise) {
      if (Object.values(record).some((value) => value?.trim())) {
        skipped.push({ line, message: getMessages(locale).import.errors.missingCompany });
      }
      return;
    }

    const email = parseEmail(get(record, "email"), locale);
    const phone = parsePhone(get(record, "telephone"), locale);
    const amount = parseAmount(get(record, "montant"), locale);
    const date = parseDate(get(record, "dernier_contact"), locale);
    const stage = parseStage(get(record, "statut"));
    for (const parsed of [email, phone, amount, date]) {
      if (parsed.error) warnings.push({ line, message: parsed.error });
    }

    const raw: Record<string, string> = {};
    for (const [column, value] of Object.entries(record)) {
      // Les valeurs en trop sur une ligne (sans en-tête) arrivent sous forme de tableau : ignorées.
      if (typeof value !== "string") continue;
      const text = cleanText(value, MAX_RAW_VALUE_LENGTH);
      if (text && column.trim()) raw[column.trim().slice(0, 100)] = text;
    }

    const row: ImportRow = {
      entreprise,
      contact_nom: cleanText(get(record, "contact"), 200),
      contact_email: email.value,
      contact_telephone: phone.value,
      montant_eur: amount.value,
      date_dernier_contact: date.value,
      etape: stage.etape,
      etape_brute: stage.brute,
      notes: cleanText(get(record, "notes"), 5000),
      donnees_brutes: raw,
    };

    // Même clé que la contrainte d'unicité en base (entreprise + email, email absent compris).
    const key = `${row.entreprise.toLowerCase()}\u0000${row.contact_email ?? ""}`;
    if (byKey.has(key)) duplicates += 1;
    byKey.set(key, row);
  });

  const rows = [...byKey.values()];
  const amounts = rows.map((row) => row.montant_eur).filter((value): value is number => value !== null && value > 0);
  const averageAmount = amounts.length ? amounts.reduce((sum, value) => sum + value, 0) / amounts.length : null;

  return { rows, skipped, warnings, duplicates, averageAmount };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function nullableString(value: unknown, max: number): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > max) return undefined;
  return value;
}

/**
 * Revalidation côté serveur d'une ligne reçue du navigateur : types, longueurs, valeurs
 * autorisées. Renvoie null si la ligne est invalide (le client ne doit jamais en envoyer).
 */
export function validateImportRow(input: unknown): ImportRow | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;

  const entreprise = nullableString(row.entreprise, 200);
  const contactNom = nullableString(row.contact_nom, 200);
  const email = nullableString(row.contact_email, 320);
  const phone = nullableString(row.contact_telephone, 40);
  const date = nullableString(row.date_dernier_contact, 10);
  const etapeBrute = nullableString(row.etape_brute, 200);
  const notes = nullableString(row.notes, 5000);
  if (!entreprise || !entreprise.trim()) return null;
  if ([contactNom, email, phone, date, etapeBrute, notes].some((value) => value === undefined)) return null;
  if (email && parseEmail(email).value !== email) return null;
  if (date && (!ISO_DATE.test(date) || parseDate(date).value !== date)) return null;

  const amount = row.montant_eur;
  if (amount !== null && (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 || amount > 1e10)) return null;

  const etape = row.etape;
  if (etape !== null && !(DEAL_STAGES as readonly unknown[]).includes(etape)) return null;

  const raw = row.donnees_brutes;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rawEntries = Object.entries(raw as Record<string, unknown>);
  if (rawEntries.length > 100) return null;
  if (rawEntries.some(([key, value]) => key.length > 100 || typeof value !== "string" || value.length > MAX_RAW_VALUE_LENGTH)) {
    return null;
  }

  return {
    entreprise: entreprise.trim(),
    contact_nom: contactNom ?? null,
    contact_email: email ?? null,
    contact_telephone: phone ?? null,
    montant_eur: amount as number | null,
    date_dernier_contact: date ?? null,
    etape: etape as DealStage | null,
    etape_brute: etapeBrute ?? null,
    notes: notes ?? null,
    donnees_brutes: Object.fromEntries(rawEntries) as Record<string, string>,
  };
}
