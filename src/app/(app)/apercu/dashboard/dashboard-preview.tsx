"use client";

import { PageContainer } from "@/components/layout/page-container";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { buildScoreContext, explainScore } from "@/lib/scoring/score";

import { SAMPLE_PROSPECTS } from "../sample-data";

// Données d'exemple pour l'aperçu (aucune n'est calculée).
const SAMPLE_BUCKETS = [
  { label: "Moins de 30 j", total: 25000, count: 2 },
  { label: "30 à 59 j", total: 14720, count: 2 },
  { label: "60 à 89 j", total: 8100, count: 1 },
  { label: "90 à 179 j", total: 2190, count: 1 },
  { label: "180 j et plus", total: 0, count: 0 },
];

const EXTRA_QUEUE = [
  { id: "6", entreprise: "Septentrion", contact_nom: "Lucas Petit", etape: "proposition" as const, montant_eur: 12000, date_dernier_contact: "2026-07-02", score: 40, ca_recuperable_eur: 2190, statut: "a_traiter" as const },
  { id: "7", entreprise: "Maison Vélo", contact_nom: "Emma Roux", etape: "decouverte" as const, montant_eur: 18000, date_dernier_contact: "2026-09-08", score: 33, ca_recuperable_eur: 1500, statut: "a_traiter" as const },
  { id: "8", entreprise: "Opaline Studio", contact_nom: "Léa Garnier", etape: "qualification" as const, montant_eur: 6000, date_dernier_contact: "2026-07-25", score: 9, ca_recuperable_eur: 700, statut: "a_traiter" as const },
];

const SAMPLE_TOP = [
  ...SAMPLE_PROSPECTS.map((p) => ({
    id: p.id,
    entreprise: p.company,
    contact_nom: p.contact,
    montant_eur: p.amount,
    etape: p.stage,
    date_dernier_contact: p.lastContact,
    score: p.score,
    ca_recuperable_eur: p.recoverable,
    statut: p.status,
  })),
  ...EXTRA_QUEUE,
];
const SAMPLE_CONTEXT = buildScoreContext(SAMPLE_TOP, 8000);

/** Même vue que E3 (src/components/dashboard/dashboard-view.tsx), avec des données d'exemple. */
export function DashboardPreview() {
  return (
    <PageContainer className="max-w-[1280px]">
      <DashboardView
        firstName="Claire"
        todayLabel={new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        importLabel="importé il y a 2 jours"
        threshold={21}
        stats={{ caRecuperable: 184300, nbOublies: 42, nbAffairesOuvertes: 318, caRecupere: 12000 }}
        weekly={{ generated: 14, copied: 9 }}
        brief={{ toFollowUp: 42, commissionRate: 4, commissionEditable: false, progress: { done: 3, total: 8 } }}
        top={SAMPLE_TOP.map((row) => ({ ...row, explanation: explainScore(row, SAMPLE_CONTEXT) }))}
        silence={SAMPLE_BUCKETS}
      />
    </PageContainer>
  );
}
