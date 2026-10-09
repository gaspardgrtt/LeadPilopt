"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SilenceDays } from "@/components/shared/silence-days";
import type { ProspectRow } from "@/components/shared/prospect-table";
import { daysSince, formatEuro } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/prospects";

import { ScoreRing } from "./score-ring";

// Les trois opportunités les plus rentables, en grandes cartes (inspiration Attio / Notion Calendar) :
// la carte entière ouvre la fiche, avec élévation et bordure en dégradé au survol.

const EASE = [0.16, 1, 0.3, 1] as const;

export function PriorityCards({ rows }: { rows: ProspectRow[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {rows.map((row, index) => {
        return (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.35 + index * 0.08 }}
            whileHover={{ y: -4 }}
            className="group relative rounded-2xl bg-gradient-to-b from-border to-border/40 p-px shadow-card transition-shadow duration-300 hover:from-primary/50 hover:via-accent-violet/30 hover:to-primary/10 hover:shadow-elevated"
          >
            <Link
              href={`/prospects/${row.id}`}
              className="glass relative flex h-full flex-col rounded-[15px] p-6 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent transition-colors duration-300 group-hover:via-primary/60"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <InitialsAvatar name={row.contact_nom || row.entreprise} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] leading-6 font-semibold text-foreground">{row.entreprise}</p>
                    <p className="truncate text-dense text-foreground-secondary">
                      {[row.contact_nom, row.etape ? STAGE_LABELS[row.etape] : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-caption font-semibold text-foreground-tertiary tabular-nums ring-1 ring-border">
                  #{index + 1}
                </span>
              </div>

              <div className="mt-6 flex items-end justify-between gap-4">
                <div>
                  <p className="text-overline text-foreground-tertiary">CA récupérable</p>
                  <p className="mt-1 text-[30px] leading-9 font-bold tracking-[-0.035em] text-foreground tabular-nums">
                    {row.ca_recuperable_eur === null ? "—" : formatEuro(row.ca_recuperable_eur)}
                  </p>
                </div>
                {row.score !== null && <ScoreRing score={row.score} explanation={row.explanation} />}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                {row.date_dernier_contact ? <SilenceDays days={daysSince(row.date_dernier_contact)} relative /> : <span />}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-dense font-semibold text-primary transition-colors duration-200 group-hover:text-accent-violet"
                  )}
                >
                  <SparklesIcon className="size-3.5" aria-hidden />
                  Voir la relance
                  <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
