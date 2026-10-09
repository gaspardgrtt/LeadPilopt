import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { KanbanBoard } from "@/components/workspace/kanban-board";
import { updateProspectStage } from "@/app/(app)/actions";

import { PreviewShell } from "../shell";
import { workspaceSample } from "../workspace-sample";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu de Mes dossiers" };

// Même vue que /dossiers, avec le jeu d'exemple. Développement uniquement.
export default function DealsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const rows = workspaceSample();
  return (
    <PreviewShell>
      <PageContainer className="max-w-none">
        <PageHeader title="Mes dossiers" description={`${rows.length} dossiers, par étape de l'affaire (aperçu)`} />
        <KanbanBoard rows={rows} onStageChange={updateProspectStage} />
      </PageContainer>
    </PreviewShell>
  );
}
