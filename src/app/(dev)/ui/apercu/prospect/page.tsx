import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/i18n/server";

import { PageContainer } from "@/components/layout/page-container";
import { ProspectView } from "@/app/(app)/prospects/[id]/prospect-view";
import { SAMPLE_PROSPECTS, sampleProspectRow } from "@/app/(app)/apercu/sample-data";
import { detectFollowupContext, renderFollowup, scenarioTag } from "@/lib/followups/templates";
import { buildScoreContext, explainScore } from "@/lib/scoring/score";

import { PreviewShell } from "../shell";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu de la fiche" };

// Fiche E5 réelle (ProspectView) avec des données d'exemple, sans session. ?relance=1 affiche une
// relance déjà préparée. Développement uniquement.
export default async function ProspectPreviewPage({ searchParams }: { searchParams: Promise<{ relance?: string }> }) {
  const { locale } = await getI18n();
  if (process.env.NODE_ENV === "production") notFound();
  const { relance } = await searchParams;
  const rows = SAMPLE_PROSPECTS.map((p) => sampleProspectRow(p));
  const prospect = sampleProspectRow(SAMPLE_PROSPECTS[0], "Comité d'achat reporté, attend une dernière remise.");
  const context = buildScoreContext(rows, 8000);
  const scenario = detectFollowupContext(prospect).scenario;
  const followup = renderFollowup(prospect, scenario, "direct", { signature: "Paul Durand\nAgence Dupont", nom: null });

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
                  objet: followup.objet,
                  corps: followup.corps,
                  ton: "direct",
                  modele_ia: scenarioTag(scenario),
                  copiee_le: null,
                  envoi_statut: null,
                  envoi_demande_le: null,
                  envoyee_le: null,
                  envoyee_a: null,
                  brevo_message_id: null,
                  envoi_erreur: null,
                  cree_le: "2026-10-08T08:00:00Z",
                }
              : null,
          }}
          explanation={explainScore(prospect, context, undefined, locale)}
          defaultTone="direct"
        />
      </PageContainer>
    </PreviewShell>
  );
}
