import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// État vide, dans le style de la zone d'import de la maquette : pastille ronde indigo pâle,
// titre 16/600, une phrase, un bouton principal.
type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border bg-surface px-6 py-16 text-center shadow-card",
        className
      )}
    >
      <div className="mb-5 flex size-14 items-center justify-center rounded-full bg-primary-soft">
        <Icon className="size-6 text-primary" strokeWidth={2} aria-hidden />
      </div>
      <h2 className="text-[16px] leading-6 font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 max-w-sm text-body text-foreground-secondary">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
