import { formatEuro, formatInteger } from "@/lib/format";
import type { DealStage } from "@/lib/prospects";

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

const STAGE_PHRASE: Record<DealStage, string> = {
  decouverte: "premier échange à poursuivre",
  qualification: "affaire en qualification",
  proposition: "proposition envoyée",
  negociation: "affaire en négociation",
  gagne: "affaire gagnée",
  perdu: "affaire perdue",
};

export function buildMorningBrief(input: BriefInput): MorningBrief {
  const commission =
    input.commissionRate !== null && input.commissionRate > 0
      ? Math.round((input.recoverable * input.commissionRate) / 100)
      : null;
  const toFollowUpLabel = `${input.toFollowUp > 1 ? "opportunités" : "opportunité"} à relancer`;
  const progress =
    input.progress.total > 0
      ? {
          ...input.progress,
          label:
            input.progress.done >= input.progress.total
              ? "Toutes les relances du jour sont préparées"
              : `${formatInteger(input.progress.done)} / ${formatInteger(input.progress.total)} relance${input.progress.total > 1 ? "s" : ""} préparée${input.progress.done > 1 ? "s" : ""} aujourd'hui`,
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
    priority.etape ? STAGE_PHRASE[priority.etape] : "affaire en cours",
    priority.silenceDays !== null
      ? `sans nouvelles depuis ${priority.silenceDays} jour${priority.silenceDays > 1 ? "s" : ""}`
      : null,
    `${formatEuro(priority.recoverable)} en jeu`,
  ].filter(Boolean);

  return {
    state: "action",
    commission,
    toFollowUpLabel,
    action: {
      sentence: `Relancez ${priority.entreprise} aujourd'hui : ${reasons.join(", ")}.`,
      cta: `Préparer la relance de ${priority.entreprise}`,
      href: `/prospects/${priority.id}`,
    },
    progress,
  };
}
