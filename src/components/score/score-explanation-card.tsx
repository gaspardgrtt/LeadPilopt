"use client";

import { motion } from "framer-motion";
import { BanknoteIcon, ClockIcon, FlagIcon, InfoIcon, LightbulbIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ScoreRing } from "@/components/dashboard/score-ring";
import { useFormat, useT } from "@/i18n/client";
import type { ScoreExplanation, ScoreFactor } from "@/lib/scoring/score";

import { ScoreWaterfall } from "./score-waterfall";

// « Pourquoi ce score ? » sur la fiche prospect : verdict en une phrase, les facteurs classés par
// influence (points ajoutés ou retirés) et la cascade qui montre comment ils mènent au score.

const FACTOR_ICONS: Record<ScoreFactor["key"], LucideIcon> = {
  montant: BanknoteIcon,
  etape: FlagIcon,
  silence: ClockIcon,
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function PointsChip({ points, className }: { points: number; className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-12 items-center justify-center rounded-full px-2 text-caption font-semibold tabular-nums ring-1 ring-inset",
        points > 0 && "bg-success-soft text-success ring-success/20",
        points < 0 && "bg-danger-soft text-danger ring-danger/20",
        points === 0 && "bg-surface-subtle text-foreground-tertiary ring-border",
        className
      )}
    >
      {t.sheet.points(points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0")}
    </span>
  );
}

export function ScoreExplanationCard({ explanation }: { explanation: ScoreExplanation }) {
  const t = useT();
  const format = useFormat();
  if (explanation.kind === "unscored") {
    return (
      <section aria-labelledby="pourquoi-score" className="rounded-xl border bg-surface-tinted p-6">
        <h2 id="pourquoi-score" className="flex items-center gap-2 text-[15px] leading-6 font-semibold text-foreground">
          <InfoIcon className="size-4 text-foreground-tertiary" aria-hidden />
          {t.sheet.whyNoScore}
        </h2>
        <p className="mt-1.5 text-body text-foreground-secondary">{explanation.reason}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="pourquoi-score" className="relative isolate overflow-hidden rounded-xl border bg-surface p-6 shadow-card">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 -z-10 size-64 rounded-full bg-primary/[0.06] blur-3xl"
      />
      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="flex items-start gap-4">
            <ScoreRing score={explanation.score} />
            <div className="min-w-0">
              <h2 id="pourquoi-score" className="flex items-center gap-2 text-[17px] leading-6 font-semibold tracking-[-0.01em] text-foreground">
                <LightbulbIcon className="size-4 text-primary" aria-hidden />
                {t.sheet.whyScore}
              </h2>
              <p className="mt-1 text-body text-foreground-secondary">{explanation.summary}</p>
            </div>
          </div>

          <ol className="mt-6 flex flex-col gap-2">
            {explanation.factors.map((factor, index) => {
              const Icon = FACTOR_ICONS[factor.key];
              return (
                <motion.li
                  key={factor.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: 0.1 + index * 0.08 }}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface-subtle/50 px-3.5 py-3"
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      factor.points > 0 && "bg-success-soft text-success ring-success/15",
                      factor.points < 0 && "bg-danger-soft text-danger ring-danger/15",
                      factor.points === 0 && "bg-surface text-foreground-tertiary ring-border"
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-foreground">{factor.label}</span>
                    <span className="block text-dense text-foreground-secondary">{factor.detail}</span>
                  </span>
                  <PointsChip points={factor.points} />
                </motion.li>
              );
            })}
          </ol>
        </div>

        <div className="flex flex-col">
          <p className="text-overline text-foreground-tertiary">{t.sheet.pointsBreakdown}</p>
          <div className="mt-4 flex-1">
            <ScoreWaterfall base={explanation.base} factors={explanation.factors} score={explanation.score} />
          </div>
          <p className="mt-5 rounded-lg bg-surface-tinted px-3.5 py-3 text-dense text-foreground-secondary">
            {t.sheet.startingPoint(explanation.base)}{" "}
            {explanation.isBest || !explanation.best
              ? t.sheet.isBest
              : t.sheet.bestReference(explanation.best.entreprise, format.euro(explanation.best.recoverable))}
          </p>
        </div>
      </div>
    </section>
  );
}
