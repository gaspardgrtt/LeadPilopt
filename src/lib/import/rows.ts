import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";
import { DEAL_STAGES, type DealStage } from "@/lib/prospects";

import {
  IDENTITY_FIELDS,
  IMPORT_FIELDS,
  MAX_RAW_VALUE_LENGTH,
  REQUIRED_FIELDS,
  type ColumnMapping,
  type ImportFieldKey,
  type MissingRequirement,
} from "./fields";
import { cleanText, normalizeLabel, parseAmount, parseDate, parseEmail, parsePhone, parseStage } from "./normalize";

/** Ligne prête à être enregistrée dans `prospects` (hors utilisateur, import et calculs). */
export type ImportRow = {
  /** Null pour un particulier : aucune entreprise n'est inventée. */
  entreprise: string | null;
  /** Nom complet (« Prénom Nom ») ; prénom et nom d'origine restent aussi dans `donnees_brutes`. */
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
  /** Lignes du fichier contenant au moins une valeur. */
  lines: number;
  /** Lignes invalides, écartées (ni entreprise ni nom du contact). */
  skipped: ImportIssue[];
  /** Remarques sur des lignes conservées (date absente, e-mail illisible…). */
  warnings: ImportIssue[];
  /** Nombre de lignes conservées qui ont au moins une remarque. */
  linesWithWarnings: number;
  /** Lignes en double dans le fichier : la dernière version est conservée. */
  duplicates: number;
  averageAmount: number | null;
};

/** Associations sûres (appliquées) et suggestions à confirmer par l'utilisateur. */
export type ColumnAnalysis = {
  mapping: ColumnMapping;
  suggestions: Partial<Record<ImportFieldKey, string>>;
};

const emptyMapping = () => Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, null])) as ColumnMapping;
const compact = (label: string) => label.replace(/ /g, "");

/** « exact » : même en-tête après normalisation ; « partiel » : le synonyme est un mot de l'en-tête. */
function headerMatch(label: string, synonym: string): "exact" | "partiel" | null {
  if (label === synonym || compact(label) === compact(synonym)) return "exact";
  if (` ${label} `.includes(` ${synonym} `)) return "partiel";
  return null;
}

/** En-têtes « nom » seuls : nom de famille à côté d'un prénom, sinon ambigus. */
const BARE_NAME_LABELS = new Set(["nom", "name", "nom client", "nom du client"]);

const SAMPLE_SIZE = 50;
const PHONE_LIKE = /^\+?[\d\s.\-()]{8,20}$/;

/** Part des valeurs non vides qui satisfont `test` (null si la colonne est vide). */
function share(values: string[], test: (value: string) => boolean): number | null {
  if (values.length === 0) return null;
  return values.filter(test).length / values.length;
}

const CONTENT_TESTS: Partial<Record<ImportFieldKey, (value: string) => boolean>> = {
  email: (value) => parseEmail(value).value !== null,
  telephone: (value) => PHONE_LIKE.test(value) && /^(\+|0)/.test(value) && value.replace(/\D/g, "").length >= 8,
  dernier_contact: (value) => parseDate(value).value !== null,
  montant: (value) => parseAmount(value).value !== null,
};

/**
 * Associe les colonnes du fichier aux champs Izmo, d'après les en-têtes puis les valeurs.
 * Seules les correspondances sans ambiguïté sont appliquées ; les autres sont des suggestions.
 * « nom » n'est jamais associé à l'entreprise.
 */
export function analyzeColumns(headers: string[], records: Record<string, string>[] = []): ColumnAnalysis {
  const columns = headers.map((header) => ({ header, label: normalizeLabel(header) }));
  const mapping = emptyMapping();
  const suggestions: ColumnAnalysis["suggestions"] = {};
  const used = new Set<string>();
  const isFree = (header: string) => !used.has(header) && !Object.values(suggestions).includes(header);
  const take = (key: ImportFieldKey, header: string) => {
    mapping[key] = header;
    used.add(header);
  };
  const suggest = (key: ImportFieldKey, header: string) => {
    if (!mapping[key] && !suggestions[key] && isFree(header)) suggestions[key] = header;
  };
  const samples = (header: string) =>
    records
      .slice(0, SAMPLE_SIZE)
      .map((record) => (typeof record[header] === "string" ? record[header].trim() : ""))
      .filter(Boolean);

  const pass = (synonymsOf: (field: (typeof IMPORT_FIELDS)[number]) => readonly string[], kind: "exact" | "partiel", certain: (synonym: string) => boolean) => {
    for (const field of IMPORT_FIELDS) {
      if (mapping[field.key] || suggestions[field.key]) continue;
      for (const synonym of synonymsOf(field)) {
        const found = columns.find(({ header, label }) => isFree(header) && headerMatch(label, synonym) === kind);
        if (found) {
          if (certain(synonym)) take(field.key, found.header);
          else suggest(field.key, found.header);
          break;
        }
      }
    }
  };

  // 1. En-têtes identiques à un synonyme sûr.
  pass((field) => field.synonyms, "exact", () => true);

  // 2. « nom » seul : nom de famille s'il y a une colonne prénom (le contact complet est reconstruit),
  //    sinon nom complet probable, à confirmer. Jamais l'entreprise.
  const bareName = columns.find(({ header, label }) => isFree(header) && BARE_NAME_LABELS.has(label));
  if (bareName) {
    if (mapping.prenom && !mapping.nom) take("nom", bareName.header);
    else if (!mapping.contact) suggest("contact", bareName.header);
  }

  // 3. Synonyme de plusieurs mots contenu dans l'en-tête (« Montant de l'affaire (€) ») : sûr.
  pass((field) => field.synonyms.filter((synonym) => synonym.includes(" ")), "partiel", () => true);
  // 4. En-têtes ambigus connus (« date », « estimation ») : suggestion.
  pass((field) => field.weak, "exact", () => false);
  // 5. Un seul mot du synonyme dans l'en-tête (« Contact principal ») : suggestion.
  pass((field) => field.synonyms.filter((synonym) => !synonym.includes(" ") && synonym.length >= 4), "partiel", () => false);

  // 6. Une association d'après l'en-tête dont les valeurs ne correspondent pas (« Date » remplie de
  //    texte) redevient une suggestion : elle n'est jamais présentée comme certaine.
  for (const [key, test] of Object.entries(CONTENT_TESTS) as [ImportFieldKey, (value: string) => boolean][]) {
    const header = mapping[key];
    if (!header) continue;
    const ratio = share(samples(header), test);
    if (ratio !== null && ratio < 0.5) {
      mapping[key] = null;
      used.delete(header);
      suggest(key, header);
    }
  }

  // 7. Colonnes aux en-têtes inconnus dont les valeurs ressemblent à des e-mails, téléphones ou dates.
  for (const key of ["email", "telephone", "dernier_contact"] as const) {
    if (mapping[key] || suggestions[key]) continue;
    const found = columns.find(({ header }) => isFree(header) && (share(samples(header), CONTENT_TESTS[key]!) ?? 0) >= 0.8);
    if (found) suggest(key, found.header);
  }

  return { mapping, suggestions };
}

/** Associations sûres uniquement (voir `analyzeColumns` pour les suggestions). */
export function guessMapping(headers: string[], records: Record<string, string>[] = []): ColumnMapping {
  return analyzeColumns(headers, records).mapping;
}

export function missingRequiredFields(mapping: ColumnMapping): MissingRequirement[] {
  const missing: MissingRequirement[] = IDENTITY_FIELDS.some((key) => mapping[key]) ? [] : ["identite"];
  return [...missing, ...REQUIRED_FIELDS.filter((key) => !mapping[key])];
}

/** Nom sur une seule ligne, espaces normalisés. */
function cleanName(value: string | undefined): string | null {
  return cleanText(value?.replace(/\s+/g, " "), 200);
}

/**
 * Clé de dédoublonnage, identique à la colonne générée `prospects.cle_import` : e-mail +
 * entreprise ; pour un particulier, nom + e-mail (ou téléphone sans e-mail). L'entreprise est
 * comparée sans casse, ce qui fusionne au plus quelques lignes de plus que la base.
 */
export function importKey(row: Pick<ImportRow, "entreprise" | "contact_nom" | "contact_email" | "contact_telephone">): string {
  if (row.entreprise) return `e:${row.contact_email ?? ""}\n${row.entreprise.toLowerCase()}`;
  const reach = row.contact_email !== null ? `m:${row.contact_email}` : `t:${row.contact_telephone ?? ""}`;
  return `p:${(row.contact_nom ?? "").trim().toLowerCase()}\n${reach}`;
}

function parisToday(today: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(today);
}

/** Construit les lignes à importer à partir des enregistrements du fichier (ligne 1 = en-têtes). */
export function buildImportRows(
  records: Record<string, string>[],
  mapping: ColumnMapping,
  locale: Langue = "fr",
  today: Date = new Date()
): ImportPreview {
  const t = getMessages(locale).import.errors;
  const get = (record: Record<string, string>, key: ImportFieldKey) => {
    const column = mapping[key];
    const value = column ? record[column] : undefined;
    return typeof value === "string" ? value : undefined;
  };
  const todayIso = parisToday(today);
  // Sans colonne d'identité associée, aucune ligne n'est jugée : c'est l'association qui est
  // incomplète (message de l'étape « Colonnes »), pas le contenu du fichier.
  const identityMapped = IDENTITY_FIELDS.some((key) => mapping[key]);

  const byKey = new Map<string, { row: ImportRow; line: number }>();
  const skipped: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  /** Clés des lignes conservées qui ont au moins une remarque. */
  const warnedKeys = new Set<string>();
  let lines = 0;
  let duplicates = 0;

  records.forEach((record, index) => {
    const line = index + 2;
    if (!Object.values(record).some((value) => typeof value === "string" && value.trim())) return;
    lines += 1;

    const entreprise = cleanText(get(record, "entreprise"), 200);
    const prenom = cleanName(get(record, "prenom"));
    const nom = cleanName(get(record, "nom"));
    const contact = cleanName(get(record, "contact")) ?? cleanName([prenom, nom].filter(Boolean).join(" "));
    if (!entreprise && !contact) {
      if (identityMapped) skipped.push({ line, message: t.missingIdentity });
      return;
    }

    const lineWarnings: string[] = [];
    const email = parseEmail(get(record, "email"), locale);
    const phone = parsePhone(get(record, "telephone"), locale);
    const amount = parseAmount(get(record, "montant"), locale);
    let date = parseDate(get(record, "dernier_contact"), locale);
    const stage = parseStage(get(record, "statut"));
    for (const parsed of [email, phone, amount, date]) {
      if (parsed.error) lineWarnings.push(parsed.error);
    }
    if (date.value && date.value > todayIso) {
      lineWarnings.push(t.futureDate(get(record, "dernier_contact")!.trim()));
      date = { value: null };
    } else if (mapping.dernier_contact && !date.value && !date.error) {
      lineWarnings.push(t.missingDate);
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
      contact_nom: contact,
      contact_email: email.value,
      contact_telephone: phone.value,
      montant_eur: amount.value,
      date_dernier_contact: date.value,
      etape: stage.etape,
      etape_brute: stage.brute,
      notes: cleanText(get(record, "notes"), 5000),
      donnees_brutes: raw,
    };

    const key = importKey(row);
    const previous = byKey.get(key);
    if (previous) {
      duplicates += 1;
      lineWarnings.push(t.duplicateOf(previous.line));
      warnedKeys.delete(key);
    }
    byKey.set(key, { row, line });
    for (const message of lineWarnings) warnings.push({ line, message });
    if (lineWarnings.length) warnedKeys.add(key);
  });

  const rows = [...byKey.values()].map(({ row }) => row);
  const amounts = rows.map((row) => row.montant_eur).filter((value): value is number => value !== null && value > 0);
  const averageAmount = amounts.length ? amounts.reduce((sum, value) => sum + value, 0) / amounts.length : null;

  return { rows, lines, skipped, warnings, linesWithWarnings: warnedKeys.size, duplicates, averageAmount };
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
  if ([entreprise, contactNom, email, phone, date, etapeBrute, notes].some((value) => value === undefined)) return null;
  // Entreprise ou nom du contact : un particulier n'a pas d'entreprise, mais il a un nom.
  if (!entreprise?.trim() && !contactNom?.trim()) return null;
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
    entreprise: entreprise?.trim() || null,
    contact_nom: contactNom?.trim() || null,
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
