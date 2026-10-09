"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Case à cocher de la maquette : 16 px, rayon 4, indigo pleine quand cochée.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-foreground-tertiary/60 bg-surface transition-colors duration-150 outline-none hover:border-foreground-tertiary focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:border-primary-solid data-[state=checked]:bg-primary-solid data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center">
        {props.checked === "indeterminate" ? (
          <MinusIcon className="size-3" strokeWidth={3} />
        ) : (
          <CheckIcon className="size-3" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
