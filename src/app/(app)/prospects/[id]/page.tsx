import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { getProfil, getProspectDetail, getScoreContext } from "@/lib/data/prospects";
import { explainScore } from "@/lib/scoring/score";

import { ProspectView } from "./prospect-view";

export const metadata: Metadata = { title: "Fiche prospect" };

type ProspectPageProps = { params: Promise<{ id: string }> };

// E5 — pourquoi ce prospect compte, et la relance à envoyer.
export default async function ProspectPage({ params }: ProspectPageProps) {
  const { id } = await params;
  const [detail, profil, scoreContext] = await Promise.all([getProspectDetail(id), getProfil(), getScoreContext()]);
  if (!detail) notFound();

  return (
    <PageContainer>
      <ProspectView
        detail={detail}
        explanation={explainScore(detail.prospect, scoreContext)}
        defaultTone={profil?.ton_relance ?? "direct"}
      />
    </PageContainer>
  );
}
