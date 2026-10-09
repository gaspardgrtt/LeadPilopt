"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRightIcon } from "lucide-react";

import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SilenceDays } from "@/components/shared/silence-days";
import type { ProspectRow } from "@/components/shared/prospect-table";
import { daysSince } from "@/lib/format";
import { useFormat, useT } from "@/i18n/client";

import { ScoreRing } from "./score-ring";

// Suite de la file de relance (rangs 4 à 10) : une liste aérée plutôt qu'un tableau, chaque ligne
// ouvre la fiche ; survol avec teinte et chevron qui avance.

const EASE = [0.16, 1, 0.3, 1] as const;

export function FollowUpQueue({ rows, startRank }: { rows: ProspectRow[]; startRank: number }) {
  const t = useT();
  const format = useFormat();
  return (
    <ol className="flex flex-col">
      {rows.map((row, index) => (
        <motion.li
          key={row.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, ease: EASE, delay: 0.5 + index * 0.04 }}
        >
          <Link
            href={`/prospects/${row.id}`}
            className="group flex items-center gap-3 rounded-xl px-2 py-2.5 sm:gap-4 sm:px-3 sm:py-2 outline-none transition-colors duration-200 hover:bg-primary-soft/50 focus-visible:ring-[3px] focus-visible:ring-primary/25"
          >
            <span className="hidden w-6 shrink-0 text-right sm:block text-dense font-semibold text-foreground-tertiary tabular-nums">
              {startRank + index}
            </span>
            <InitialsAvatar name={row.contact_nom || row.entreprise} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-semibold text-foreground">{row.entreprise}</span>
              <span className="block truncate text-dense text-foreground-secondary">
                {[row.contact_nom, row.etape ? t.enums.stage[row.etape] : null].filter(Boolean).join(" · ") || "—"}
              </span>
              {row.date_dernier_contact && (
                <span className="mt-1.5 block sm:hidden">
                  <SilenceDays days={daysSince(row.date_dernier_contact)} />
                </span>
              )}
            </span>
            <span className="hidden sm:block">
              {row.date_dernier_contact && <SilenceDays days={daysSince(row.date_dernier_contact)} />}
            </span>
            <span className="hidden sm:block">{row.score !== null && <ScoreRing score={row.score} explanation={row.explanation} />}</span>
            <span className="shrink-0 text-right text-body sm:w-24 font-semibold text-foreground tabular-nums">
              {row.ca_recuperable_eur === null ? "—" : format.euro(row.ca_recuperable_eur)}
            </span>
            <ChevronRightIcon
              className="size-4 shrink-0 text-foreground-tertiary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden
            />
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}
