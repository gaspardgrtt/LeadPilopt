import type { DealStage, FollowupTone } from "@/lib/prospects";
import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";

// Relances par modèles, sans IA : la situation du dossier est déduite des données déjà présentes
// (étape, date du dernier contact), puis un modèle rédigé à l'avance est complété avec les
// informations réelles (prénom, entreprise, date du dernier échange, proposition). Rien n'est
// inventé : une information absente fait simplement disparaître la phrase qui l'utilise.
// Les notes importées ne sont jamais recopiées dans le message (ce sont des notes internes).
// Le texte des relances reste en français quelle que soit la langue de l'interface : il est
// destiné aux prospects. Seules les explications affichées (raisons, libellés) sont traduites.

export const FOLLOWUP_SCENARIOS = [
  "suivi_echange",
  "suivi_proposition",
  "decision",
  "reprise_contact",
  "dernier_message",
] as const;

export type FollowupScenario = (typeof FOLLOWUP_SCENARIOS)[number];

/** Au-delà de ces silences, le scénario de reprise prend le pas sur l'étape. */
export const REPRISE_DAYS = 60;
export const DERNIER_MESSAGE_DAYS = 120;

export type FollowupProspect = {
  entreprise: string;
  contact_nom: string | null;
  etape: DealStage | null;
  date_dernier_contact: string | null;
};

export type FollowupSender = { signature: string | null; nom: string | null };

export type FollowupContext = {
  scenario: FollowupScenario;
  /** Éléments du dossier qui expliquent le choix, affichés tels quels. */
  reasons: string[];
  /** Données disponibles pour personnaliser le message. */
  firstName: string | null;
  silenceDays: number | null;
};

const MS_PER_DAY = 86_400_000;

function silenceFrom(date: string, today: Date): number {
  const contact = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.round((now - contact) / MS_PER_DAY));
}

/** Prénom du contact : premier mot du nom importé, s'il ressemble à un prénom. */
export function contactFirstName(contactNom: string | null): string | null {
  const first = contactNom?.trim().split(/\s+/)[0];
  if (!first || first.length < 2 || /[@\d]/.test(first)) return null;
  // « M. », « Mme » : pas de prénom exploitable.
  if (/^(m\.?|mme\.?|mlle\.?|mr\.?|mrs\.?|dr\.?)$/i.test(first)) return null;
  return first[0].toLocaleUpperCase("fr-FR") + first.slice(1);
}

export function detectFollowupContext(prospect: FollowupProspect, today: Date = new Date(), locale: Langue = "fr"): FollowupContext {
  const t = getMessages(locale);
  const silenceDays = prospect.date_dernier_contact ? silenceFrom(prospect.date_dernier_contact, today) : null;
  const reasons: string[] = [];
  reasons.push(prospect.etape ? t.followup.reasonStage(t.enums.stage[prospect.etape]) : t.followup.reasonNoStage);
  if (silenceDays !== null) reasons.push(t.followup.reasonSilence(silenceDays));

  let scenario: FollowupScenario;
  if (silenceDays !== null && silenceDays >= DERNIER_MESSAGE_DAYS) scenario = "dernier_message";
  else if (silenceDays !== null && silenceDays >= REPRISE_DAYS) scenario = "reprise_contact";
  else if (prospect.etape === "negociation") scenario = "decision";
  else if (prospect.etape === "proposition") scenario = "suivi_proposition";
  else scenario = "suivi_echange";

  return { scenario, reasons, firstName: contactFirstName(prospect.contact_nom), silenceDays };
}

const longDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
const longDateWithYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** « 12 septembre », « 1er avril » (même année) ou « 12 septembre 2025 ». */
export function exchangeDate(date: string, today: Date): string {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const text = (value.getUTCFullYear() === today.getUTCFullYear() ? longDate : longDateWithYear).format(value);
  // Typographie française : « 1er avril ».
  return text.replace(/^1 /, "1er ");
}

type Vars = {
  entreprise: string;
  firstName: string | null;
  /** « du 12 septembre », ou "" si la date est inconnue. */
  du: string;
  /** « le 12 septembre », ou "" si la date est inconnue. */
  le: string;
  /** « 12 septembre », ou "" si la date est inconnue. */
  date: string;
  /** Sujet de l'échange, selon l'étape : « votre projet » / « notre proposition ». */
  sujet: string;
  hasProposal: boolean;
};

type Template = { subject: (v: Vars) => string; paragraphs: (v: Vars) => string[] };

const GREETING = (v: Vars) => (v.firstName ? `Bonjour ${v.firstName},` : "Bonjour,");

const CLOSING: Record<FollowupTone, string> = {
  formel: "Bien cordialement,",
  direct: "Bonne journée,",
  chaleureux: "Belle journée à vous,",
};

const TEMPLATES: Record<FollowupScenario, Record<FollowupTone, Template>> = {
  suivi_echange: {
    formel: {
      subject: (v) => `Suite à notre échange · ${v.entreprise}`,
      paragraphs: (v) => [
        `Je me permets de revenir vers vous à la suite de notre échange${v.du ? ` ${v.du}` : ""} concernant ${v.entreprise}.`,
        "Avez-vous pu avancer dans votre réflexion ? Je reste à votre disposition pour répondre à vos questions ou préciser les éléments qui vous seraient utiles.",
        "Souhaitez-vous que nous convenions d'un court échange pour faire le point ?",
      ],
    },
    direct: {
      subject: (v) => `${v.entreprise} : on fait le point ?`,
      paragraphs: (v) => [
        `Je reviens vers vous après notre échange${v.du ? ` ${v.du}` : ""}.`,
        "Où en est votre réflexion ? Un appel de 15 minutes vous conviendrait-il pour faire le point ?",
      ],
    },
    chaleureux: {
      subject: (v) => `Des nouvelles de votre projet · ${v.entreprise}`,
      paragraphs: (v) => [
        "J'espère que tout se passe bien de votre côté.",
        `Je repensais à notre échange${v.du ? ` ${v.du}` : ""} et je voulais prendre de vos nouvelles. Où en est votre projet ?`,
        "Si cela vous dit, je vous propose un petit échange pour en parler, au moment qui vous arrange. Qu'en pensez-vous ?",
      ],
    },
  },
  suivi_proposition: {
    formel: {
      subject: (v) => `Notre proposition · ${v.entreprise}`,
      paragraphs: (v) => [
        `Je me permets de revenir vers vous au sujet de la proposition que nous vous avons transmise${v.le ? `, à la suite de notre échange ${v.du}` : ""}.`,
        "Avez-vous eu l'occasion d'en prendre connaissance ? Je reste à votre disposition pour en préciser certains points ou l'ajuster à vos besoins.",
        "Souhaitez-vous que nous en discutions lors d'un court échange ?",
      ],
    },
    direct: {
      subject: (v) => `Votre avis sur notre proposition · ${v.entreprise}`,
      paragraphs: (v) => [
        `Avez-vous pu regarder la proposition que nous vous avons transmise${v.du ? ` (notre dernier échange date ${v.du})` : ""} ?`,
        "Si un point est à ajuster, dites-le-moi : je vous fais un retour rapidement. Un appel de 15 minutes vous aiderait-il à trancher ?",
      ],
    },
    chaleureux: {
      subject: (v) => `Notre proposition, qu'en pensez-vous ? · ${v.entreprise}`,
      paragraphs: (v) => [
        "J'espère que vous allez bien.",
        `Je voulais savoir ce que vous pensiez de la proposition que nous vous avons transmise${v.du ? ` suite à notre échange ${v.du}` : ""}. Correspond-elle à ce que vous aviez en tête ?`,
        "J'en parlerai volontiers avec vous si quelques points méritent d'être revus. Avez-vous un moment pour en discuter ?",
      ],
    },
  },
  decision: {
    formel: {
      subject: (v) => `Prochaines étapes · ${v.entreprise}`,
      paragraphs: (v) => [
        `Je reviens vers vous afin de faire le point sur notre discussion${v.du ? ` ${v.du}` : ""}.`,
        "Reste-t-il des questions ou des éléments à préciser de votre côté avant de prendre votre décision ? Je me tiens à votre disposition pour les traiter rapidement.",
        "Pouvons-nous convenir d'un court échange pour avancer ensemble ?",
      ],
    },
    direct: {
      subject: (v) => `${v.entreprise} : où en est votre décision ?`,
      paragraphs: (v) => [
        `Je reviens vers vous pour avancer sur notre discussion${v.du ? ` ${v.du}` : ""}.`,
        "Reste-t-il un point qui vous retient ? Dites-moi lequel et nous verrons ensemble comment y répondre. Pouvons-nous en parler cette semaine ?",
      ],
    },
    chaleureux: {
      subject: (v) => `On avance ensemble ? · ${v.entreprise}`,
      paragraphs: (v) => [
        "J'espère que tout va bien pour vous.",
        `Je voulais faire le point avec vous après notre discussion${v.du ? ` ${v.du}` : ""}. Y a-t-il encore des questions ou des points sur lesquels je peux vous aider ?`,
        "Je reste disponible pour en parler quand vous le souhaitez. Un petit échange vous conviendrait-il ?",
      ],
    },
  },
  reprise_contact: {
    formel: {
      subject: (v) => `Reprise de contact · ${v.entreprise}`,
      paragraphs: (v) => [
        `Nous avions échangé${v.le ? ` ${v.le}` : ""} au sujet de ${v.sujet}, et je souhaitais reprendre contact avec vous.`,
        "Votre besoin est-il toujours d'actualité ? Le cas échéant, je me tiens à votre disposition pour en reparler.",
      ],
    },
    direct: {
      subject: (v) => `Toujours d'actualité ? · ${v.entreprise}`,
      paragraphs: (v) => [
        `Nous avions échangé${v.le ? ` ${v.le}` : ""} au sujet de ${v.sujet}.`,
        "Est-ce toujours d'actualité de votre côté ? Si oui, je vous propose un appel rapide pour repartir sur de bonnes bases.",
      ],
    },
    chaleureux: {
      subject: (v) => `Des nouvelles ? · ${v.entreprise}`,
      paragraphs: (v) => [
        "J'espère que vous allez bien.",
        `Cela fait un moment que nous n'avons pas échangé${v.le ? ` : la dernière fois, c'était ${v.le}` : ""}, au sujet de ${v.sujet}. Je voulais prendre de vos nouvelles.`,
        "Ce projet est-il toujours d'actualité ? Si c'est le cas, j'en reparlerai volontiers avec vous.",
      ],
    },
  },
  dernier_message: {
    formel: {
      subject: (v) => `Votre projet est-il toujours d'actualité ? · ${v.entreprise}`,
      paragraphs: (v) => [
        `Nous avions échangé${v.le ? ` ${v.le}` : ""} au sujet de ${v.sujet}. Je ne souhaite pas vous solliciter inutilement.`,
        "Ce sujet est-il toujours d'actualité, ou préférez-vous que je revienne vers vous à un autre moment ? Une réponse brève me suffira.",
      ],
    },
    direct: {
      subject: (v) => `Je clos le dossier ? · ${v.entreprise}`,
      paragraphs: (v) => [
        `Notre dernier échange au sujet de ${v.sujet} remonte ${v.date ? `au ${v.date}` : "à plusieurs mois"}.`,
        "Pour ne pas vous relancer inutilement : est-ce toujours d'actualité, ou dois-je clore le dossier ? Un simple oui ou non me suffit.",
      ],
    },
    chaleureux: {
      subject: (v) => `Un dernier petit mot · ${v.entreprise}`,
      paragraphs: (v) => [
        "J'espère que tout va bien de votre côté.",
        `Nous avions parlé de ${v.sujet}${v.le ? ` ${v.le}` : ""}, et je ne voudrais pas vous déranger si les priorités ont changé.`,
        "Est-ce toujours d'actualité ? Si ce n'est plus le cas, aucun souci : une réponse rapide m'aidera à m'organiser.",
      ],
    },
  },
};

/** Objet et corps prêts à l'envoi (signature du compte ajoutée telle quelle, jamais réécrite). */
export function renderFollowup(
  prospect: FollowupProspect,
  scenario: FollowupScenario,
  tone: FollowupTone,
  sender: FollowupSender | null,
  today: Date = new Date()
): { objet: string; corps: string } {
  const date = prospect.date_dernier_contact ? exchangeDate(prospect.date_dernier_contact, today) : null;
  const hasProposal = prospect.etape === "proposition" || prospect.etape === "negociation";
  const vars: Vars = {
    entreprise: prospect.entreprise.trim(),
    firstName: contactFirstName(prospect.contact_nom),
    du: date ? `du ${date}` : "",
    le: date ? `le ${date}` : "",
    date: date ?? "",
    sujet: hasProposal ? "notre proposition" : "votre projet",
    hasProposal,
  };
  const template = TEMPLATES[scenario][tone];
  const signature = sender?.signature?.trim() || sender?.nom?.trim() || "";
  const corps = [GREETING(vars), ...template.paragraphs(vars), [CLOSING[tone], signature].filter(Boolean).join("\n")].join("\n\n");
  return { objet: template.subject(vars).slice(0, 300), corps: corps.slice(0, 10000) };
}

/** Modèle enregistré dans `relances.modele_ia` (« modele:suivi_proposition »). */
export const scenarioTag = (scenario: FollowupScenario) => `modele:${scenario}`;

export function scenarioFromTag(tag: string | null | undefined): FollowupScenario | null {
  const value = tag?.startsWith("modele:") ? tag.slice("modele:".length) : null;
  return value && (FOLLOWUP_SCENARIOS as readonly string[]).includes(value) ? (value as FollowupScenario) : null;
}

export function isFollowupScenario(value: unknown): value is FollowupScenario {
  return typeof value === "string" && (FOLLOWUP_SCENARIOS as readonly string[]).includes(value);
}
