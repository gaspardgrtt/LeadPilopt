import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskView } from "@/components/workspace/risk-view";
import { getProfil, getProspects } from "@/lib/data/prospects";
import { analyzeRisk } from "@/lib/risk/risk";

export const metadata: Metadata = { title: "Dossiers à risque" };

// Espace de travail — dossiers bientôt oubliés et dossiers oubliés qui perdent de la valeur.
export default async function RiskPage() {
  const [rows, profil] = await Promise.all([getProspects({ view: "tous", statuses: [], sort: "ca" }), getProfil()]);
  const threshold = profil?.seuil_inactivite_jours ?? 21;

  return (
    <PageContainer className="max-w-[1080px]">
      <PageHeader title="Dossiers à risque" description="Ce que vous allez perdre cette semaine si personne ne relance" />
      {rows.length > 0 ? (
        <RiskView analysis={analyzeRisk(rows, { threshold, averageBasket: profil?.panier_moyen_eur ?? null })} threshold={threshold} />
      ) : (
        <EmptyState
          icon={DownloadIcon}
          title="Aucun dossier pour l'instant"
          description="Importez vos dossiers : LeadPilot repérera ceux qui risquent d'être oubliés."
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
