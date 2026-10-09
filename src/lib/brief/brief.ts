import { formatEuro, formatInteger } from "@/lib/format";
import type { DealStage } from "@/lib/prospects";
import type { Langue } from "@/lib/preferences/preferences";
import { getMessages } from "@/i18n";

// Brief du matin : construit à partir des données réelles du compte (aucune IA, aucun chiffre
// approximé). Il répond, dans l'ordre : combien d'argent est récupérable, combien d'opportunités
// relancer, quel dossier d'abord, quelle action aujourd'hui, où en est la journée.

export type BriefInput = {
  recoverable: number;
  /** Opportunités oubliées encore « à traiter ». */
  toFollowUp: number;
  recovered: number;
  /** Taux de commission en %, ou null s'il n'est pas renseigné. */
  commissionRate: number | null;
  priority: {
    id: string;
    entreprise: string;
    recoverable: number;
    etape: DealStage | null;
    silenceDays: number | null;
  } | null;
  /** Relances copiées ou ouvertes dans Gmail aujourd'hui, et total de la journée. */
  progress: { done: number; total: number };
};

export type MorningBrief = {
  state: "action" | "all_done" | "nothing_to_do";
  commission: number | null;
  toFollowUpLabel: string;
  action: { sentence: string; cta: string; href: string } | null;
  progress: { done: number; total: number; label: string } | null;
};

export function buildMorningBrief(input: BriefInput, locale: Langue = "fr"): MorningBrief {
  const t = getMessages(locale).brief;
  const euro = (amount: number) => formatEuro(amount, locale);
  const integer = (value: number) => formatInteger(value, locale);
  const commission =
    input.commissionRate !== null && input.commissionRate > 0
      ? Math.round((input.recoverable * input.commissionRate) / 100)
      : null;
  const toFollowUpLabel = t.toFollowUp(input.toFollowUp);
  const progress =
    input.progress.total > 0
      ? {
          ...input.progress,
          label:
            input.progress.done >= input.progress.total
              ? t.progressAllDone
              : t.progress(integer(input.progress.done), integer(input.progress.total), input.progress.total, input.progress.done),
        }
      : null;

  if (!input.priority || input.toFollowUp === 0) {
    return {
      state: input.progress.done > 0 ? "all_done" : "nothing_to_do",
      commission,
      toFollowUpLabel,
      action: null,
      progress,
    };
  }

  const { priority } = input;
  const reasons = [
    priority.etape ? t.stagePhrase[priority.etape] : t.dealInProgress,
    priority.silenceDays !== null ? t.silentFor(priority.silenceDays) : null,
    t.atStake(euro(priority.recoverable)),
  ].filter(Boolean);

  return {
    state: "action",
    commission,
    toFollowUpLabel,
    action: {
      sentence: t.sentence(priority.entreprise, reasons.join(", ")),
      cta: t.cta(priority.entreprise),
      href: `/prospects/${priority.id}`,
    },
    progress,
  };
}
