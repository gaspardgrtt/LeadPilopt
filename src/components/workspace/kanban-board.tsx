"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRightLeftIcon, CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SilenceDays } from "@/components/shared/silence-days";
import type { ProspectListItem } from "@/lib/data/prospects";
import { daysSince, formatEuro, formatInteger } from "@/lib/format";
import { DEAL_STAGES, STAGE_LABELS, type DealStage } from "@/lib/prospects";

// « Mes dossiers » : Kanban par étape de l'affaire. Glisser-déposer à la souris, et menu
// « Déplacer vers » sur chaque carte (clavier, mobile). Un déplacement change l'étape en base
// puis recalcule le score et l'argent récupérable (action serveur updateProspectStage).

type KanbanItem = Pick<
  ProspectListItem,
  "id" | "entreprise" | "contact_nom" | "montant_eur" | "etape" | "date_dernier_contact" | "est_oublie" | "ca_recuperable_eur"
>;

type ColumnKey = DealStage | "sans_etape";

const COLUMN_ACCENT: Record<ColumnKey, string> = {
  sans_etape: "bg-foreground-tertiary/40",
  decouverte: "bg-accent-blue/70",
  qualification: "bg-[var(--primary-light)]",
  proposition: "bg-primary",
  negociation: "bg-accent-violet",
  gagne: "bg-success",
  perdu: "bg-foreground-tertiary",
};

const COLUMN_LIMIT = 40;
const CLOSED: DealStage[] = ["gagne", "perdu"];

type KanbanBoardProps = {
  rows: KanbanItem[];
  onStageChange: (id: string, stage: DealStage) => Promise<{ ok: boolean; message?: string }>;
};

export function KanbanBoard({ rows, onStageChange }: KanbanBoardProps) {
  const [stages, setStages] = React.useState<Record<string, DealStage>>({});
  const [dragging, setDragging] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<ColumnKey | null>(null);
  const [scope, setScope] = React.useState<"ouverts" | "tous">("ouverts");
  const [expanded, setExpanded] = React.useState<Partial<Record<ColumnKey, boolean>>>({});

  // Les données serveur font foi après chaque revalidation.
  React.useEffect(() => setStages({}), [rows]);

  const stageOf = (row: KanbanItem): ColumnKey => stages[row.id] ?? row.etape ?? "sans_etape";

  const columns: ColumnKey[] = [
    ...(rows.some((row) => stageOf(row) === "sans_etape") ? (["sans_etape"] as const) : []),
    ...DEAL_STAGES.filter((stage) => scope === "tous" || !CLOSED.includes(stage)),
  ];

  async function move(row: KanbanItem, stage: DealStage) {
    const previous = stageOf(row);
    if (previous === stage) return;
    setStages((current) => ({ ...current, [row.id]: stage }));
    const result = await onStageChange(row.id, stage);
    if (!result.ok) {
      setStages((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      toast.error(result.message ?? "Le dossier n'a pas pu être déplacé.");
      return;
    }
    toast.success(`${row.entreprise} → ${STAGE_LABELS[stage]}`, {
      description: "Score et argent récupérable recalculés.",
      action: previous !== "sans_etape" ? { label: "Annuler", onClick: () => void move({ ...row, etape: stage }, previous) } : undefined,
    });
  }

  const closedCount = rows.filter((row) => CLOSED.includes(stageOf(row) as DealStage)).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(value) => value && setScope(value as "ouverts" | "tous")}
          aria-label="Dossiers affichés"
        >
          <ToggleGroupItem value="ouverts">Dossiers en cours</ToggleGroupItem>
          <ToggleGroupItem value="tous">
            Avec les dossiers clos <span className="text-foreground-tertiary tabular-nums">{formatInteger(closedCount)}</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="hidden text-dense text-foreground-tertiary md:block">
          Glissez une carte d&apos;une colonne à l&apos;autre pour changer l&apos;étape.
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
        <div className="flex snap-x snap-mandatory gap-4 md:snap-none">
          {columns.map((column) => {
            const items = rows.filter((row) => stageOf(row) === column);
            const total = items.reduce((sum, row) => sum + (row.montant_eur ?? 0), 0);
            const shown = expanded[column] ? items : items.slice(0, COLUMN_LIMIT);
            const droppable = column !== "sans_etape";
            return (
              <section
                key={column}
                aria-label={column === "sans_etape" ? "Sans étape" : STAGE_LABELS[column]}
                onDragOver={(event) => {
                  if (!droppable || !dragging) return;
                  event.preventDefault();
                  setOver(column);
                }}
                onDragLeave={() => setOver((current) => (current === column ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setOver(null);
                  const row = rows.find((item) => item.id === dragging);
                  if (row && droppable) void move(row, column);
                }}
                className={cn(
                  "flex w-[82vw] shrink-0 snap-start flex-col rounded-2xl border bg-surface-subtle/70 transition-colors sm:w-72 md:w-auto md:min-w-64 md:flex-1",
                  over === column && "border-primary/40 bg-primary-soft/60"
                )}
              >
                <header className="flex items-center gap-2.5 px-3.5 pt-3.5 pb-2.5">
                  <span aria-hidden className={cn("size-2 rounded-full", COLUMN_ACCENT[column])} />
                  <h2 className="text-body font-semibold text-foreground">
                    {column === "sans_etape" ? "Sans étape" : STAGE_LABELS[column]}
                  </h2>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-caption font-semibold text-foreground-secondary tabular-nums ring-1 ring-border">
                    {formatInteger(items.length)}
                  </span>
                  <span className="ml-auto text-caption text-foreground-tertiary tabular-nums">{total > 0 ? formatEuro(total) : ""}</span>
                </header>

                <ol className="flex min-h-24 flex-col gap-2 px-2.5 pb-2.5">
                  {shown.map((row) => (
                    <li
                      key={row.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", row.id);
                        setDragging(row.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cn(
                        "group rounded-xl border bg-surface p-3 shadow-card transition-[box-shadow,opacity] hover:shadow-elevated md:cursor-grab md:active:cursor-grabbing",
                        dragging === row.id && "opacity-50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/prospects/${row.id}`}
                            className="block truncate rounded-sm text-body font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
                          >
                            {row.entreprise}
                          </Link>
                          <p className="truncate text-dense text-foreground-secondary">{row.contact_nom || "—"}</p>
                        </div>
                        <MoveMenu current={stageOf(row)} onMove={(stage) => void move(row, stage)} />
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="text-dense font-semibold text-foreground tabular-nums">
                          {row.montant_eur === null ? "Montant estimé" : formatEuro(row.montant_eur)}
                        </span>
                        {row.date_dernier_contact && <SilenceDays days={daysSince(row.date_dernier_contact)} />}
                      </div>
                      {row.est_oublie && row.ca_recuperable_eur !== null && !stages[row.id] && (
                        <p className="mt-2 flex items-center gap-1.5 text-caption text-warning">
                          <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                          À relancer · {formatEuro(row.ca_recuperable_eur)} récupérables
                        </p>
                      )}
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 py-6 text-center text-dense text-foreground-tertiary">
                      Aucun dossier
                    </li>
                  )}
                  {items.length > shown.length && (
                    <li>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setExpanded((current) => ({ ...current, [column]: true }))}
                      >
                        Afficher les {formatInteger(items.length - shown.length)} autres
                      </Button>
                    </li>
                  )}
                </ol>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MoveMenu({ current, onMove }: { current: ColumnKey; onMove: (stage: DealStage) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Déplacer vers une autre étape"
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-tertiary outline-none transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100"
      >
        <ArrowRightLeftIcon className="size-3.5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Déplacer vers</DropdownMenuLabel>
        {DEAL_STAGES.map((stage) => (
          <DropdownMenuItem key={stage} disabled={stage === current} onSelect={() => onMove(stage)}>
            <span aria-hidden className={cn("size-2 rounded-full", COLUMN_ACCENT[stage])} />
            {STAGE_LABELS[stage]}
            {stage === current && <CheckIcon className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
