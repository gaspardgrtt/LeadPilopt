import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { getI18n } from "@/i18n/server";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard } from "@/components/workspace/kanban-board";
import { getProspects } from "@/lib/data/prospects";

import { updateProspectStage } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.titles.deals };
}

// Espace de travail — tous les dossiers du compte en Kanban, par étape de l'affaire.
export default async function DealsPage() {
  const [rows, { t, format }] = await Promise.all([getProspects({ view: "tous", statuses: [], sort: "ca" }), getI18n()]);

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title={t.meta.titles.deals}
        description={
          rows.length > 0
            ? t.workspace.deals.summary(format.integer(rows.length), rows.length)
            : t.workspace.deals.description
        }
      />
      {rows.length > 0 ? (
        <KanbanBoard rows={rows} onStageChange={updateProspectStage} />
      ) : (
        <EmptyState
          icon={DownloadIcon}
          title={t.workspace.deals.emptyTitle}
          description={t.workspace.deals.emptyText}
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
