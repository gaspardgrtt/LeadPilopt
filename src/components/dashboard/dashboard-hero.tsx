"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightIcon, DownloadIcon, SparklesIcon } from "lucide-react";

import { MovingBorderButton } from "@/components/shared/moving-border-button";
import { useFormat, useLocale, useT } from "@/i18n/client";

import { CountUp } from "./count-up";
import { ProgressRing } from "./progress-ring";

// Bandeau d'ouverture du dashboard (inspiration Linear / Vercel) : fond sombre avec aurore
// indigo-violet en mouvement lent, chiffre clé en grand, une action principale (« session de
// relance », qui ouvre le prospect le plus rentable) et, à droite, un seul indicateur (part des
// affaires oubliées) plus deux statistiques réelles.

type DashboardHeroProps = {
  firstName: string;
  todayLabel: string;
  importLabel: string | null;
  caRecuperable: number;
  nbOublies: number;
  nbAffairesOuvertes: number;
  caRecupere: number;
  weekly: { generated: number; copied: number };
  /** Seuil d'inactivité du compte (jours sans contact avant qu'une affaire soit oubliée). */
  threshold: number;
  /** Fiche du premier prospect à relancer, ou la liste s'il n'y en a pas. */
  startHref: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

export function DashboardHero({
  firstName,
  todayLabel,
  importLabel,
  caRecuperable,
  nbOublies,
  nbAffairesOuvertes,
  caRecupere,
  weekly,
  threshold,
  startHref,
}: DashboardHeroProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const format = useFormat();
  const forgottenShare = nbAffairesOuvertes > 0 ? nbOublies / nbAffairesOuvertes : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative isolate overflow-hidden rounded-2xl bg-hero px-5 py-6 text-hero-foreground shadow-hero ring-1 ring-white/10 sm:px-9 sm:py-8"
      aria-labelledby="hero-title"
    >
      {/* Aurore : trois halos flous qui dérivent lentement. */}
      <span aria-hidden className="absolute -top-48 -left-24 -z-10 size-[520px] animate-aurora rounded-full bg-primary/45 blur-[110px] motion-reduce:animate-none" />
      <span aria-hidden className="absolute -right-32 -bottom-56 -z-10 size-[560px] animate-aurora-reverse rounded-full bg-accent-violet/35 blur-[120px] motion-reduce:animate-none" />
      <span aria-hidden className="absolute top-10 right-1/3 -z-10 size-64 animate-aurora rounded-full bg-accent-blue/20 blur-[90px] motion-reduce:animate-none" />
      {/* Grille fine qui s'estompe vers les bords, et liseré lumineux en haut. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07] [mask-image:radial-gradient(70%_60%_at_30%_30%,black,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6 xl:grid-cols-[1.5fr_1fr] xl:gap-10">
        <div className="min-w-0">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-dense text-hero-muted"
          >
            <span className="first-letter:uppercase">{todayLabel}</span>
            {importLabel && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-hero-muted/70" />
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-on-dark-positive opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-on-dark-positive" />
                  </span>
                  {t.dashboard.upToDate(importLabel)}
                </span>
              </>
            )}
          </motion.p>

          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
            className="mt-3 text-[19px] leading-7 font-semibold tracking-[-0.015em] text-hero-foreground sm:text-[21px]"
          >
            {t.dashboard.greeting(firstName)} <span className="text-hero-muted">{t.dashboard.greetingRest}</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            className="mt-3"
          >
            <CountUp
              value={caRecuperable}
              format={format.euro}
              className="block bg-gradient-to-br from-white via-white to-primary-light bg-clip-text text-[46px] leading-[1.05] font-bold tracking-[-0.045em] text-transparent tabular-nums sm:text-[60px]"
            />
            <p className="mt-1.5 text-[15px] leading-6 text-hero-muted">
              {t.dashboard.recoverableOn}{" "}
              <span className="font-semibold text-hero-foreground">
                {t.dashboard.forgottenDeals(format.integer(nbOublies), nbOublies)}
              </span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <MovingBorderButton size="lg" className="w-full sm:w-auto" onClick={() => router.push(startHref)}>
              <SparklesIcon />
              {t.dashboard.startSession}
              <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </MovingBorderButton>
            <Link
              href="/import"
              title={t.dashboard.newImport}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-body font-medium text-hero-foreground ring-1 ring-white/25 transition-colors duration-200 outline-none hover:bg-white/[0.08] focus-visible:ring-[3px] focus-visible:ring-primary-light/50 lg:max-xl:px-3"
            >
              <DownloadIcon className="size-4" aria-hidden />
              {/* Entre 1024 et 1280 px, l'icône seule laisse les deux actions sur une ligne. */}
              <span className="lg:max-xl:sr-only">{t.dashboard.newImport}</span>
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          className="rounded-2xl bg-white/[0.05] p-5 ring-1 ring-white/10 backdrop-blur-md"
        >
          <div className="flex items-center gap-5">
            <ProgressRing value={forgottenShare} size={104} stroke={9} gradientId="hero-ring">
              <span className="text-[24px] leading-7 font-bold tracking-[-0.03em] tabular-nums">
                {Math.round(forgottenShare * 100)}
                {locale === "en" ? "%" : "\u00a0%"}
              </span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-body font-semibold">{t.dashboard.forgottenShare}</p>
              <p className="mt-1 text-dense text-hero-muted">
                {t.dashboard.forgottenDetail(format.integer(nbOublies), format.integer(nbAffairesOuvertes), threshold)}
              </p>
            </div>
          </div>

          <dl className="mt-5 flex flex-col gap-2.5 border-t border-white/10 pt-4 text-dense">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-hero-muted">{t.dashboard.wonAfterFollowup}</dt>
              <dd>
                <CountUp value={caRecupere} format={format.euro} className="font-semibold text-on-dark-positive tabular-nums" />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-hero-muted">{t.dashboard.followupsWeek}</dt>
              <dd className="font-semibold tabular-nums">{format.integer(weekly.copied)}</dd>
            </div>
          </dl>
        </motion.div>
      </div>
    </motion.section>
  );
}
