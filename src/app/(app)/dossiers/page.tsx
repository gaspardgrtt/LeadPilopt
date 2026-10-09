import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard } from "@/components/workspace/kanban-board";
import { getProspects } from "@/lib/data/prospects";
import { formatInteger } from "@/lib/format";

import { updateProspectStage } from "../actions";

export const metadata: Metadata = { title: "Mes dossiers" };

// Espace de travail — tous les dossiers du compte en Kanban, par étape de l'affaire.
export default async function DealsPage() {
  const rows = await getProspects({ view: "tous", statuses: [], sort: "ca" });

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        title="Mes dossiers"
        description={
          rows.length > 0
            ? `${formatInteger(rows.length)} dossier${rows.length > 1 ? "s" : ""}, par étape de l'affaire`
            : "Vos dossiers, par étape de l'affaire"
        }
      />
      {rows.length > 0 ? (
        <KanbanBoard rows={rows} onStageChange={updateProspectStage} />
      ) : (
        <EmptyState
          icon={DownloadIcon}
          title="Aucun dossier pour l'instant"
          description="Importez un export CSV : vos dossiers apparaîtront ici, rangés par étape."
          action={
            <Button asChild>
              <Link href="/import">Importer mes données</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
