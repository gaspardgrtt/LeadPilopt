"use client";

import { cn } from "@/lib/utils";
import { LONG_SILENCE_DAYS } from "@/lib/prospects";
import { useT } from "@/i18n/client";

type SilenceDaysProps = {
  days: number;
  /** « Il y a 26 jours » (fiche) plutôt que « 26 jours » (tableau). */
  relative?: boolean;
  className?: string;
};

/** Jours sans contact, en badge rouge pâle comme dans la maquette ; texte plus appuyé au-delà de 60 jours. */
export function SilenceDays({ days, relative = false, className }: SilenceDaysProps) {
  const t = useT();
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-sm bg-danger-soft px-2 text-caption text-danger tabular-nums whitespace-nowrap ring-1 ring-inset ring-danger/15",
        days > LONG_SILENCE_DAYS && "font-semibold",
        className
      )}
    >
      {relative ? t.common.daysAgo(days) : t.common.days(days)}
    </span>
  );
}
