import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { STATUS_LABELS, type ProspectStatus } from "@/lib/prospects";

// Badges pastel : fond doux, texte saturé, point de couleur et liseré intérieur discret, rayon 6.
const STATUS_STYLES: Record<ProspectStatus, { badge: string; dot: string }> = {
  a_traiter: { badge: "bg-warning-soft text-warning ring-warning/20", dot: "bg-warning" },
  relance: { badge: "bg-primary-soft text-primary-hover ring-primary/20", dot: "bg-primary" },
  gagne: { badge: "bg-success-soft text-success ring-success/20", dot: "bg-success" },
  perdu: { badge: "bg-danger-soft text-danger ring-danger/20", dot: "bg-danger" },
  ignore: { badge: "bg-surface-subtle text-foreground-tertiary ring-border-strong", dot: "bg-foreground-tertiary/60" },
};

type StatusBadgeProps = {
  status: ProspectStatus;
  /** Affiche un chevron : le badge ouvre un menu de statut (E4, E5). */
  interactive?: boolean;
  className?: string;
};

export function StatusBadge({ status, interactive = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-caption whitespace-nowrap ring-1 ring-inset transition-colors duration-200",
        STATUS_STYLES[status].badge,
        className
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_STYLES[status].dot)} aria-hidden />
      {STATUS_LABELS[status]}
      {interactive && <ChevronDownIcon className="-mr-0.5 size-3 opacity-70" aria-hidden />}
    </span>
  );
}
