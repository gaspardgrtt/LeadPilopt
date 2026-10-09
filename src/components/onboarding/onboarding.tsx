"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRightIcon, CheckIcon, FlaskConicalIcon, GaugeIcon, SendIcon, UploadIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Onboarding en 3 étapes (importer, comprendre le score, envoyer sa première relance) : objectif,
// qu'une agence voie la valeur du produit en moins de 3 minutes. Aucune table en plus : l'import et
// la première relance se déduisent des données ; « score compris » et « guide masqué » sont des
// commodités d'affichage gardées dans le navigateur (localStorage).

const SCORE_SEEN_KEY = "leadpilot:onboarding:score-vu";
const HIDDEN_KEY = "leadpilot:onboarding:masque";

const EASE = [0.16, 1, 0.3, 1] as const;

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Stockage indisponible (navigation privée) : le guide restera simplement affiché.
  }
}

/** À monter sur la fiche, à côté de l'explication du score : coche l'étape « Comprendre le score ». */
export function MarkScoreSeen() {
  React.useEffect(() => writeFlag(SCORE_SEEN_KEY), []);
  return null;
}

type Step = { key: string; title: string; text: string; href?: string; cta?: string; done: boolean; icon: React.ElementType };

function StepList({ steps, tone }: { steps: Step[]; tone: "light" | "card" }) {
  const current = steps.findIndex((step) => !step.done);
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {steps.map((step, index) => {
        const active = index === current;
        const Icon = step.icon;
        return (
          <li
            key={step.key}
            className={cn(
              "relative flex gap-3 rounded-xl p-4 ring-1 transition-colors",
              step.done
                ? "bg-success-soft/50 ring-success/15"
                : active
                  ? "bg-surface ring-primary/30 shadow-card"
                  : tone === "card"
                    ? "bg-surface-subtle/60 ring-border"
                    : "bg-surface/60 ring-border"
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                step.done ? "bg-success-solid text-white" : active ? "bg-primary-solid text-primary-foreground" : "bg-surface-subtle text-foreground-tertiary ring-1 ring-border"
              )}
              aria-hidden
            >
              {step.done ? <CheckIcon className="size-4" strokeWidth={2.5} /> : <Icon className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className={cn("text-body font-semibold", step.done ? "text-foreground-secondary line-through decoration-foreground-tertiary/50" : "text-foreground")}>
                <span className="sr-only">{step.done ? "Fait : " : `Étape ${index + 1} : `}</span>
                {step.title}
              </p>
              <p className="mt-0.5 text-dense text-foreground-secondary">{step.text}</p>
              {active && step.href && step.cta && (
                <Link
                  href={step.href}
                  className="group mt-2.5 inline-flex items-center gap-1.5 rounded-md text-dense font-semibold text-primary outline-none hover:text-accent-violet focus-visible:ring-[3px] focus-visible:ring-primary/25"
                >
                  {step.cta}
                  <ArrowRightIcon className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Accueil de l'import au premier passage : la promesse, les 3 étapes et l'essai avec un exemple. */
export function ImportWelcome({ onTrySample, loading }: { onTrySample: () => void; loading: boolean }) {
  const steps: Step[] = [
    { key: "import", title: "Importez vos dossiers", text: "Un export CSV de votre CRM ou de votre tableur.", done: false, icon: UploadIcon },
    { key: "score", title: "Comprenez le score", text: "LeadPilot vous dit quels dossiers valent une relance, et pourquoi.", done: false, icon: GaugeIcon },
    { key: "send", title: "Préparez votre première relance", text: "Personnalisée avec les données du dossier, à ouvrir dans Gmail.", done: false, icon: SendIcon },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary-soft via-surface to-surface p-5 shadow-card sm:p-7"
      aria-labelledby="bienvenue-title"
    >
      <span aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-accent-violet/15 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl">
          <p className="text-overline text-primary">Bienvenue sur LeadPilot</p>
          <h2 id="bienvenue-title" className="mt-1.5 text-[20px] leading-7 font-semibold tracking-[-0.02em] text-foreground sm:text-[22px]">
            Découvrez en 3 minutes l&apos;argent qui dort dans vos dossiers
          </h2>
          <p className="mt-1.5 text-body text-foreground-secondary">
            Pas de fichier sous la main ? Essayez avec 14 dossiers d&apos;exemple : vous pourrez les remplacer par les vôtres ensuite.
          </p>
        </div>
        <button
          type="button"
          onClick={onTrySample}
          disabled={loading}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-surface px-4 text-body font-semibold text-primary shadow-card ring-1 ring-primary/25 outline-none transition-colors hover:bg-primary-soft focus-visible:ring-[3px] focus-visible:ring-primary/30 disabled:opacity-60"
        >
          <FlaskConicalIcon className="size-4" aria-hidden />
          Essayer avec un exemple
        </button>
      </div>
      <div className="relative mt-5">
        <StepList steps={steps} tone="light" />
      </div>
    </motion.section>
  );
}

type OnboardingChecklistProps = {
  /** Au moins une relance copiée ou ouverte dans Gmail. */
  hasSentFollowup: boolean;
  /** Fiche du dossier prioritaire, pour les étapes 2 et 3. */
  priorityHref: string | null;
};

/** Guide « Premiers pas » du dashboard, tant que les 3 étapes ne sont pas faites (masquable). */
export function OnboardingChecklist({ hasSentFollowup, priorityHref }: OnboardingChecklistProps) {
  // Lu après l'hydratation : le rendu serveur ne connaît pas le localStorage.
  const [state, setState] = React.useState<{ scoreSeen: boolean; hidden: boolean } | null>(null);
  React.useEffect(() => setState({ scoreSeen: readFlag(SCORE_SEEN_KEY), hidden: readFlag(HIDDEN_KEY) }), []);

  if (!state || state.hidden) return null;
  const scoreSeen = state.scoreSeen || hasSentFollowup;
  const steps: Step[] = [
    { key: "import", title: "Importez vos dossiers", text: "C'est fait : LeadPilot a analysé votre fichier.", done: true, icon: UploadIcon },
    {
      key: "score",
      title: "Comprenez le score",
      text: "Ouvrez le dossier prioritaire : chaque point du score est expliqué.",
      href: priorityHref ? `${priorityHref}#score` : undefined,
      cta: "Voir pourquoi il est prioritaire",
      done: scoreSeen,
      icon: GaugeIcon,
    },
    {
      key: "send",
      title: "Préparez votre première relance",
      text: "Choisissez un modèle, relisez, puis ouvrez-la dans Gmail ou copiez-la.",
      href: priorityHref ? `${priorityHref}#relance` : undefined,
      cta: "Préparer ma première relance",
      done: hasSentFollowup,
      icon: SendIcon,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;

  function hide() {
    writeFlag(HIDDEN_KEY);
    setState((previous) => (previous ? { ...previous, hidden: true } : previous));
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      className="mb-6 rounded-2xl border bg-surface p-5 shadow-card sm:p-6"
      aria-labelledby="premiers-pas-title"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="premiers-pas-title" className="text-[16px] leading-6 font-semibold text-foreground">
            {allDone ? "Bravo, vous avez fait le tour de LeadPilot" : "Premiers pas"}
          </h2>
          <p className="mt-0.5 text-dense text-foreground-secondary">
            {allDone
              ? "Revenez chaque matin : le brief vous dira quoi relancer."
              : `${doneCount} sur ${steps.length} · moins de 3 minutes pour voir ce que LeadPilot vous rapporte`}
          </p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label="Masquer le guide"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-tertiary outline-none transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-subtle" aria-hidden>
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary to-accent-violet"
          initial={{ width: 0 }}
          animate={{ width: `${(doneCount / steps.length) * 100}%` }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
        />
      </div>
      <StepList steps={steps} tone="card" />
    </motion.section>
  );
}
