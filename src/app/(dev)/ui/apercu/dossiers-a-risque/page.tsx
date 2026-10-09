import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { RiskView } from "@/components/workspace/risk-view";
import { analyzeRisk } from "@/lib/risk/risk";

import { PreviewShell } from "../shell";
import { SAMPLE_BASKET, SAMPLE_THRESHOLD, workspaceSample } from "../workspace-sample";

export const metadata: Metadata = { title: "Catalogue UI · Aperçu des dossiers à risque" };

// Même vue que /dossiers-a-risque, avec le jeu d'exemple. Développement uniquement.
export default function RiskPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const analysis = analyzeRisk(workspaceSample(), { threshold: SAMPLE_THRESHOLD, averageBasket: SAMPLE_BASKET });
  return (
    <PreviewShell>
      <PageContainer className="max-w-[1080px]">
        <PageHeader title="Dossiers à risque" description="Ce que vous allez perdre cette semaine si personne ne relance (aperçu)" />
        <RiskView analysis={analysis} threshold={SAMPLE_THRESHOLD} />
      </PageContainer>
    </PreviewShell>
  );
}
