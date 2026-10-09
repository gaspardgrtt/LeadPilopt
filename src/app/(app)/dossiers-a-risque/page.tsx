import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskView } from "@/components/workspace/risk-view";
import { getProfil, getProspects } from "@/lib/data/prospects";
import { analyzeRisk } from "@/lib/risk/risk";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.risk };
}

// Espace de travail — dossiers bientôt oubliés et dossiers oubliés qui perdent de la valeur.
export default async function RiskPage() {
  const [rows, profil] = await Promise.all([getProspects({ view: "tous", statuses: [], sort: "ca" }), getProfil()]);
  const threshold = profil?.seuil_inactivite_jours ?? 21;
  const { t } = await getI18n();

  return (
    <PageContainer className="max-w-[1080px]">
      <PageHeader title={t.meta.titles.risk} description={t.workspace.risk.description} />
      {rows.length > 0 ? (
        <RiskView analysis={analyzeRisk(rows, { threshold, averageBasket: profil?.panier_moyen_eur ?? null })} threshold={threshold} />
      ) : (
        <EmptyState
          icon={DownloadIcon}
          title={t.workspace.risk.emptyTitle}
          description={t.workspace.risk.emptyText}
          action={
            <Button asChild>
              <Link href="/import">{t.common.importData}</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
