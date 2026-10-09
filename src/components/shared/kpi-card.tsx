import Link from "next/link";
import { ArrowUpRightIcon, InfoIcon, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Carte KPI premium : verre dépoli, tuile d'icône en dégradé avec lueur de la teinte, grand
// chiffre, libellé dessous. Au survol (cartes cliquables) : légère élévation, halo de la teinte
// et flèche de navigation. L'apparition animée est portée par le parent (<Stagger>).
export type KpiTone = "primary" | "warning" | "success" | "violet" | "danger";

const TONES: Record<KpiTone, { tile: string; value: string; halo: string }> = {
  primary: {
    tile: "from-primary-soft to-primary-muted text-primary ring-primary/15 shadow-[0_6px_20px_-6px_var(--primary)]",
    value: "text-primary",
    halo: "bg-primary",
  },
  warning: {
    tile: "from-warning-soft to-warning-soft text-warning ring-warning/15 shadow-[0_6px_20px_-8px_var(--warning)]",
    value: "text-warning",
    halo: "bg-warning",
  },
  success: {
    tile: "from-success-soft to-success-soft text-success ring-success/15 shadow-[0_6px_20px_-8px_var(--success)]",
    value: "text-success",
    halo: "bg-success",
  },
  violet: {
    tile: "from-violet-soft to-violet-soft text-violet ring-violet/15 shadow-[0_6px_20px_-8px_var(--violet)]",
    value: "text-violet",
    halo: "bg-violet",
  },
  danger: {
    tile: "from-danger-soft to-danger-soft text-danger ring-danger/15 shadow-[0_6px_20px_-8px_var(--danger)]",
    value: "text-danger",
    halo: "bg-danger",
  },
};

type KpiCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: KpiTone;
  /** Colore le chiffre avec la teinte de la tuile. */
  tintValue?: boolean;
  /** Explication du calcul, affichée dans l'infobulle. */
  explanation?: string;
  href?: string;
  className?: string;
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
  tintValue = false,
  explanation,
  href,
  className,
}: KpiCardProps) {
  const toneStyles = TONES[tone];

  return (
    <div
      className={cn(
        "glass group relative isolate overflow-hidden rounded-xl border border-white/80 p-6 ring-1 ring-border/70",
        href &&
          "transition-[transform,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-elevated focus-within:ring-[3px] focus-within:ring-primary/25",
        className
      )}
    >
      {/* Halo de la teinte, très diffus, renforcé au survol. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-16 -right-16 -z-10 size-40 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300",
          href && "group-hover:opacity-[0.16]",
          toneStyles.halo
        )}
      />

      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ring-inset transition-transform duration-300 ease-standard",
            href && "group-hover:scale-105",
            toneStyles.tile
          )}
        >
          <Icon className="size-6" strokeWidth={1.9} aria-hidden />
        </span>
        <span className="flex items-center gap-1">
          {explanation && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="relative z-10 rounded-sm p-1 text-foreground-tertiary outline-none hover:text-foreground-secondary focus-visible:ring-[3px] focus-visible:ring-primary/25"
                  aria-label={`Comment est calculé : ${label}`}
                >
                  <InfoIcon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">{explanation}</TooltipContent>
            </Tooltip>
          )}
          {href && (
            <ArrowUpRightIcon
              className="size-4 -translate-x-1 text-foreground-tertiary opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
              aria-hidden
            />
          )}
        </span>
      </div>

      <p
        className={cn(
          "mt-6 text-kpi tabular-nums",
          tintValue ? toneStyles.value : "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-body text-foreground-secondary">{label}</p>

      {href && <Link href={href} className="absolute inset-0 rounded-xl outline-none" aria-label={`${label} : ${value}`} />}
    </div>
  );
}
