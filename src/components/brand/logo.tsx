import Image from "next/image";

import { cn } from "@/lib/utils";

// Logo Izmo : le fichier original public/Image/Izmo.png (1050 × 313, lettres noires et point
// indigo sur fond blanc opaque), affiché tel quel : seule sa hauteur change. `unoptimized` sert
// le PNG d'origine sans recompression (couleurs et netteté intactes ; 1050 px suffisent en 3x).
// Sur fond clair, `mix-blend-multiply` fond le blanc de l'image dans la page ; sur fond sombre
// (barre latérale, thème sombre), le logo est posé sur une plaque du même blanc que l'image.
const WIDTH = 1050;
const HEIGHT = 313;

const SIZES = {
  sm: "h-[22px]",
  md: "h-[26px]",
  lg: "h-9",
} as const;

type LogoProps = {
  size?: keyof typeof SIZES;
  /** Fond toujours sombre (barre latérale, barre mobile) : plaque blanche quel que soit le thème. */
  onDark?: boolean;
  className?: string;
};

export function Logo({ size = "md", onDark = false, className }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center",
        onDark
          ? "rounded-md bg-logo-plate px-2 py-1"
          : "mix-blend-multiply dark:rounded-md dark:bg-logo-plate dark:px-2.5 dark:py-1.5 dark:mix-blend-normal",
        className
      )}
    >
      <Image
        src="/Image/Izmo.png"
        alt="Izmo"
        width={WIDTH}
        height={HEIGHT}
        unoptimized
        priority
        className={cn(SIZES[size], "w-auto select-none")}
        draggable={false}
      />
    </span>
  );
}
