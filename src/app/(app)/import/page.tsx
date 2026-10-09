import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { getProfil, getProspectCounts } from "@/lib/data/prospects";

import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Importer des prospects" };

// E2 — fichier, association des colonnes, réglages, puis analyse.
export default async function ImportPage() {
  const [profil, counts] = await Promise.all([getProfil(), getProspectCounts()]);

  return (
    <PageContainer className="max-w-[960px]">
      <ImportWizard
        existingCount={counts.tous}
        defaults={{
          seuil: profil?.seuil_inactivite_jours ?? 21,
          panier: profil?.panier_moyen_eur ?? null,
          ton: profil?.ton_relance ?? "direct",
          signature: profil?.signature ?? "",
          commission: profil?.taux_commission ?? null,
        }}
      />
    </PageContainer>
  );
}
