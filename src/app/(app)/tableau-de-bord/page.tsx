import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { daysSince, formatDaysAgo } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import {
  getDailyProgress,
  getDashboardStats,
  getProfil,
  getProspectCounts,
  getRecoverableBySilence,
  getScoreContext,
  getTopOpportunities,
  getWeeklyActivity,
} from "@/lib/data/prospects";
import { explainScore } from "@/lib/scoring/score";
import { displayName } from "@/lib/user/display-name";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.dashboard };
}

// E3 — poste de pilotage : l'argent qui dort, les priorités, la file de relance.
export default async function TableauDeBordPage() {
  const { locale } = await getI18n();
  const [stats, top, profil, silence, weekly, scoreContext, counts, progress] = await Promise.all([
    getDashboardStats(),
    getTopOpportunities(10),
    getProfil(),
    getRecoverableBySilence(),
    getWeeklyActivity(),
    getScoreContext(),
    getProspectCounts(),
    getDailyProgress(),
  ]);

  // Premier passage : l'onboarding commence par l'import (accueil + essai avec un exemple).
  if (stats.nbProspects === 0) redirect("/import");

  const importAge = stats.dernierImportLe ? daysSince(stats.dernierImportLe) : null;
  // Un nom déduit d'une adresse sans séparateur (« jeanmartin ») ne sert pas de prénom.
  const name = displayName(profil?.nom, profil?.email, locale);
  const firstName = name.isFallback && !name.full.includes(" ") ? "" : name.first;

  return (
    <PageContainer className="max-w-[1280px]">
      <DashboardView
        firstName={firstName}
        todayLabel={new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        importLabel={importAge === null ? null : formatDaysAgo(importAge, locale)}
        threshold={profil?.seuil_inactivite_jours ?? 21}
        stats={stats}
        weekly={weekly}
        top={top.map((row) => ({ ...row, explanation: explainScore(row, scoreContext, undefined, locale) }))}
        silence={silence}
        brief={{ toFollowUp: counts.oublies, commissionRate: profil?.taux_commission ?? null, progress }}
      />
    </PageContainer>
  );
}
