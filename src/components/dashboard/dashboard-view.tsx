import Link from "next/link";
import { ArrowRightIcon, PartyPopperIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/motion";
import type { ProspectRow } from "@/components/shared/prospect-table";
import { SilenceChart } from "@/components/shared/silence-chart";
import { buildMorningBrief } from "@/lib/brief/brief";
import { daysSince, formatInteger } from "@/lib/format";

import { DashboardHero } from "./dashboard-hero";
import { FollowUpQueue } from "./follow-up-queue";
import { MorningBriefPanel } from "./morning-brief-panel";
import { PriorityCards } from "./priority-cards";

// Dashboard E3 « poste de pilotage » : hero (argent qui dort + action principale), les trois
// priorités en cartes, puis la file de relance et la répartition par ancienneté. Le brief du
// matin est une fonctionnalité secondaire, ouverte en panneau latéral.
// Composant de présentation : la page lui passe les données (réelles ou d'exemple pour /ui/apercu).

export type DashboardViewProps = {
  firstName: string;
  todayLabel: string;
  importLabel: string | null;
  threshold: number;
  stats: {
    caRecuperable: number;
    nbOublies: number;
    nbAffairesOuvertes: number;
    caRecupere: number;
  };
  weekly: { generated: number; copied: number };
  top: ProspectRow[];
  silence: { label: string; total: number; count: number }[];
  /** Données du brief du matin (panneau secondaire). */
  brief: {
    /** Opportunités oubliées encore « à traiter ». */
    toFollowUp: number;
    commissionRate: number | null;
    commissionEditable?: boolean;
    progress: { done: number; total: number };
  };
};

export function DashboardView({ firstName, todayLabel, importLabel, threshold, stats, weekly, top, silence, brief }: DashboardViewProps) {
  const priorities = top.slice(0, 3);
  const queue = top.slice(3);

  const first = priorities[0] ?? null;
  const firstExplanation = first?.explanation?.kind === "scored" ? first.explanation : null;
  const morningBrief = buildMorningBrief({
    recoverable: stats.caRecuperable,
    toFollowUp: brief.toFollowUp,
    recovered: stats.caRecupere,
    commissionRate: brief.commissionRate,
    priority: first
      ? {
          id: first.id,
          entreprise: first.entreprise,
          recoverable: firstExplanation?.recoverable ?? first.ca_recuperable_eur ?? 0,
          etape: first.etape,
          silenceDays: first.date_dernier_contact ? daysSince(first.date_dernier_contact) : null,
        }
      : null,
    progress: brief.progress,
  });

  return (
    <>
      <DashboardHero
        firstName={firstName}
        todayLabel={todayLabel}
        importLabel={importLabel}
        caRecuperable={stats.caRecuperable}
        nbOublies={stats.nbOublies}
        nbAffairesOuvertes={stats.nbAffairesOuvertes}
        caRecupere={stats.caRecupere}
        weekly={weekly}
        threshold={threshold}
        startHref={priorities[0] ? `/prospects/${priorities[0].id}` : "/prospects"}
      />

      <section className="mt-14" aria-labelledby="priorites-title">
        <FadeIn delay={0.3} className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="priorites-title" className="text-[20px] leading-7 font-semibold tracking-[-0.02em] text-foreground">
              À relancer en priorité
            </h2>
            <p className="mt-1 text-body text-foreground-secondary">
              Les affaires qui rapportent le plus si vous les relancez aujourd&apos;hui. Le score les compare à votre
              affaire la plus rentable (100).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <MorningBriefPanel
              firstName={firstName}
              todayLabel={todayLabel}
              recoverable={stats.caRecuperable}
              toFollowUp={brief.toFollowUp}
              commissionRate={brief.commissionRate}
              commissionEditable={brief.commissionEditable}
              brief={morningBrief}
              priorities={priorities}
            />
            <Link
              href="/prospects"
              className="group inline-flex items-center gap-1.5 rounded-md text-dense font-semibold text-primary outline-none hover:text-accent-violet focus-visible:ring-[3px] focus-visible:ring-primary/25"
            >
              Voir les {formatInteger(stats.nbOublies)} prospects oubliés
              <ArrowRightIcon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </FadeIn>

        {priorities.length > 0 ? (
          <PriorityCards rows={priorities} />
        ) : (
          <FadeIn delay={0.35}>
            <Card className="items-center px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-success-soft text-success">
                <PartyPopperIcon className="size-6" aria-hidden />
              </span>
              <p className="mt-4 text-[16px] leading-6 font-semibold text-foreground">Aucun prospect oublié</p>
              <p className="mt-1 max-w-sm text-body text-foreground-secondary">
                Tout est traité. Revenez après votre prochain import.
              </p>
            </Card>
          </FadeIn>
        )}
      </section>

      {(queue.length > 0 || stats.caRecuperable > 0) && (
        <section className="mt-12 grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          {queue.length > 0 && (
            <FadeIn delay={0.45} className="min-w-0">
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <CardTitle>File de relance</CardTitle>
                  <CardDescription>Ensuite, par CA récupérable · sans contact depuis plus de {threshold} jours</CardDescription>
                </CardHeader>
                <CardContent className="px-3 pt-2 pb-3">
                  <FollowUpQueue rows={queue} startRank={4} />
                </CardContent>
              </Card>
            </FadeIn>
          )}
          {stats.caRecuperable > 0 && (
            <FadeIn delay={0.55} className={queue.length > 0 ? "min-w-0" : "min-w-0 xl:col-span-2"}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Où dort l&apos;argent</CardTitle>
                  <CardDescription>CA récupérable par ancienneté du dernier contact</CardDescription>
                </CardHeader>
                <CardContent className="pt-5 pb-6">
                  <SilenceChart buckets={silence} />
                  <p className="mt-5 text-dense text-foreground-tertiary">
                    La probabilité de récupération baisse avec le silence : relancez d&apos;abord les plus récents.
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </section>
      )}
    </>
  );
}
