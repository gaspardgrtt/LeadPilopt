import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { ImportWizard } from "@/app/(app)/import/import-wizard";

export const metadata: Metadata = { title: "Catalogue UI · Assistant d'import" };

// Assistant d'import sans session, pour vérifier les étapes 1 et 2 (lecture et colonnes),
// qui se déroulent entièrement dans le navigateur. Le lancement de l'analyse exige une connexion.
export default function ImportWizardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <PageContainer className="max-w-[960px]">
      <ImportWizard existingCount={8} historyCount={12} defaults={{ seuil: 21, panier: null, ton: "direct", signature: "", commission: null }} />
    </PageContainer>
  );
}
