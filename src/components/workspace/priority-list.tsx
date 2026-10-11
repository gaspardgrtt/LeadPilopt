"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { useFormat, useT } from "@/i18n/client";

import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SilenceDays } from "@/components/shared/silence-days";
import { StatusMenu } from "@/components/shared/status-menu";
import type { ProspectRow } from "@/components/shared/prospect-table";
import { WhyPriority } from "@/components/score/why-priority";
import { daysSince } from "@/lib/format";
import type { ProspectStatus } from "@/lib/prospects";
import { prospectTitle, prospectContact } from "@/lib/prospects";

// « Mes priorités » : la liste de travail complète des dossiers oubliés à traiter, du plus
// rentable au moins rentable, chacun avec « Pourquoi prioritaire ? » et ses deux actions
// (préparer la relance, changer le statut). Affichage par tranches pour rester fluide.

const PAGE_SIZE = 20;
const EASE = [0.16, 1, 0.3, 1] as const;

type PriorityListProps = {
  rows: ProspectRow[];
  onStatusChange: (id: string, status: ProspectStatus) => Promise<{ ok: boolean; message?: string }>;
};

export function PriorityList({ rows, onStatusChange }: PriorityListProps) {
  const t = useT();
  const format = useFormat();
  const [visible, setVisible] = React.useState(PAGE_SIZE);
  const [statuses, setStatuses] = React.useState<Record<string, ProspectStatus>>({});

  async function changeStatus(row: ProspectRow, next: ProspectStatus, previous: ProspectStatus = statuses[row.id] ?? row.statut) {
    setStatuses((current) => ({ ...current, [row.id]: next }));
    const result = await onStatusChange(row.id, next);
    if (!result.ok) {
      setStatuses((current) => ({ ...current, [row.id]: previous }));
      toast.error(result.message ?? t.workspace.statusError);
      return;
    }
    toast.success(t.workspace.statusChanged(prospectTitle(row), t.enums.status[next]), {
      action: { label: t.common.undo, onClick: () => void changeStatus(row, previous, next) },
    });
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {rows.slice(0, visible).map((row, index) => {
          const explanation = row.explanation?.kind === "scored" ? row.explanation : null;
          const recoverable = explanation ? explanation.recoverable : row.ca_recuperable_eur;
          const status = statuses[row.id] ?? row.statut;
          return (
            <motion.li
              key={row.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: status === "a_traiter" ? 1 : 0.55, y: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: Math.min(index, 8) * 0.03 }}
              className="rounded-2xl border bg-surface p-4 shadow-card transition-shadow hover:shadow-elevated sm:p-5"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center lg:gap-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-2 w-6 shrink-0 text-right text-dense font-semibold text-foreground-tertiary tabular-nums">
                    {index + 1}
                  </span>
                  <InitialsAvatar name={row.contact_nom || prospectTitle(row)} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/prospects/${row.id}`}
                      className="block truncate rounded-sm text-[15px] leading-6 font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    >
                      {prospectTitle(row)}
                    </Link>
                    <p className="truncate text-dense text-foreground-secondary">
                      {[prospectContact(row), row.etape ? t.enums.stage[row.etape] : null].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {row.date_dernier_contact && <SilenceDays days={daysSince(row.date_dernier_contact)} relative />}
                      <StatusMenu value={status} onChange={(next) => void changeStatus(row, next)} />
                    </div>
                  </div>
                </div>

                {explanation ? (
                  <div className="min-w-0 rounded-xl bg-surface-tinted/60 px-3 py-2.5 lg:bg-transparent lg:p-0">
                    <p className="mb-1.5 text-overline text-foreground-tertiary">{t.workspace.whyPriority}</p>
                    <WhyPriority factors={explanation.factors} />
                  </div>
                ) : (
                  <span className="hidden lg:block" />
                )}

                <div className="flex items-center justify-between gap-4 border-t pt-3 lg:flex-col lg:items-end lg:border-0 lg:pt-0">
                  <div className="lg:text-right">
                    <p className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-foreground tabular-nums">
                      {recoverable === null ? "—" : format.euro(recoverable)}
                    </p>
                    <p className="text-caption text-foreground-secondary">{t.common.recoverable}</p>
                  </div>
                  <Button asChild size="sm" variant={index < 3 ? "primary" : "secondary"}>
                    <Link href={`/prospects/${row.id}#relance`}>
                      <SparklesIcon />
                      {t.workspace.prepareFollowup}
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.li>
          );
        })}
      </ol>

      {rows.length > visible && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((value) => value + PAGE_SIZE)}>
            {t.workspace.showMore(format.integer(Math.min(PAGE_SIZE, rows.length - visible)))}
            <ArrowRightIcon className="rotate-90" />
          </Button>
        </div>
      )}
    </>
  );
}
