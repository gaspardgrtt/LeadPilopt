"use client";

import { motion } from "framer-motion";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatEuro, formatInteger } from "@/lib/format";

// Barres horizontales, une seule série (CA récupérable par ancienneté) : une teinte, pas de
// légende (le titre de la carte nomme la série), barres de 20 px à extrémité arrondie et base
// carrée, valeur au bout de la barre en encre de texte, infobulle au survol, table accessible.
type Bucket = { label: string; total: number; count: number };

export function SilenceChart({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.total), 1);

  return (
    <figure className="relative">
      <div className="flex flex-col gap-3" aria-hidden>
        {buckets.map((bucket, index) => {
          const width =
            bucket.total > 0 ? Math.max((bucket.total / max) * 100, 1.5) : 0;
          return (
            <Tooltip key={bucket.label}>
              <TooltipTrigger asChild>
                <div className="group grid cursor-default grid-cols-[96px_1fr] items-center gap-3 rounded-md py-0.5 sm:grid-cols-[112px_1fr]">
                  <span className="text-dense text-foreground-secondary transition-colors group-hover:text-foreground">
                    {bucket.label}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="relative h-5 min-w-0 flex-1">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-r-[4px] bg-gradient-to-r from-primary/80 to-primary transition-[filter] group-hover:brightness-110"
                        initial={{ width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{
                          duration: 0.7,
                          delay: 0.1 + index * 0.06,
                          ease: [0.2, 0, 0, 1],
                        }}
                      />
                    </span>
                    <span className="w-24 shrink-0 text-right text-dense font-semibold text-foreground tabular-nums">
                      {formatEuro(bucket.total)}
                    </span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {bucket.label} sans contact · {formatInteger(bucket.count)}{" "}
                prospect{bucket.count > 1 ? "s" : ""} ·{" "}
                {formatEuro(bucket.total)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {/* sr-only sur un conteneur : une table ignore la largeur de 1 px et déborderait. */}
      <div className="sr-only">
        <table>
          <caption>
            Argent récupérable par ancienneté du dernier contact
          </caption>
          <thead>
            <tr>
              <th scope="col">Ancienneté</th>
              <th scope="col">Prospects</th>
              <th scope="col">Argent récupérable</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.label}>
                <th scope="row">{bucket.label}</th>
                <td>{bucket.count}</td>
                <td>{formatEuro(bucket.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
