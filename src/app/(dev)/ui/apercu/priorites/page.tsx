import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { PriorityList } from "@/components/workspace/priority-list";
import { updateProspectStatus } from "@/app/(app)/actions";
import { buildScoreContext, explainScore } from "@/lib/scoring/score";

import { PreviewShell } from "../shell";
import { SAMPLE_BASKET, workspaceSample } from "../workspace-sample";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu de Mes priorités" };

// Même vue que /priorites, avec le jeu d'exemple. Développement uniquement.
export default function PrioritiesPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const all = workspaceSample();
  const context = buildScoreContext(all, SAMPLE_BASKET);
  const rows = all.filter((row) => row.est_oublie && row.statut === "a_traiter");
  return (
    <PreviewShell>
      <PageContainer className="max-w-[1180px]">
        <PageHeader title="Mes priorités" description={`${rows.length} dossiers à relancer (aperçu avec le jeu d'exemple)`} />
        <PriorityList rows={rows.map((row) => ({ ...row, explanation: explainScore(row, context) }))} onStatusChange={updateProspectStatus} />
      </PageContainer>
    </PreviewShell>
  );
}
