import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Boutons de la maquette : principal indigo plein, secondaire blanc bordé,
// doux (fond indigo pâle), fantôme, danger, lien. Rayon 8.
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap select-none transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-standard outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:pointer-events-none disabled:opacity-45 aria-busy:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "bg-primary-solid bg-[image:linear-gradient(180deg,rgb(255_255_255/0.16),rgb(255_255_255/0)_60%)] text-primary-foreground shadow-primary hover:bg-primary-solid-hover hover:shadow-glow active:translate-y-px",
        secondary:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:border-foreground-tertiary/40 hover:bg-surface-subtle hover:shadow-card active:translate-y-px",
        soft: "bg-primary-soft text-primary-hover hover:bg-primary-muted/70",
        ghost:
          "text-foreground-secondary hover:bg-surface-subtle hover:text-foreground",
        danger: "bg-danger-solid text-white shadow-xs hover:bg-danger-solid/90",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        lg: "h-11 px-5 text-body",
        md: "h-9 px-4 text-body has-[>svg:first-child]:pl-3.5",
        sm: "h-8 gap-1.5 px-3 text-dense has-[>svg:first-child]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-9",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Affiche un spinner à la place de l'icône, largeur figée. */
    loading?: boolean
    /** Raccourci clavier affiché à droite du libellé (ex. « C »). */
    shortcut?: string
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  shortcut,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const filled = variant === "primary" || variant === undefined || variant === "danger"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2Icon className="animate-spin" aria-hidden />}
          {children}
          {shortcut && (
            <kbd
              className={cn(
                "ml-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm px-1 font-sans text-caption",
                filled ? "bg-white/20 text-current" : "bg-surface-subtle text-foreground-tertiary"
              )}
            >
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
