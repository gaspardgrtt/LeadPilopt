import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Les tailles de texte du design system (globals.css) doivent être déclarées ici :
// sinon tailwind-merge les prend pour des couleurs et les supprime face à `text-foreground`.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "kpi", "title", "section", "body", "dense", "caption", "overline"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
