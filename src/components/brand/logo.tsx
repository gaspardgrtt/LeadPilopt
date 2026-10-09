import { cn } from "@/lib/utils";

// Logo de la maquette : maison indigo en deux tons + « LeadPilot » en gras.
type LogoProps = {
  /** Masque le nom et n'affiche que le symbole. */
  compact?: boolean;
  /** Texte blanc pour la barre latérale sombre. */
  inverted?: boolean;
  size?: "md" | "lg";
  className?: string;
};

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path d="M16 3 3 13.2V29h9.5v-8.2a3.5 3.5 0 0 1 7 0V29H29V13.2L16 3Z" fill="var(--primary)" />
      <path d="M16 3 3 13.2V29h9.5v-8.2A3.5 3.5 0 0 1 16 17.3V3Z" fill="var(--primary-light)" />
    </svg>
  );
}

export function Logo({ compact = false, inverted = false, size = "md", className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center", size === "lg" ? "gap-3" : "gap-2.5", className)}>
      <LogoMark className={size === "lg" ? "size-9" : "size-7"} />
      {!compact && (
        <span
          className={cn(
            "font-bold tracking-[-0.02em]",
            size === "lg" ? "text-[30px] leading-9" : "text-[20px] leading-7",
            inverted ? "text-white" : "text-foreground"
          )}
        >
          LeadPilot
        </span>
      )}
    </span>
  );
}
