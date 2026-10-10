// Historique des activités d'un dossier (journal `relances`) et prochaines actions.
// Module pur, partagé serveur / navigateur : aucune requête ici.
//
// Règle centrale : seul un contact réellement effectué compte. Une relance, un appel, un message
// saisis par l'agent ou un e-mail dont l'envoi a été confirmé par Brevo font avancer la date de
// dernier contact. Un brouillon copié ou ouvert dans Gmail n'est jamais présenté comme envoyé.

/** Types d'activité saisis par l'agent (le type « brouillon » est réservé aux messages préparés). */
export const ACTIVITY_TYPES = ["relance", "appel", "message", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Activités qui correspondent à un contact effectué avec le prospect. */
export const CONTACT_TYPES = ["relance", "appel", "message"] as const;

export const CHANNELS = ["email", "telephone", "sms", "whatsapp", "linkedin", "en_personne", "autre"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Canaux proposés pour chaque type (le premier est présélectionné). */
export const CHANNELS_BY_TYPE: Record<ActivityType, readonly Channel[]> = {
  relance: ["email", "telephone", "sms", "whatsapp", "linkedin", "en_personne", "autre"],
  appel: ["telephone"],
  message: ["sms", "whatsapp", "linkedin", "autre"],
  note: [],
};

export const NEXT_ACTION_CHOICES = ["demain", "3j", "7j", "date", "aucune"] as const;
export type NextActionChoice = (typeof NEXT_ACTION_CHOICES)[number];

export function isActivityType(value: unknown): value is ActivityType {
  return typeof value === "string" && (ACTIVITY_TYPES as readonly string[]).includes(value);
}
export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}
export function isNextActionChoice(value: unknown): value is NextActionChoice {
  return typeof value === "string" && (NEXT_ACTION_CHOICES as readonly string[]).includes(value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date du jour à Paris (AAAA-MM-JJ). */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Date de la prochaine action pour un choix de l'interface (jours calendaires, heure de Paris).
 * « aucune » → null. Une date choisie doit être valide et ne pas être dans le passé.
 */
export function nextActionDate(choice: NextActionChoice, customDate: string | null, now: Date = new Date()): string | null | "invalide" {
  const today = parisToday(now);
  switch (choice) {
    case "demain":
      return addDays(today, 1);
    case "3j":
      return addDays(today, 3);
    case "7j":
      return addDays(today, 7);
    case "aucune":
      return null;
    case "date":
      if (!customDate || !ISO_DATE.test(customDate) || Number.isNaN(Date.parse(customDate))) return "invalide";
      return customDate < today ? "invalide" : customDate;
  }
}

/**
 * Moment de l'activité : maintenant, hier (même heure), ou une date passée (midi, heure de Paris).
 * Jamais dans le futur.
 */
export function activityTimestamp(when: "maintenant" | "hier" | string, now: Date = new Date()): string | "invalide" {
  if (when === "maintenant") return now.toISOString();
  if (when === "hier") return new Date(now.getTime() - 86_400_000).toISOString();
  if (!ISO_DATE.test(when) || Number.isNaN(Date.parse(when))) return "invalide";
  if (when > parisToday(now)) return "invalide";
  if (when === parisToday(now)) return now.toISOString();
  // Midi à Paris : la date reste la bonne quel que soit le décalage horaire (été / hiver).
  return new Date(`${when}T10:00:00Z`).toISOString();
}

// ---------------------------------------------------------------------------- frise chronologique

export type ActivityRow = {
  id: string;
  type: string;
  canal: string | null;
  resume: string | null;
  effectuee_le: string | null;
  prochaine_action_le: string | null;
  objet: string | null;
  cree_le: string;
  copiee_le: string | null;
  envoi_statut: string | null;
  envoi_demande_le: string | null;
  envoyee_le: string | null;
  envoyee_a: string | null;
  envoi_erreur: string | null;
};

export type TimelineKind =
  | "email_envoye" // envoyé par Izmo, confirmé par Brevo
  | "email_echec" // tentative d'envoi refusée : rien n'est parti
  | "brouillon_utilise" // copié ou ouvert dans Gmail : envoi non confirmé
  | ActivityType
  | "prochaine_action";

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  at: string;
  channel: Channel | null;
  summary: string | null;
  /** Destinataire (e-mail envoyé). */
  to: string | null;
  nextAction: string | null;
};

/** Construit l'historique (du plus récent au plus ancien) à partir des lignes du journal. */
export function buildTimeline(rows: ActivityRow[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const row of rows) {
    if (row.type === "brouillon") {
      if (row.envoi_statut === "envoyee" && row.envoyee_le) {
        items.push({ id: row.id, kind: "email_envoye", at: row.envoyee_le, channel: "email", summary: row.objet, to: row.envoyee_a, nextAction: null });
      } else if (row.envoi_statut === "echec") {
        items.push({ id: row.id, kind: "email_echec", at: row.envoi_demande_le ?? row.cree_le, channel: "email", summary: row.envoi_erreur, to: null, nextAction: null });
      } else if (row.copiee_le) {
        items.push({ id: row.id, kind: "brouillon_utilise", at: row.copiee_le, channel: null, summary: row.objet, to: null, nextAction: null });
      }
      // Brouillon jamais utilisé (ou envoi en cours) : pas une action, rien à afficher.
      continue;
    }
    if (!row.effectuee_le) continue;
    const kind: TimelineKind = row.type === "prochaine_action" ? "prochaine_action" : isActivityType(row.type) ? row.type : "note";
    items.push({
      id: row.id,
      kind,
      at: row.effectuee_le,
      channel: isChannel(row.canal) ? row.canal : null,
      summary: row.resume,
      to: null,
      nextAction: row.prochaine_action_le,
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** Échéance d'une prochaine action par rapport à aujourd'hui (Paris). */
export function dueState(date: string, now: Date = new Date()): "retard" | "aujourdhui" | "demain" | "a_venir" {
  const today = parisToday(now);
  if (date < today) return "retard";
  if (date === today) return "aujourdhui";
  if (date === addDays(today, 1)) return "demain";
  return "a_venir";
}
