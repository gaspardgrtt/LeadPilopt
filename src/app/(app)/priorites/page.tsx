import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckIcon, DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityList } from "@/components/workspace/priority-list";
import { getProspectCounts, getProspects, getScoreContext } from "@/lib/data/prospects";
import { formatEuro, formatInteger } from "@/lib/format";
import { explainScore } from "@/lib/scoring/score";

import { updateProspectStatus } from "../actions";

export const metadata: Metadata = { title: "Mes priorités" };

// Espace de travail — dossiers oubliés à traiter, par argent récupérable, avec leur explication.
export default async function PrioritiesPage() {
  const [counts, rows, scoreContext] = await Promise.all([
    getProspectCounts(),
    getProspects({ view: "oublies", statuses: ["a_traiter"], sort: "ca" }),
    getScoreContext(),
  ]);

  if (counts.tous === 0) {
    return (
      <PageContainer>
        <PageHeader title="Mes priorités" description="Les dossiers à relancer en premier" />
        <EmptyState
          icon={DownloadIcon}
          title="Importez vos dossiers pour commencer"
          description="LeadPilot classera vos dossiers oubliés par argent récupérable et vous dira pourquoi."
          action={
            <Button asChild>
              <Link href="/import">Importer mes données</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const total = rows.reduce((sum, row) => sum + (row.ca_recuperable_eur ?? 0), 0);

  return (
    <PageContainer className="max-w-[1180px]">
      <PageHeader
        title="Mes priorités"
        description={
          rows.length > 0
            ? `${formatInteger(rows.length)} dossier${rows.length > 1 ? "s" : ""} à relancer · ${formatEuro(total)} récupérables, du plus rentable au moins rentable`
            : "Les dossiers à relancer en premier"
        }
      />
      {rows.length > 0 ? (
        <PriorityList
          rows={rows.map((row) => ({ ...row, explanation: explainScore(row, scoreContext) }))}
          onStatusChange={updateProspectStatus}
        />
      ) : (
        <EmptyState
          icon={CircleCheckIcon}
          title="Aucun dossier à relancer"
          description="Tous vos dossiers oubliés ont été traités. Les prochains apparaîtront ici dès qu'un dossier dépasse votre seuil d'inactivité."
          action={
            <Button asChild variant="secondary">
              <Link href="/dossiers">Voir mes dossiers</Link>
            </Button>
          }
        />
      )}
    </PageContainer>
  );
}
