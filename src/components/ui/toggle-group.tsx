"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Spéc. UX/UI §3 — Sélecteur segmenté (style Linear) : l'option active sur fond surface
// dans une piste surface-discrete.
function ToggleGroup({
  className,
  size = "md",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> & { size?: "md" | "sm" }) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-size={size}
      className={cn(
        "group/toggle-group inline-flex w-fit items-center gap-0.5 rounded-md bg-surface-subtle p-0.5",
        className
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[5px] px-3 font-medium whitespace-nowrap text-foreground-secondary transition-colors duration-120 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40",
        "group-data-[size=md]/toggle-group:h-8 group-data-[size=md]/toggle-group:text-body group-data-[size=sm]/toggle-group:h-6 group-data-[size=sm]/toggle-group:text-dense",
        "data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-xs",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
