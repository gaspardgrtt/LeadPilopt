import type { Metadata } from "next";
import Link from "next/link";
import { SearchXIcon, UsersIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProspectTable } from "@/components/shared/prospect-table";
import { getProspectCounts, getProspects, type ProspectSort } from "@/lib/data/prospects";
import { isProspectStatus } from "@/lib/prospects";

import { updateProspectStatus } from "../actions";
import { ProspectFilters } from "./prospect-filters";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.prospects };
}

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

  const [counts, rows, { t, format }] = await Promise.all([
    getProspectCounts(),
    getProspects({ view, statuses: isProspectStatus(status) ? [status] : [], sort }),
    getI18n(),
  ]);

  if (counts.tous === 0) {
    return (
      <PageContainer>
        <PageHeader title={t.meta.titles.prospects} description={t.workspace.prospects.description} />
        <EmptyState
          icon={UsersIcon}
          title={t.workspace.prospects.emptyTitle}
          description={t.workspace.prospects.emptyText}
          action={
            <Button asChild>
              <Link href="/import">{t.workspace.prospects.importFile}</Link>
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
        title={t.meta.titles.prospects}
        description={t.workspace.prospects.summary(format.integer(rows.length), rows.length, format.euro(total))}
      />
      <ProspectFilters view={view} status={status} sort={sort} counts={counts} />
      {rows.length > 0 ? (
        <Card className="overflow-hidden">
          <ProspectTable rows={rows} onStatusChange={updateProspectStatus} />
        </Card>
      ) : (
        <EmptyState
          icon={SearchXIcon}
          title={t.workspace.prospects.noMatchTitle}
          description={t.workspace.prospects.noMatchText}
          action={
            <Button asChild variant="secondary">
              <Link href="/prospects">{t.workspace.prospects.resetFilters}</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
