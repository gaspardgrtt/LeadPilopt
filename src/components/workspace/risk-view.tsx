import Link from "next/link";
import { ArrowRightIcon, HourglassIcon, ShieldCheckIcon, TrendingDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion/motion";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { SilenceDays } from "@/components/shared/silence-days";
import { formatEuro, formatInteger } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/prospects";
import { FLOOR_DAY, type RiskAnalysis, type RiskInput } from "@/lib/risk/risk";

// « Dossiers à risque » (présentation) : les dossiers qui vont être oubliés cette semaine et ceux
// qui perdent de l'argent récupérable chaque jour sans relance. Règles affichées en clair.

type RiskViewProps = { analysis: RiskAnalysis<RiskInput>; threshold: number };

function RiskRow({
  row,
  badge,
  badgeTone,
  amount,
  amountLabel,
}: {
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
        <InitialsAvatar name={row.contact_nom || row.entreprise} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold text-foreground">{row.entreprise}</span>
          <span className="block truncate text-dense text-foreground-secondary">
            {[row.contact_nom, row.etape ? STAGE_LABELS[row.etape] : null].filter(Boolean).join(" · ") || "—"}
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
  icon: Icon,
  tone,
  title,
  description,
  empty,
  children,
  count,
  delay,
}: {
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
              {title} <span className="text-foreground-tertiary tabular-nums">· {formatInteger(count)}</span>
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

export function RiskView({ analysis, threshold }: RiskViewProps) {
  const { soonForgotten, losingValue, weeklyLossTotal } = analysis;

  return (
    <div className="flex flex-col gap-5">
      <FadeIn>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-hero p-5 text-hero-foreground shadow-hero ring-1 ring-white/10">
            <dt className="text-dense text-hero-muted">Argent perdu en 7 jours sans relance</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] tabular-nums">
              {weeklyLossTotal > 0 ? `−${formatEuro(weeklyLossTotal)}` : formatEuro(0)}
            </dd>
          </div>
          <div className="rounded-2xl border bg-surface p-5 shadow-card">
            <dt className="text-dense text-foreground-secondary">Bientôt oubliés</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] text-foreground tabular-nums">
              {formatInteger(soonForgotten.length)}
            </dd>
          </div>
          <div className="rounded-2xl border bg-surface p-5 shadow-card">
            <dt className="text-dense text-foreground-secondary">Dossiers qui perdent de la valeur</dt>
            <dd className="mt-1 text-[28px] leading-9 font-bold tracking-[-0.03em] text-foreground tabular-nums">
              {formatInteger(losingValue.length)}
            </dd>
          </div>
        </dl>
      </FadeIn>

      <Section
        icon={HourglassIcon}
        tone="warning"
        title="Bientôt oubliés"
        description={`Dossiers en cours qui dépasseront votre seuil de ${threshold} jours sans contact dans la semaine.`}
        empty="Aucun dossier ne sera oublié dans les 7 prochains jours."
        count={soonForgotten.length}
        delay={0.1}
      >
        {soonForgotten.map((row) => (
          <RiskRow
            key={row.id}
            row={row}
            badge={row.daysLeft === 1 ? "Oublié demain" : `Oublié dans ${row.daysLeft} j`}
            badgeTone="warning"
            amount={row.montant_eur === null ? "—" : formatEuro(row.montant_eur)}
            amountLabel="montant"
          />
        ))}
      </Section>

      <Section
        icon={TrendingDownIcon}
        tone="danger"
        title="Ils perdent de la valeur"
        description="Dossiers oubliés à traiter : chaque jour sans relance réduit l'argent récupérable."
        empty="Aucun dossier oublié ne perd de valeur en ce moment."
        count={losingValue.length}
        delay={0.2}
      >
        {losingValue.map((row) => (
          <RiskRow
            key={row.id}
            row={row}
            badge={`Oublié depuis ${row.silence - threshold} j`}
            badgeTone="danger"
            amount={`−${formatEuro(row.weeklyLoss)}`}
            amountLabel="par semaine"
          />
        ))}
      </Section>

      <FadeIn delay={0.3}>
        <p className="px-1 text-caption text-foreground-tertiary">
          Calcul : l&apos;argent récupérable vaut montant × poids de l&apos;étape × (1 − jours sans contact / 180). Chaque jour
          de silence retire donc 1/180 du montant pondéré, jusqu&apos;au plancher atteint à {FLOOR_DAY} jours. Les dossiers gagnés,
          perdus ou ignorés ne sont pas concernés.
        </p>
      </FadeIn>
    </div>
  );
}
