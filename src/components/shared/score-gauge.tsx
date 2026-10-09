import { cn } from "@/lib/utils";
import { scoreLevel, type ScoreLevel } from "@/lib/prospects";

// Jauge de score : nombre + barre de 56 × 6 px en dégradé de la teinte du palier (clair → saturé).
const LEVEL_COLORS: Record<ScoreLevel, string> = {
  fort: "from-success/55 to-success",
  moyen: "from-warning/50 to-warning",
  faible: "from-foreground-tertiary/40 to-foreground-tertiary",
};

type ScoreGaugeProps = {
  score: number;
  className?: string;
};

export function ScoreGauge({ score, className }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreLevel(clamped);

  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Score ${clamped} sur 100, ${level}`}
    >
      <span
        className={cn(
          "w-6 text-dense font-semibold tabular-nums",
          level === "faible" ? "text-foreground-secondary" : "text-foreground"
        )}
      >
        {clamped}
      </span>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-border/70 shadow-[inset_0_1px_1px_rgb(16_24_40/0.06)]">
        <span
          className={cn("block h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-standard", LEVEL_COLORS[level])}
          style={{ width: `${clamped}%` }}
        />
      </span>
    </span>
  );
}
