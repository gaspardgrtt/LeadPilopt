import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { daysSince, formatDaysAgo } from "@/lib/format";
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

export const metadata: Metadata = { title: "Dashboard" };

// E3 — poste de pilotage : l'argent qui dort, les priorités, la file de relance.
export default async function TableauDeBordPage() {
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
  const displayName = profil?.nom?.trim() || profil?.email?.split("@")[0] || "";
  const firstName = displayName ? displayName.split(/[\s._-]+/)[0].replace(/^./, (c) => c.toUpperCase()) : "";

  return (
    <PageContainer className="max-w-[1280px]">
      <DashboardView
        firstName={firstName}
        todayLabel={new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        importLabel={importAge === null ? null : `importé ${formatDaysAgo(importAge)}`}
        threshold={profil?.seuil_inactivite_jours ?? 21}
        stats={stats}
        weekly={weekly}
        top={top.map((row) => ({ ...row, explanation: explainScore(row, scoreContext) }))}
        silence={silence}
        brief={{ toFollowUp: counts.oublies, commissionRate: profil?.taux_commission ?? null, progress }}
      />
    </PageContainer>
  );
}
