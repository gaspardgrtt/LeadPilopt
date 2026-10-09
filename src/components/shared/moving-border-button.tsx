"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Bouton « IA » à bordure lumineuse animée (moving border) : un dégradé conique indigo → violet →
// bleu tourne derrière un liseré de 2 px, le cœur reste plein et lisible. Une lueur diffuse
// suit le survol. L'animation s'arrête si l'utilisateur a demandé de réduire les animations.
type MovingBorderButtonProps = React.ComponentProps<"button"> & {
  size?: "md" | "lg";
};

export function MovingBorderButton({ className, children, size = "md", disabled, ...props }: MovingBorderButtonProps) {
  return (
    <button
      data-slot="moving-border-button"
      disabled={disabled}
      className={cn(
        "group relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] p-[2px] font-medium whitespace-nowrap text-primary-foreground outline-none transition-[transform,box-shadow] duration-200 select-none",
        "shadow-ai hover:shadow-ai-hover active:translate-y-px",
        "focus-visible:ring-[3px] focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50",
        size === "lg" ? "h-11 text-body" : "h-10 text-body",
        className
      )}
      {...props}
    >
      {/* Dégradé conique en rotation : seul le liseré de 2 px en reste visible. */}
      <span
        aria-hidden
        className="absolute inset-[-200%] -z-20 animate-moving-border motion-reduce:animate-none"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, var(--accent-blue) 50deg, #ffffff 90deg, var(--accent-violet) 130deg, var(--primary-light) 180deg, transparent 230deg, transparent 360deg)",
        }}
      />
      <span aria-hidden className="absolute inset-0 -z-30 bg-primary/70" />
      <span
        className={cn(
          "relative inline-flex h-full w-full items-center justify-center gap-2 rounded-[8px] bg-primary px-4 [&_svg]:size-4 [&_svg]:shrink-0",
          "bg-[image:linear-gradient(135deg,rgb(255_255_255/0.18),rgb(255_255_255/0)_45%),linear-gradient(90deg,var(--primary),var(--accent-violet))]",
          "transition-[filter] duration-200 group-hover:brightness-110"
        )}
      >
        {children}
      </span>
    </button>
  );
}
