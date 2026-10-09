import * as React from "react"

import { cn } from "@/lib/utils"

// Champs de la maquette : 40 px, bordure gris-bleu clair, rayon 8, halo indigo au focus.
const inputBase =
  "w-full min-w-0 rounded-md border border-border-strong bg-surface text-body text-foreground transition-[color,box-shadow,border-color] duration-150 outline-none placeholder:text-foreground-tertiary hover:border-foreground-tertiary/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/15"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputBase,
        "h-10 px-3.5 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body file:font-medium",
        className
      )}
      {...props}
    />
  )
}

type InputWithSuffixProps = React.ComponentProps<"input"> & {
  /** Unité affichée dans le champ, ex. « jours » ou « € ». */
  suffix: string
}

function InputWithSuffix({ className, suffix, ...props }: InputWithSuffixProps) {
  return (
    <div className={cn("relative", className)}>
      <Input className="pr-14 tabular-nums" {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-dense text-foreground-tertiary">
        {suffix}
      </span>
    </div>
  )
}

export { Input, InputWithSuffix, inputBase }
