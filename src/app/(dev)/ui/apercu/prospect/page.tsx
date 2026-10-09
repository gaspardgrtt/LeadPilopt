import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { ProspectView } from "@/app/(app)/prospects/[id]/prospect-view";
import { SAMPLE_FOLLOWUP, SAMPLE_PROSPECTS, sampleProspectRow } from "@/app/(app)/apercu/sample-data";
import { buildScoreContext, explainScore } from "@/lib/scoring/score";

import { PreviewShell } from "../shell";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu de la fiche" };

// Fiche E5 réelle (ProspectView) avec des données d'exemple, sans session. ?relance=1 affiche une
// relance déjà rédigée. Développement uniquement.
export default async function ProspectPreviewPage({ searchParams }: { searchParams: Promise<{ relance?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { relance } = await searchParams;
  const rows = SAMPLE_PROSPECTS.map((p) => sampleProspectRow(p));
  const prospect = sampleProspectRow(SAMPLE_PROSPECTS[0], "Comité d'achat reporté, attend une dernière remise.");
  const context = buildScoreContext(rows, 8000);

  return (
    <PreviewShell>
      <PageContainer>
        <ProspectView
          detail={{
            prospect,
            position: { index: 1, total: 8, previousId: null, nextId: "2" },
            relance: relance
              ? {
                  id: "r1",
                  prospect_id: prospect.id,
                  utilisateur_id: "apercu",
                  objet: SAMPLE_FOLLOWUP.subject,
                  corps: SAMPLE_FOLLOWUP.body,
                  ton: "direct",
                  modele_ia: "claude-opus-5-5",
                  copiee_le: null,
                  cree_le: "2026-10-08T08:00:00Z",
                }
              : null,
          }}
          explanation={explainScore(prospect, context)}
          defaultTone="direct"
        />
      </PageContainer>
    </PreviewShell>
  );
}
