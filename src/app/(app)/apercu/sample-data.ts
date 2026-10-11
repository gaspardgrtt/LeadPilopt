import type { DealStage, ProspectStatus } from "@/lib/prospects";
import type { Tables } from "@/types/database";

// Données d'exemple des aperçus de développement. Aucune n'est calculée.
export type SampleProspect = {
  id: string;
  company: string;
  contact: string;
  email: string;
  stage: DealStage;
  amount: number;
  lastContact: string;
  silence: number;
  score: number;
  recoverable: number;
  status: ProspectStatus;
};

export const SAMPLE_PROSPECTS: SampleProspect[] = [
  { id: "1", company: "Nordwind GmbH", contact: "Jonas Weber", email: "j.weber@nordwind.de", stage: "negociation", amount: 41700, lastContact: "2026-09-12", silence: 26, score: 91, recoverable: 21400, status: "a_traiter" },
  { id: "2", company: "Atelier Lumen", contact: "Inès Morel", email: "ines@atelier-lumen.fr", stage: "proposition", amount: 31900, lastContact: "2026-08-28", silence: 41, score: 78, recoverable: 9850, status: "relance" },
  { id: "3", company: "Kairos Conseil", contact: "Hugo Lefèvre", email: "hugo@kairos-conseil.fr", stage: "negociation", amount: 20800, lastContact: "2026-08-06", silence: 63, score: 70, recoverable: 8100, status: "a_traiter" },
  { id: "4", company: "Acme SAS", contact: "Claire Martin", email: "claire@acme.fr", stage: "proposition", amount: 15000, lastContact: "2026-09-04", silence: 34, score: 64, recoverable: 4870, status: "a_traiter" },
  { id: "5", company: "Brio Logistique", contact: "Sarah Benali", email: "s.benali@brio.fr", stage: "qualification", amount: 20500, lastContact: "2026-09-16", silence: 22, score: 52, recoverable: 3600, status: "a_traiter" },
];

/** Ligne `prospects` complète à partir d'un prospect d'exemple (aperçus de la fiche et de la liste). */
export function sampleProspectRow(p: SampleProspect, notes: string | null = null): Tables<"prospects"> {
  return {
    id: p.id,
    utilisateur_id: "apercu",
    entreprise: p.company,
    cle_import: null,
    contact_nom: p.contact,
    contact_email: p.email,
    contact_telephone: null,
    montant_eur: p.amount,
    etape: p.stage,
    etape_brute: null,
    date_dernier_contact: p.lastContact,
    notes,
    opposition_prospection_le: null,
    prochaine_action_le: null,
    statut: p.status,
    score: p.score,
    ca_recuperable_eur: p.recoverable,
    proba_recuperation: null,
    est_oublie: true,
    donnees_brutes: {},
    import_id: null,
    importe_le: "2026-10-06T08:00:00Z",
    cree_le: "2026-10-06T08:00:00Z",
    maj_le: "2026-10-06T08:00:00Z",
  };
}
