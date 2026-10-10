import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { getHistoryCount, getProfil, getProspectCounts } from "@/lib/data/prospects";
import { getI18n } from "@/i18n/server";

import { ImportWizard } from "./import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.import.title };
}

// E2 — fichier, association des colonnes, réglages, puis analyse.
export default async function ImportPage() {
  const [profil, counts, historyCount] = await Promise.all([getProfil(), getProspectCounts(), getHistoryCount()]);

  return (
    <PageContainer className="max-w-[960px]">
      <ImportWizard
        existingCount={counts.tous}
        historyCount={historyCount}
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
