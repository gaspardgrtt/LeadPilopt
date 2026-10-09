"use client";

import { motion } from "framer-motion";
import { useT } from "@/i18n/client";

import { cn } from "@/lib/utils";
import type { ScoreFactor } from "@/lib/scoring/score";

// Cascade (waterfall) : du score d'un prospect moyen au score de ce prospect, facteur par facteur.
// Barres flottantes de 18 px : départ et arrivée en teinte neutre/indigo, apports en vert,
// retraits en rouge ; valeurs en encre de texte, avec signe (+/−) pour ne pas dépendre de la couleur.

type Step = { label: string; start: number; end: number; kind: "base" | "up" | "down" | "total"; value: string };

const BAR_COLORS: Record<Step["kind"], string> = {
  base: "bg-foreground-tertiary/45",
  up: "bg-success",
  down: "bg-danger",
  total: "bg-gradient-to-r from-primary to-accent-violet",
};

const signed = (points: number) => (points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0");

export function ScoreWaterfall({ base, factors, score }: { base: number; factors: ScoreFactor[]; score: number }) {
  const t = useT();
  const steps: Step[] = [{ label: t.sheet.averageProspect, start: 0, end: base, kind: "base", value: String(base) }];
  let running = base;
  for (const factor of factors) {
    const next = running + factor.points;
    steps.push({
      label: t.sheet.factor[factor.key],
      start: running,
      end: next,
      kind: factor.points >= 0 ? "up" : "down",
      value: signed(factor.points),
    });
    running = next;
  }
  steps.push({ label: t.sheet.score, start: 0, end: score, kind: "total", value: String(score) });

  const low = Math.min(0, ...steps.map((step) => Math.min(step.start, step.end)));
  const high = Math.max(100, ...steps.map((step) => Math.max(step.start, step.end)));
  const position = (value: number) => ((value - low) / (high - low)) * 100;

  return (
    <figure>
      <div className="flex flex-col gap-2.5" aria-hidden>
        {steps.map((step, index) => {
          const from = Math.min(step.start, step.end);
          const to = Math.max(step.start, step.end);
          return (
            <div key={`${step.label}-${index}`} className="grid grid-cols-[112px_1fr_44px] items-center gap-3">
              <span
                className={cn(
                  "truncate text-dense",
                  step.kind === "total" ? "font-semibold text-foreground" : "text-foreground-secondary"
                )}
              >
                {step.label}
              </span>
              <span className="relative h-[18px]">
                {/* Repère discret de la référence 100 (meilleure opportunité). */}
                <span className="absolute inset-y-[-4px] w-px bg-border" style={{ left: `${position(100)}%` }} />
                <motion.span
                  className={cn("absolute inset-y-0 rounded-[4px]", BAR_COLORS[step.kind])}
                  style={{ left: `${position(from)}%` }}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: `${Math.max(position(to) - position(from), 0.8)}%`, opacity: 1 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 + index * 0.12 }}
                />
              </span>
              <span
                className={cn(
                  "text-right text-dense tabular-nums",
                  step.kind === "total" || step.kind === "base" ? "font-semibold text-foreground" : "font-medium text-foreground-secondary"
                )}
              >
                {step.value}
              </span>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-3 text-caption font-normal text-foreground-tertiary">
        {t.sheet.waterfallNote}
      </figcaption>
      <table className="sr-only">
        <caption>{t.sheet.waterfallCaption}</caption>
        <tbody>
          {steps.map((step, index) => (
            <tr key={`${step.label}-row-${index}`}>
              <th scope="row">{step.label}</th>
              <td>{step.value} points</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
