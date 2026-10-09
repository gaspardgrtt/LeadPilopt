// Champs reconnus à l'import (E2, étape 2) et noms de colonnes associés automatiquement.
// Les synonymes sont comparés après normalisation (minuscules, sans accents ni ponctuation).

export const IMPORT_FIELDS = [
  {
    key: "entreprise",
    label: "Entreprise",
    required: true,
    synonyms: [
      "entreprise", "societe", "nom entreprise", "nom de l entreprise", "raison sociale", "compagnie", "client",
      "company", "company name", "organisation", "organization", "organization name", "account", "account name",
      "associated company",
    ],
  },
  {
    key: "contact",
    label: "Contact",
    required: false,
    synonyms: [
      "contact", "nom du contact", "nom contact", "interlocuteur", "personne", "nom complet", "prenom nom", "nom",
      "contact name", "contact person", "full name", "name", "person",
    ],
  },
  {
    key: "email",
    label: "Email",
    required: false,
    synonyms: ["email", "e mail", "mail", "courriel", "adresse email", "adresse e mail", "email address", "contact email"],
  },
  {
    key: "telephone",
    label: "Téléphone",
    required: false,
    synonyms: [
      "telephone", "tel", "numero de telephone", "telephone mobile", "portable", "mobile", "phone", "phone number",
      "mobile phone", "mobile phone number",
    ],
  },
  {
    key: "montant",
    label: "Montant",
    required: false,
    synonyms: [
      "montant", "montant eur", "montant ht", "montant de l affaire", "valeur", "chiffre d affaires", "ca", "budget",
      "prix", "amount", "deal amount", "deal value", "value", "opportunity amount",
    ],
  },
  {
    key: "dernier_contact",
    label: "Date dernier contact",
    required: true,
    synonyms: [
      "date dernier contact", "dernier contact", "date du dernier contact", "date de dernier contact",
      "derniere activite", "date derniere activite", "date de la derniere activite", "derniere interaction",
      "last contact", "last contact date", "last contacted", "last activity", "last activity date",
      "date of last activity",
    ],
  },
  {
    key: "statut",
    label: "Statut",
    required: false,
    synonyms: [
      "statut", "statut de l affaire", "etape", "etape de l affaire", "phase", "avancement", "status", "stage",
      "deal stage", "pipeline stage", "stage name",
    ],
  },
  {
    key: "notes",
    label: "Notes",
    required: false,
    synonyms: ["notes", "note", "commentaire", "commentaires", "remarques", "description", "details", "comments"],
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Association champ LeadPilot → colonne du fichier (null = ignoré). */
export type ColumnMapping = Record<ImportFieldKey, string | null>;

export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((field) => field.required).map((field) => field.key);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const BATCH_SIZE = 250;
/** Longueur maximale conservée par valeur dans `donnees_brutes`. */
export const MAX_RAW_VALUE_LENGTH = 500;
