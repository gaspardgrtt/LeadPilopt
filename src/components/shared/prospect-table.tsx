"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useFormat, useT } from "@/i18n/client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { SilenceDays } from "@/components/shared/silence-days";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusMenu } from "@/components/shared/status-menu";
import { daysSince } from "@/lib/format";
import {
  type DealStage,
  type ProspectStatus,
} from "@/lib/prospects";
import type { ScoreExplanation } from "@/lib/scoring/score";

// Tableau de prospects partagé par E3 (top 10) et E4 (liste complète).
// Les lignes ouvrent la fiche ; le statut se change en place via `onStatusChange`.
export type ProspectRow = {
  id: string;
  entreprise: string;
  contact_nom: string | null;
  montant_eur: number | null;
  etape: DealStage | null;
  date_dernier_contact: string | null;
  score: number | null;
  ca_recuperable_eur: number | null;
  statut: ProspectStatus;
  /** Explication du score (« Pourquoi ce score ? »), quand la page l'a calculée. */
  explanation?: ScoreExplanation | null;
};

type ProspectTableProps = {
  rows: ProspectRow[];
  /** Variante E3 : moins de colonnes, statut en lecture seule, bouton « Voir la relance ». */
  compact?: boolean;
  onStatusChange?: (
    id: string,
    status: ProspectStatus,
  ) => Promise<{ ok: boolean; message?: string }>;
};

const DASH = "—";

export function ProspectTable({
  rows,
  compact = false,
  onStatusChange,
}: ProspectTableProps) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const [statuses, setStatuses] = React.useState<
    Record<string, ProspectStatus>
  >({});

  async function changeStatus(row: ProspectRow, status: ProspectStatus) {
    if (!onStatusChange) return;
    const previous = statuses[row.id] ?? row.statut;
    setStatuses((current) => ({ ...current, [row.id]: status }));
    const result = await onStatusChange(row.id, status);
    if (!result.ok) {
      setStatuses((current) => ({ ...current, [row.id]: previous }));
      toast.error(result.message ?? t.workspace.statusError);
      return;
    }
    toast.success(t.workspace.statusChanged(row.entreprise, t.enums.status[status]), {
      action: {
        label: t.common.undo,
        onClick: () => void changeStatus({ ...row, statut: status }, previous),
      },
    });
  }

  const statusControl = (row: ProspectRow) => {
    const status = statuses[row.id] ?? row.statut;
    return onStatusChange ? (
      <StatusMenu
        value={status}
        onChange={(next) => void changeStatus(row, next)}
      />
    ) : (
      <StatusBadge status={status} />
    );
  };

  return (
    <>
      {/* Mobile : une carte par dossier, l'argent récupérable en évidence. */}
      <ul className="divide-y md:hidden" aria-label={t.workspace.prospects.list}>
        {rows.map((row) => {
          const href = `/prospects/${row.id}`;
          return (
            <li
              key={row.id}
              className="relative px-4 py-3.5 transition-colors active:bg-surface-subtle"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {/* Lien étendu : toute la carte ouvre la fiche, le menu de statut reste cliquable. */}
                  <Link
                    href={href}
                    className="block truncate text-body font-semibold text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
                  >
                    {row.entreprise}
                  </Link>
                  <span className="block truncate text-dense text-foreground-secondary">
                    {[
                      row.contact_nom,
                      row.etape ? t.enums.stage[row.etape] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || DASH}
                  </span>
                </div>
                <span className="relative z-10 shrink-0">
                  {statusControl(row)}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  {row.date_dernier_contact && (
                    <SilenceDays days={daysSince(row.date_dernier_contact)} />
                  )}
                  {row.score !== null && <ScoreGauge score={row.score} />}
                </span>
                <span className="shrink-0 text-right text-[15px] leading-6 font-semibold text-foreground tabular-nums">
                  {row.ca_recuperable_eur === null
                    ? DASH
                    : format.euro(row.ca_recuperable_eur)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead>{t.workspace.prospects.columns.company}</TableHead>
            {!compact && <TableHead>{t.workspace.prospects.columns.stage}</TableHead>}
            {!compact && <TableHead numeric>{t.workspace.prospects.columns.amount}</TableHead>}
            <TableHead>{t.workspace.prospects.columns.lastContact}</TableHead>
            <TableHead>{t.workspace.prospects.columns.silence}</TableHead>
            <TableHead>{t.workspace.prospects.columns.score}</TableHead>
            <TableHead numeric>{t.workspace.prospects.columns.recoverable}</TableHead>
            <TableHead>{t.workspace.prospects.columns.status}</TableHead>
            {compact && <TableHead>{t.workspace.prospects.columns.action}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const href = `/prospects/${row.id}`;
            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={(event) => {
                  if (
                    (event.target as HTMLElement).closest(
                      "a, button, [role='menuitem']",
                    )
                  )
                    return;
                  router.push(href);
                }}
              >
                <TableCell className="text-foreground">
                  <Link
                    href={href}
                    className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
                  >
                    {row.entreprise}
                  </Link>
                  {row.contact_nom && (
                    <span className="block text-dense text-foreground-tertiary">
                      {row.contact_nom}
                    </span>
                  )}
                </TableCell>
                {!compact && (
                  <TableCell>
                    {row.etape ? t.enums.stage[row.etape] : DASH}
                  </TableCell>
                )}
                {!compact && (
                  <TableCell numeric>
                    {row.montant_eur === null
                      ? DASH
                      : format.euro(row.montant_eur)}
                  </TableCell>
                )}
                <TableCell className="tabular-nums">
                  {row.date_dernier_contact
                    ? format.numericDate(row.date_dernier_contact)
                    : DASH}
                </TableCell>
                <TableCell>
                  {row.date_dernier_contact ? (
                    <SilenceDays days={daysSince(row.date_dernier_contact)} />
                  ) : (
                    DASH
                  )}
                </TableCell>
                <TableCell>
                  {row.score === null ? DASH : <ScoreGauge score={row.score} />}
                </TableCell>
                <TableCell numeric className="font-semibold text-foreground">
                  {row.ca_recuperable_eur === null
                    ? DASH
                    : format.euro(row.ca_recuperable_eur)}
                </TableCell>
                <TableCell>{statusControl(row)}</TableCell>
                {compact && (
                  <TableCell>
                    <Button size="sm" asChild>
                      <Link href={href}>{t.workspace.viewFollowup}</Link>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
