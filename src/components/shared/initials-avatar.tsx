import { cn } from "@/lib/utils";

// Avatar à initiales de la maquette (« JM », « A ») : cercle indigo pâle, lettres indigo.
type InitialsAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZES = {
  sm: "size-8 text-dense",
  md: "size-10 text-body",
  lg: "size-14 text-[20px]",
};

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? "?"];
  return letters.join("").toUpperCase();
}

export function InitialsAvatar({ name, size = "md", className }: InitialsAvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary-muted font-semibold text-primary",
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}
