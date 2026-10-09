"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScoreExplanation } from "@/lib/scoring/score";

import { ProgressRing } from "./progress-ring";

// Anneau de score du dashboard : 56 px, trait de 5 px, arc qui se dessine au chargement, chiffre
// au centre en encre de texte (la couleur porte le palier, jamais le texte).
const TIERS = [
  { min: 85, label: "excellent", arc: "stroke-score-excellent" },
  { min: 65, label: "bon", arc: "stroke-score-good" },
  { min: 40, label: "moyen", arc: "stroke-score-medium" },
  { min: 15, label: "faible", arc: "stroke-score-low" },
  { min: 0, label: "très faible", arc: "stroke-score-critical" },
] as const;

export function scoreTier(score: number) {
  return TIERS.find((tier) => score >= tier.min) ?? TIERS[TIERS.length - 1];
}

type ScoreRingProps = {
  score: number;
  /** Si fournie, le survol de l'anneau affiche « Pourquoi ce score ? » en résumé. */
  explanation?: ScoreExplanation | null;
  className?: string;
};

export function ScoreRing({ score, explanation, className }: ScoreRingProps) {
  // L'explication est recalculée à la date du jour : on affiche son score pour que l'anneau et
  // « Pourquoi ce score ? » ne divergent jamais (le score en base est recalculé chaque nuit).
  const shown = explanation?.kind === "scored" ? explanation.score : score;
  const clamped = Math.max(0, Math.min(100, Math.round(shown)));
  const tier = scoreTier(clamped);

  const ring = (
    <span
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Score ${clamped} sur 100, ${tier.label}`}
      className={cn("inline-flex shrink-0", className)}
    >
      <ProgressRing value={clamped / 100} size={56} stroke={5} trackClassName="stroke-border/80" arcClassName={tier.arc}>
        <span className="text-dense font-semibold text-foreground tabular-nums">{clamped}</span>
      </ProgressRing>
    </span>
  );

  if (!explanation || explanation.kind !== "scored") return ring;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{ring}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[300px] px-3.5 py-3">
        <p className="text-dense font-semibold text-white">Pourquoi {explanation.score} ?</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {explanation.factors.map((factor) => (
            <li key={factor.key} className="flex items-center justify-between gap-4 text-caption font-normal text-white/85">
              <span>{factor.label}</span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  factor.points > 0 ? "text-success-soft" : factor.points < 0 ? "text-danger-soft" : "text-white/60"
                )}
              >
                {factor.points > 0 ? `+${factor.points}` : factor.points < 0 ? `−${Math.abs(factor.points)}` : "0"} pts
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-white/10 pt-2 text-caption font-normal text-white/60">
          Départ : prospect moyen ({explanation.base} pts) · détail sur la fiche
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
