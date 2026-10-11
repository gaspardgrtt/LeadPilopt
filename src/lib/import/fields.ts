// Champs reconnus à l'import (E2, étape 2) et noms de colonnes associés automatiquement.
// Les synonymes sont comparés après normalisation (minuscules, sans accents ni ponctuation :
// « Date_Dernier-Contact » → « date dernier contact »), et aussi sans espaces (« lastContactDate »).
//
// `synonyms` : en-têtes sans ambiguïté, associés automatiquement.
// `weak` : en-têtes plausibles mais ambigus (« nom » peut être un nom de famille, un nom complet ou
// une raison sociale) : ils ne sont proposés qu'en suggestion, à confirmer par l'utilisateur.
//
// Un prospect est identifié par son entreprise OU par le nom de son contact (particuliers :
// acheteurs, vendeurs, propriétaires, investisseurs). Aucune entreprise n'est exigée ni inventée.

export const IMPORT_FIELDS = [
  {
    key: "entreprise",
    required: false,
    synonyms: [
      "entreprise", "societe", "nom entreprise", "nom de l entreprise", "nom societe", "nom de la societe",
      "raison sociale", "compagnie", "company", "company name", "organisation", "organization",
      "organization name", "account", "account name", "associated company", "employeur", "employer",
    ],
    weak: ["structure", "agence"],
  },
  {
    key: "contact",
    required: false,
    synonyms: [
      "contact", "nom complet", "nom contact", "nom du contact", "nom et prenom", "prenom nom", "nom prenom",
      "prenom et nom", "interlocuteur", "contact name", "contact person", "full name", "contact full name",
    ],
    weak: ["nom", "name", "personne", "person", "client", "prospect", "acquereur", "proprietaire"],
  },
  {
    key: "prenom",
    required: false,
    synonyms: ["prenom", "prenom du contact", "prenom contact", "first name", "firstname", "given name", "contact first name"],
    weak: [],
  },
  {
    key: "nom",
    required: false,
    synonyms: ["nom de famille", "last name", "lastname", "surname", "family name", "contact last name"],
    // « nom » / « name » ne désignent le nom de famille que si une colonne prénom existe (règle dans rows.ts).
    weak: [],
  },
  {
    key: "email",
    required: false,
    synonyms: [
      "email", "e mail", "mail", "courriel", "adresse email", "adresse e mail", "adresse mail", "email address",
      "e mail address", "contact email", "email du contact",
    ],
    weak: [],
  },
  {
    key: "telephone",
    required: false,
    synonyms: [
      "telephone", "tel", "numero de telephone", "num tel", "numero tel", "telephone mobile", "telephone portable",
      "portable", "mobile", "gsm", "phone", "phone number", "mobile phone", "mobile phone number", "cell", "cellphone",
    ],
    weak: [],
  },
  {
    key: "montant",
    required: false,
    synonyms: [
      "montant", "montant eur", "montant ht", "montant de l affaire", "valeur", "valeur du bien", "budget",
      "budget max", "budget maximum", "prix", "prix de vente", "chiffre d affaires", "ca", "amount", "deal amount",
      "deal value", "value", "opportunity amount", "price",
    ],
    weak: ["estimation", "prix estime", "commission", "honoraires"],
  },
  {
    key: "dernier_contact",
    required: true,
    synonyms: [
      "date dernier contact", "dernier contact", "date du dernier contact", "date de dernier contact",
      "dernier echange", "date dernier echange", "date du dernier echange", "derniere activite",
      "date derniere activite", "date de la derniere activite", "derniere interaction", "last contact",
      "last contact date", "last contacted", "last contacted date", "last activity", "last activity date",
      "date of last activity",
    ],
    weak: ["date", "derniere relance", "date relance", "date de contact", "date contact", "contacte le"],
  },
  {
    key: "statut",
    required: false,
    synonyms: [
      "statut", "statut de l affaire", "etape", "etape de l affaire", "phase", "avancement", "status", "stage",
      "deal stage", "pipeline stage", "stage name",
    ],
    weak: ["etat", "situation"],
  },
  {
    key: "notes",
    required: false,
    synonyms: [
      "notes", "note", "commentaire", "commentaires", "remarque", "remarques", "description", "details", "comment",
      "comments", "observations",
    ],
    weak: ["infos", "informations", "projet"],
  },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

/** Champs qui identifient un prospect : au moins un doit être associé (entreprise ou contact). */
export const IDENTITY_FIELDS = ["entreprise", "contact", "prenom", "nom"] as const satisfies readonly ImportFieldKey[];

/** Association champ Izmo → colonne du fichier (null = ignoré). */
export type ColumnMapping = Record<ImportFieldKey, string | null>;

/** Exigence non remplie : un champ obligatoire, ou « identite » (ni entreprise ni nom du contact). */
export type MissingRequirement = ImportFieldKey | "identite";

export const REQUIRED_FIELDS = IMPORT_FIELDS.filter((field) => field.required).map((field) => field.key);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const BATCH_SIZE = 250;
/** Longueur maximale conservée par valeur dans `donnees_brutes`. */
export const MAX_RAW_VALUE_LENGTH = 500;
