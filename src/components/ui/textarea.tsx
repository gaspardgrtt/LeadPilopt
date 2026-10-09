import * as React from "react"

import { cn } from "@/lib/utils"
import { inputBase } from "@/components/ui/input"

// Spéc. UX/UI §3 — Zone de texte : redimensionnable verticalement, 14/22 px pour lire un email.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        inputBase,
        "flex min-h-24 resize-y px-3 py-2.5 leading-[22px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
