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
import type { ScoreExplanation } from "@/lib/scoring/score";

import { ScoreRing } from "./score-ring";

// Les trois opportunités les plus rentables, en grandes cartes (inspiration Attio / Notion Calendar) :
// la carte entière ouvre la fiche, avec élévation et bordure en dégradé au survol. La première est
// signalée « À relancer en premier » ; le score est résumé en une ligne à partir de ses vrais facteurs.

const EASE = [0.16, 1, 0.3, 1] as const;

/** « montant élevé, affaire avancée » : les deux facteurs qui font le plus monter le score. */
function scoreSummary(explanation: ScoreExplanation | null | undefined): string | null {
  if (explanation?.kind !== "scored") return null;
  const positives = explanation.factors.filter((factor) => factor.points > 0).sort((a, b) => b.points - a.points);
  if (positives.length === 0) return "en dessous de la moyenne de vos affaires";
  return positives
    .slice(0, 2)
    .map((factor) => factor.shortLabel)
    .join(", ");
}

export function PriorityCards({ rows }: { rows: ProspectRow[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {rows.map((row, index) => {
        const first = index === 0;
        const summary = scoreSummary(row.explanation);
        const shownScore = row.explanation?.kind === "scored" ? row.explanation.score : row.score;
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
              className="glass relative flex h-full flex-col rounded-[15px] p-5 outline-none sm:p-6 focus-visible:ring-[3px] focus-visible:ring-primary/30"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/0 to-transparent transition-colors duration-300 group-hover:via-primary/60"
              />
              {first && (
                <p className="mb-3 inline-flex items-center gap-1.5 self-start rounded-full bg-primary-soft px-2.5 py-0.5 text-caption font-semibold text-primary-hover ring-1 ring-primary/20">
                  <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  À relancer en premier
                </p>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {/* Entre 768 et 1280 px, les trois cartes sont étroites : l'avatar laisse la place au nom. */}
                  <InitialsAvatar name={row.contact_nom || row.entreprise} size="md" className="md:max-xl:hidden" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] leading-6 font-semibold text-foreground">{row.entreprise}</p>
                    <p className="line-clamp-2 text-dense text-foreground-secondary">
                      {[row.contact_nom, row.etape ? STAGE_LABELS[row.etape] : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-surface-subtle px-2 py-0.5 text-caption font-semibold text-foreground-secondary tabular-nums ring-1 ring-border">
                  #{index + 1}
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-overline text-foreground-secondary">Récupérable</p>
                  <p className="mt-1 text-[30px] leading-9 font-bold tracking-[-0.035em] text-foreground tabular-nums">
                    {row.ca_recuperable_eur === null ? "—" : formatEuro(row.ca_recuperable_eur)}
                  </p>
                </div>
                {row.score !== null && <ScoreRing score={row.score} explanation={row.explanation} />}
              </div>
              {summary && shownScore !== null && (
                <p className="mt-2 text-dense text-foreground-secondary">
                  <span className="font-semibold text-foreground tabular-nums">Score {Math.round(shownScore)}/100</span> · {summary}
                </p>
              )}

              {/* Pousse le pied de carte en bas, avec au moins 20 px d'écart, pour aligner les trois cartes. */}
              <div aria-hidden className="min-h-5 flex-1" />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                {row.date_dernier_contact ? <SilenceDays days={daysSince(row.date_dernier_contact)} relative /> : <span />}
                {/* Toute la carte est un lien : l'appel à l'action en a l'apparence d'un bouton. */}
                <span
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-dense font-semibold transition-colors duration-200",
                    first
                      ? "bg-primary text-primary-foreground shadow-ai group-hover:bg-primary-hover"
                      : "bg-primary-soft text-primary-hover ring-1 ring-primary/15 group-hover:bg-primary-muted/70"
                  )}
                >
                  <SparklesIcon className="size-3.5" aria-hidden />
                  Préparer la relance
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
