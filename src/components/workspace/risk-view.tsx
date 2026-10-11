import Link from "next/link";
import { ArrowRightIcon, HourglassIcon, ShieldCheckIcon, TrendingDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion/motion";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SilenceDays } from "@/components/shared/silence-days";
import type { Format } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import { FLOOR_DAY, type RiskAnalysis, type RiskInput } from "@/lib/risk/risk";
import { prospectTitle, prospectContact } from "@/lib/prospects";

// « Dossiers à risque » (présentation) : les dossiers qui vont être oubliés cette semaine et ceux
// qui perdent de l'argent récupérable chaque jour sans relance. Règles affichées en clair.

type RiskViewProps = { analysis: RiskAnalysis<RiskInput>; threshold: number };
type I18n = { t: Awaited<ReturnType<typeof getI18n>>["t"]; format: Format };

function RiskRow({
  i18n: { t },
  row,
  badge,
  badgeTone,
  amount,
  amountLabel,
}: {
  i18n: I18n;
  row: RiskInput & { silence: number };
  badge: string;
  badgeTone: "warning" | "danger";
  amount: string;
  amountLabel: string;
}) {
  return (
    <li>
      <Link
        href={`/prospects/${row.id}#relance`}
        className="group flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-primary-soft/50 focus-visible:ring-[3px] focus-visible:ring-primary/25 sm:flex-nowrap"
      >
        <InitialsAvatar name={row.contact_nom || prospectTitle(row)} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-foreground">{prospectTitle(row)}</span>
          <span className="block truncate text-dense text-foreground-secondary">
            {[prospectContact(row), row.etape ? t.enums.stage[row.etape] : null].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>
        <span className="flex items-center gap-2 max-sm:order-last max-sm:w-full max-sm:pl-11">
          <SilenceDays days={row.silence} />
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-caption font-semibold whitespace-nowrap",
              badgeTone === "warning" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"
            )}
          >
            {badge}
          </span>
        </span>
        <span className="text-right sm:w-32">
          <span className="block text-body font-semibold text-foreground tabular-nums">{amount}</span>
          <span className="block text-caption text-foreground-tertiary">{amountLabel}</span>
        </span>
        <ArrowRightIcon
          className="hidden size-4 shrink-0 text-foreground-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
          aria-hidden
        />
      </Link>
    </li>
  );
}

function Section({
  i18n: { format },
  icon: Icon,
  tone,
  title,
  description,
  empty,
  children,
  count,
  delay,
}: {
  i18n: I18n;
  icon: typeof HourglassIcon;
  tone: "warning" | "danger";
  title: string;
  description: string;
  empty: string;
  children: React.ReactNode;
  count: number;
  delay: number;
}) {
  return (
    <FadeIn delay={delay}>
      <section className="rounded-2xl border bg-surface p-2 shadow-card sm:p-3" aria-label={title}>
        <header className="flex items-start gap-3 px-3 pt-3 pb-2">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              tone === "warning" ? "bg-warning-soft text-warning" : "bg-danger-soft text-danger"
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-[16px] leading-6 font-semibold text-foreground">
              {title} <span className="text-foreground-tertiary tabular-nums">· {format.integer(count)}</span>
            </h2>
            <p className="text-dense text-foreground-secondary">{description}</p>
          </div>
        </header>
        {count > 0 ? (
          <ol className="flex flex-col">{children}</ol>
        ) : (
          <p className="flex items-center gap-2 px-3 pt-1 pb-4 text-dense text-foreground-secondary">
            <ShieldCheckIcon className="size-4 text-success" aria-hidden />
            {empty}
          </p>
        )}
      </section>
    </FadeIn>
  );
}

export async function RiskView({ analysis, threshold }: RiskViewProps) {
  const i18n = await getI18n();
  const { t, format } = i18n;
  const { soonForgotten, losingValue, weeklyLossTotal } = analysis;

  return (
    <div className="flex flex-col gap-5">
      <FadeIn>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-hero p-5 text-hero-foreground shadow-hero ring-1 ring-white/10">
            <dt className="text-dense text-hero-muted">{t.workspace.risk.weeklyLoss}</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] tabular-nums">
              {weeklyLossTotal > 0 ? `−${format.euro(weeklyLossTotal)}` : format.euro(0)}
            </dd>
          </div>
          <div className="rounded-2xl border bg-surface p-5 shadow-card">
            <dt className="text-dense text-foreground-secondary">{t.workspace.risk.soonTitle}</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] text-foreground tabular-nums">
              {format.integer(soonForgotten.length)}
            </dd>
          </div>
          <div className="rounded-2xl border bg-surface p-5 shadow-card">
            <dt className="text-dense text-foreground-secondary">{t.workspace.risk.losingCount}</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] text-foreground tabular-nums">
              {format.integer(losingValue.length)}
            </dd>
          </div>
        </dl>
      </FadeIn>

      <Section
        i18n={i18n}
        icon={HourglassIcon}
        tone="warning"
        title={t.workspace.risk.soonTitle}
        description={t.workspace.risk.soonDescription(threshold)}
        empty={t.workspace.risk.soonEmpty}
        count={soonForgotten.length}
        delay={0.1}
      >
        {soonForgotten.map((row) => (
          <RiskRow
            i18n={i18n}
            key={row.id}
            row={row}
            badge={row.daysLeft === 1 ? t.workspace.risk.forgottenTomorrow : t.workspace.risk.forgottenIn(row.daysLeft)}
            badgeTone="warning"
            amount={row.montant_eur === null ? "—" : format.euro(row.montant_eur)}
            amountLabel={t.workspace.risk.amountLabel}
          />
        ))}
      </Section>

      <Section
        i18n={i18n}
        icon={TrendingDownIcon}
        tone="danger"
        title={t.workspace.risk.losingTitle}
        description={t.workspace.risk.losingDescription}
        empty={t.workspace.risk.losingEmpty}
        count={losingValue.length}
        delay={0.2}
      >
        {losingValue.map((row) => (
          <RiskRow
            i18n={i18n}
            key={row.id}
            row={row}
            badge={t.workspace.risk.forgottenFor(row.silence - threshold)}
            badgeTone="danger"
            amount={`−${format.euro(row.weeklyLoss)}`}
            amountLabel={t.workspace.risk.perWeek}
          />
        ))}
      </Section>

      <FadeIn delay={0.3}>
        <p className="px-1 text-caption text-foreground-tertiary">
          {t.workspace.risk.footnote(FLOOR_DAY)}
        </p>
      </FadeIn>
    </div>
  );
}
