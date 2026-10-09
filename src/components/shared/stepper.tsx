import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Spéc. UX/UI E2 repère 1 — étape faite : cercle accent-doux, cliquable ;
// en cours : contour accent ; à venir : gris, non cliquable.
type StepperProps = {
  steps: string[];
  /** Index de l'étape en cours (0 = première). */
  current: number;
  onStepClick?: (index: number) => void;
  className?: string;
};

export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center gap-2 sm:gap-3", className)} aria-label="Étapes de l'import">
      {steps.map((label, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        const clickable = state === "done" && onStepClick;

        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            {index > 0 && <span className="h-px w-4 bg-border-strong sm:w-8" aria-hidden />}
            <button
              type="button"
              disabled={!clickable}
              onClick={clickable ? () => onStepClick(index) : undefined}
              aria-current={state === "current" ? "step" : undefined}
              className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:cursor-pointer"
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border text-caption tabular-nums transition-colors duration-120",
                  state === "done" && "border-transparent bg-primary-soft text-primary group-hover:bg-primary/15",
                  state === "current" && "border-2 border-primary text-primary",
                  state === "todo" && "border-border-strong text-foreground-tertiary"
                )}
              >
                {state === "done" ? <CheckIcon className="size-3.5" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-body",
                  // Sur mobile, seul le libellé de l'étape en cours reste visible.
                  state !== "current" && "sr-only sm:not-sr-only",
                  state === "current" ? "font-medium text-foreground" : "text-foreground-secondary",
                  state === "todo" && "text-foreground-tertiary"
                )}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
