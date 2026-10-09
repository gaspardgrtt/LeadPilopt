"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRightIcon, DownloadIcon, SparklesIcon } from "lucide-react";

import { MovingBorderButton } from "@/components/shared/moving-border-button";
import { formatEuro, formatInteger } from "@/lib/format";

import { CountUp } from "./count-up";
import { ProgressRing } from "./progress-ring";

// Bandeau d'ouverture du dashboard (inspiration Linear / Vercel) : fond sombre avec aurore
// indigo-violet en mouvement lent, chiffre clé en très grand, action principale « session de
// relance » qui ouvre directement le prospect le plus rentable.

type DashboardHeroProps = {
  firstName: string;
  todayLabel: string;
  importLabel: string | null;
  caRecuperable: number;
  nbOublies: number;
  nbAffairesOuvertes: number;
  caRecupere: number;
  weekly: { generated: number; copied: number };
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
  startHref,
}: DashboardHeroProps) {
  const router = useRouter();
  const forgottenShare = nbAffairesOuvertes > 0 ? nbOublies / nbAffairesOuvertes : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: EASE }}
      className="relative isolate overflow-hidden rounded-2xl bg-hero px-6 py-8 text-hero-foreground shadow-hero ring-1 ring-white/10 sm:px-10 sm:py-10"
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

      <div className="grid items-center gap-10 lg:grid-cols-[1.45fr_1fr]">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.1 }}
            className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-caption font-medium text-hero-muted ring-1 ring-white/10 backdrop-blur"
          >
            <span className="first-letter:uppercase">{todayLabel}</span>
            {importLabel && (
              <>
                <span aria-hidden className="size-1 rounded-full bg-hero-muted/60" />
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-soft opacity-60 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-success-soft" />
                  </span>
                  Analyse à jour · {importLabel}
                </span>
              </>
            )}
          </motion.div>

          <motion.h1
            id="hero-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
            className="mt-6 text-[22px] leading-8 font-semibold tracking-[-0.02em] text-hero-foreground sm:text-[26px]"
          >
            Bonjour {firstName},{" "}
            <span className="text-hero-muted">voici l&apos;argent qui dort dans votre pipeline.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            className="mt-5"
          >
            <CountUp
              value={caRecuperable}
              format={formatEuro}
              className="block bg-gradient-to-br from-white via-white to-primary-light bg-clip-text text-[52px] leading-[1.05] font-bold tracking-[-0.045em] text-transparent tabular-nums sm:text-[68px]"
            />
            <p className="mt-2 text-[15px] leading-6 text-hero-muted">
              récupérables sur{" "}
              <span className="font-semibold text-hero-foreground">
                {formatInteger(nbOublies)} affaire{nbOublies > 1 ? "s" : ""} oubliée{nbOublies > 1 ? "s" : ""}
              </span>
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <MovingBorderButton size="lg" onClick={() => router.push(startHref)}>
              <SparklesIcon />
              Démarrer la session de relance
              <ArrowRightIcon className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </MovingBorderButton>
            <Link
              href="/import"
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-white/[0.07] px-4 text-body font-medium text-hero-foreground ring-1 ring-white/15 backdrop-blur transition-colors duration-200 outline-none hover:bg-white/[0.12] focus-visible:ring-[3px] focus-visible:ring-primary-light/50"
            >
              <DownloadIcon className="size-4" />
              Nouvel import
            </Link>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          className="rounded-2xl bg-white/[0.05] p-6 ring-1 ring-white/10 backdrop-blur-md"
        >
          <div className="flex items-center gap-6">
            <ProgressRing value={forgottenShare} size={132} stroke={11} gradientId="hero-ring">
              <span className="text-[28px] leading-8 font-bold tracking-[-0.03em] tabular-nums">
                {Math.round(forgottenShare * 100)}&nbsp;%
              </span>
              <span className="mt-0.5 text-caption font-normal text-hero-muted">oubliées</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-body font-semibold">Part du pipeline à l&apos;abandon</p>
              <p className="mt-1 text-dense text-hero-muted">
                {formatInteger(nbOublies)} affaire{nbOublies > 1 ? "s" : ""} sans contact sur{" "}
                {formatInteger(nbAffairesOuvertes)} ouvertes.
              </p>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <dt className="text-caption font-normal text-hero-muted">CA récupéré</dt>
              <dd className="mt-1">
                <CountUp value={caRecupere} format={formatEuro} className="block text-[20px] leading-7 font-semibold tracking-[-0.02em] text-success-soft tabular-nums" />
                <span className="block text-caption font-normal text-hero-muted">gagné après relance</span>
              </dd>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <dt className="text-caption font-normal text-hero-muted">Relances cette semaine</dt>
              <dd className="mt-1">
                <span className="block text-[20px] leading-7 font-semibold tracking-[-0.02em] tabular-nums">
                  {formatInteger(weekly.copied)} envoyée{weekly.copied > 1 ? "s" : ""}
                </span>
                <span className="block text-caption font-normal text-hero-muted">
                  sur {formatInteger(weekly.generated)} rédigée{weekly.generated > 1 ? "s" : ""} par l&apos;IA
                </span>
              </dd>
            </div>
          </dl>
        </motion.div>
      </div>
    </motion.section>
  );
}
