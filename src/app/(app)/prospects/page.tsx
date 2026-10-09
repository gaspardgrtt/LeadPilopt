import type { Metadata } from "next";
import Link from "next/link";
import { SearchXIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProspectTable } from "@/components/shared/prospect-table";
import { getProspectCounts, getProspects, type ProspectSort } from "@/lib/data/prospects";
import { formatEuro, formatInteger } from "@/lib/format";
import { isProspectStatus } from "@/lib/prospects";

import { updateProspectStatus } from "../actions";
import { ProspectFilters } from "./prospect-filters";

export const metadata: Metadata = { title: "Prospects" };

const SORTS: ProspectSort[] = ["ca", "score", "montant", "silence", "entreprise"];

type ProspectsPageProps = {
  searchParams: Promise<{ vue?: string; statut?: string; tri?: string }>;
};

// E4 — par défaut : oubliés à traiter, triés par CA récupérable décroissant.
export default async function ProspectsPage({ searchParams }: ProspectsPageProps) {
  const params = await searchParams;
  const view = params.vue === "tous" ? "tous" : "oublies";
  const status = params.statut === "tous" || isProspectStatus(params.statut) ? params.statut : "a_traiter";
  const sort = SORTS.includes(params.tri as ProspectSort) ? (params.tri as ProspectSort) : "ca";

  const [counts, rows] = await Promise.all([
    getProspectCounts(),
    getProspects({ view, statuses: isProspectStatus(status) ? [status] : [], sort }),
  ]);

  if (counts.tous === 0) {
    return (
      <PageContainer>
        <PageHeader title="Prospects" description="Tous vos dossiers, triés par argent récupérable" />
        <EmptyState
          icon={UsersIcon}
          title="Aucun prospect"
          description="Vos prospects apparaîtront ici après votre premier import."
          action={
            <Button asChild>
              <Link href="/import">Importer un fichier</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const total = rows.reduce((sum, row) => sum + (row.ca_recuperable_eur ?? 0), 0);

  return (
    <PageContainer>
      <PageHeader
        title="Prospects"
        description={`${formatInteger(rows.length)} prospect${rows.length > 1 ? "s" : ""} · ${formatEuro(total)} récupérables`}
      />
      <ProspectFilters view={view} status={status} sort={sort} counts={counts} />
      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <ProspectTable rows={rows} onStatusChange={updateProspectStatus} />
        </Card>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title="Aucun prospect ne correspond"
          description="Changez de vue ou de statut pour élargir la liste."
          action={
            <Button asChild variant="secondary">
              <Link href="/prospects">Réinitialiser les filtres</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
