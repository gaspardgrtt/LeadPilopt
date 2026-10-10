import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckIcon, DownloadIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityList } from "@/components/workspace/priority-list";
import { getNextActions, getProspectCounts, getProspects, getScoreContext } from "@/lib/data/prospects";
import { NextActions } from "@/components/workspace/next-actions";
import { explainScore } from "@/lib/scoring/score";

import { updateProspectStatus } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.priorities };
}

// Espace de travail — dossiers oubliés à traiter, par argent récupérable, avec leur explication.
export default async function PrioritiesPage() {
  const [counts, rows, scoreContext, nextActions] = await Promise.all([
    getProspectCounts(),
    getProspects({ view: "oublies", statuses: ["a_traiter"], sort: "ca" }),
    getScoreContext(),
    getNextActions(),
  ]);
  const { t, locale, format } = await getI18n();

  if (counts.tous === 0) {
    return (
      <PageContainer>
        <PageHeader title={t.meta.titles.priorities} description={t.workspace.priorities.description} />
        <EmptyState
          icon={DownloadIcon}
          title={t.workspace.priorities.emptyImportTitle}
          description={t.workspace.priorities.emptyImportText}
          action={
            <Button asChild>
              <Link href="/import">{t.common.importData}</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const total = rows.reduce((sum, row) => sum + (row.ca_recuperable_eur ?? 0), 0);

  return (
    <PageContainer className="max-w-[1180px]">
      <PageHeader
        title={t.meta.titles.priorities}
        description={
          rows.length > 0
            ? t.workspace.priorities.summary(format.integer(rows.length), rows.length, format.euro(total))
            : t.workspace.priorities.description
        }
      />
      <NextActions items={nextActions} />
      {rows.length > 0 ? (
        <PriorityList
          rows={rows.map((row) => ({ ...row, explanation: explainScore(row, scoreContext, undefined, locale) }))}
          onStatusChange={updateProspectStatus}
        />
      ) : (
        <EmptyState
          icon={CircleCheckIcon}
          title={t.workspace.priorities.emptyTitle}
          description={t.workspace.priorities.emptyText}
          action={
            <Button asChild variant="secondary">
              <Link href="/dossiers">{t.workspace.priorities.seeDeals}</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
