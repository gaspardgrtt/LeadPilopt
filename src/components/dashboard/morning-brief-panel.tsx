"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowRightIcon, PencilIcon, PlusIcon, SparklesIcon, SunIcon, XIcon } from "lucide-react";

import type { ProspectRow } from "@/components/shared/prospect-table";
import type { MorningBrief } from "@/lib/brief/brief";
import { useFormat, useLocale, useT } from "@/i18n/client";

import { WhyPriority } from "@/components/score/why-priority";

import { CommissionEditor } from "./commission-editor";
import { prospectTitle } from "@/lib/prospects";

// Brief du matin en fonctionnalité secondaire : un bouton ouvre un panneau latéral qui résume la
// journée (argent récupérable, commission, action du jour, progression, « Pourquoi prioritaire ? »).
// Les chiffres viennent de buildMorningBrief (aucune IA).

type MorningBriefPanelProps = {
  firstName: string;
  todayLabel: string;
  recoverable: number;
  toFollowUp: number;
  commissionRate: number | null;
  commissionEditable?: boolean;
  brief: MorningBrief;
  priorities: ProspectRow[];
};

export function MorningBriefPanel({
  firstName,
  todayLabel,
  recoverable,
  toFollowUp,
  commissionRate,
  commissionEditable = true,
  brief,
  priorities,
}: MorningBriefPanelProps) {
  const t = useT();
  const format = useFormat();
  const locale = useLocale();
  const rateLabel =
    commissionRate === null ? "" : locale === "en" ? `${commissionRate}%` : `${String(commissionRate).replace(".", ",")} %`;
  const commissionLine =
    brief.commission !== null ? (
      <>
        {t.brief.commission(format.euro(brief.commission), rateLabel)}
        {commissionEditable && <PencilIcon className="size-3" aria-hidden />}
      </>
    ) : commissionEditable ? (
      <>
        <PlusIcon className="size-3.5" aria-hidden />
        {t.brief.showCommission}
      </>
    ) : null;

  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-dense font-semibold text-foreground shadow-card ring-1 ring-border outline-none transition-colors hover:bg-surface-subtle focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <SunIcon className="size-4 text-warning" aria-hidden />
          {t.brief.button}
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col overflow-y-auto bg-background shadow-overlay outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-start justify-between gap-4 border-b bg-surface px-6 py-5">
            <div>
              <p className="inline-flex items-center gap-1.5 text-caption font-semibold text-foreground-secondary">
                <SunIcon className="size-3.5 text-warning" aria-hidden />
                {t.brief.button} · <span className="first-letter:uppercase">{todayLabel}</span>
              </p>
              <DialogPrimitive.Title className="mt-1 text-[18px] leading-7 font-semibold text-foreground">
                {t.brief.greeting(firstName)}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label={t.brief.close}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-tertiary outline-none hover:bg-surface-subtle hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
            >
              <XIcon className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="flex flex-col gap-5 px-6 py-5">
            <section>
              <p className="text-[34px] leading-10 font-bold tracking-[-0.03em] text-foreground tabular-nums">{format.euro(recoverable)}</p>
              <DialogPrimitive.Description className="text-body text-foreground-secondary">
                {t.brief.recoverableToday} · {format.integer(toFollowUp)} {brief.toFollowUpLabel}
              </DialogPrimitive.Description>
              {commissionLine &&
                (commissionEditable ? (
                  <CommissionEditor
                    rate={commissionRate}
                    trigger={
                      <button
                        type="button"
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-md text-dense text-foreground-secondary outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
                      >
                        {commissionLine}
                      </button>
                    }
                  />
                ) : (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-dense text-foreground-secondary">{commissionLine}</p>
                ))}
            </section>

            <section className="rounded-xl border border-primary/15 bg-primary-soft/60 p-4">
              <p className="inline-flex items-center gap-1.5 text-caption font-semibold tracking-wide text-primary uppercase">
                <SparklesIcon className="size-3.5" aria-hidden />
                {t.brief.actionOfTheDay}
              </p>
              {brief.action ? (
                <>
                  <p className="mt-1.5 text-body font-medium text-foreground">{brief.action.sentence}</p>
                  <DialogPrimitive.Close asChild>
                    <Link
                      href={brief.action.href}
                      className="group mt-3 inline-flex items-center gap-1.5 rounded-md text-dense font-semibold text-primary outline-none hover:text-accent-violet focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    >
                      {brief.action.cta}
                      <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </DialogPrimitive.Close>
                </>
              ) : (
                <p className="mt-1.5 text-body font-medium text-foreground">
                  {brief.state === "all_done"
                    ? t.brief.allDone
                    : t.brief.nothingToDo}
                </p>
              )}
              {brief.progress && (
                <div className="mt-4">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-surface"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={brief.progress.total}
                    aria-valuenow={brief.progress.done}
                    aria-label={t.brief.progressLabel}
                  >
                    <div className="h-full rounded-full bg-success" style={{ width: `${(brief.progress.done / brief.progress.total) * 100}%` }} />
                  </div>
                  <p className="mt-1.5 text-caption text-foreground-secondary tabular-nums">{brief.progress.label}</p>
                </div>
              )}
            </section>

            {priorities.length > 0 && (
              <section>
                <h3 className="text-body font-semibold text-foreground">{t.brief.whyPriority}</h3>
                <ol className="mt-2 flex flex-col divide-y rounded-xl border bg-surface">
                  {priorities.map((row, index) => {
                    const explanation = row.explanation?.kind === "scored" ? row.explanation : null;
                    const amount = explanation ? explanation.recoverable : row.ca_recuperable_eur;
                    return (
                      <li key={row.id} className="p-4">
                        <DialogPrimitive.Close asChild>
                          <Link
                            href={`/prospects/${row.id}`}
                            className="flex items-baseline justify-between gap-3 rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
                          >
                            <span className="truncate text-body font-semibold text-foreground">
                              <span className="text-foreground-tertiary tabular-nums">#{index + 1}</span> {prospectTitle(row)}
                            </span>
                            <span className="shrink-0 text-body font-semibold text-foreground tabular-nums">
                              {amount === null ? "—" : format.euro(amount)}
                            </span>
                          </Link>
                        </DialogPrimitive.Close>
                        {explanation && <WhyPriority factors={explanation.factors} className="mt-2" />}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
