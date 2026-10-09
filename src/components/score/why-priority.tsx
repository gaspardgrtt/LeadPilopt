"use client";

import { cn } from "@/lib/utils";
import type { ScoreFactor } from "@/lib/scoring/score";
import { useT } from "@/i18n/client";

// « Pourquoi prioritaire ? » : les facteurs du score avec leurs points (libellés toujours alignés
// sur le signe) et une mini-barre proportionnelle. Partagé par le brief du matin et « Mes priorités ».

const signed = (points: number) => (points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : "0");

export function WhyPriority({ factors, className }: { factors: ScoreFactor[]; className?: string }) {
  const t = useT();
  const maxAbs = Math.max(...factors.map((factor) => Math.abs(factor.points)), 1);
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {factors.map((factor) => (
        <li key={factor.key} className="grid grid-cols-[40px_1fr_48px] items-center gap-2">
          <span
            className={cn(
              "text-right text-dense font-bold tabular-nums",
              factor.points > 0 ? "text-success" : factor.points < 0 ? "text-danger" : "text-foreground-tertiary"
            )}
          >
            {signed(factor.points)}
            <span className="sr-only">{t.workspace.pointsSr}</span>
          </span>
          <span className="truncate text-dense text-foreground-secondary">{factor.shortLabel}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-subtle" aria-hidden>
            <span
              className={cn("block h-full rounded-full", factor.points >= 0 ? "bg-success" : "bg-danger")}
              style={{ width: `${(Math.abs(factor.points) / maxAbs) * 100}%` }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
