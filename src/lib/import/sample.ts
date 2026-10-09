// Jeu de données d'exemple de l'onboarding (« Essayer avec un exemple ») : un export CRM réaliste,
// dont les dates sont calculées par rapport à aujourd'hui pour que le brief reste parlant quel que
// soit le jour. Il passe par le même assistant d'import qu'un vrai fichier.

type SampleRow = {
  entreprise: string;
  contact: string;
  email: string;
  montant: number;
  joursSansContact: number;
  statut: string;
  notes: string;
};

const ROWS: SampleRow[] = [
  { entreprise: "Nordwind GmbH", contact: "Jonas Weber", email: "j.weber@nordwind.de", montant: 41700, joursSansContact: 26, statut: "Négociation", notes: "Comité d'achat reporté, attend une dernière remise" },
  { entreprise: "Atelier Lumen", contact: "Inès Morel", email: "ines@atelier-lumen.fr", montant: 31900, joursSansContact: 41, statut: "Proposition envoyée", notes: "A trouvé la proposition claire, doit en parler à son associé" },
  { entreprise: "Kairos Conseil", contact: "Hugo Lefèvre", email: "hugo@kairos-conseil.fr", montant: 20800, joursSansContact: 63, statut: "Négociation", notes: "Bloqué sur le calendrier de démarrage" },
  { entreprise: "Acme SAS", contact: "Claire Martin", email: "claire@acme.fr", montant: 15000, joursSansContact: 34, statut: "Proposition envoyée", notes: "Attend la validation du budget du trimestre" },
  { entreprise: "Brio Logistique", contact: "Sarah Benali", email: "s.benali@brio.fr", montant: 20500, joursSansContact: 22, statut: "Qualifié", notes: "Rappeler après le salon" },
  { entreprise: "Septentrion", contact: "Lucas Petit", email: "lucas.petit@septentrion.fr", montant: 12000, joursSansContact: 98, statut: "Proposition envoyée", notes: "" },
  { entreprise: "Maison Vélo", contact: "Emma Roux", email: "emma@maisonvelo.fr", montant: 18000, joursSansContact: 30, statut: "Découverte", notes: "Premier rendez-vous très positif" },
  { entreprise: "Opaline Studio", contact: "Léa Garnier", email: "lea@opaline.studio", montant: 6000, joursSansContact: 75, statut: "Qualifié", notes: "" },
  { entreprise: "Groupe Arcadie", contact: "Thomas Girard", email: "t.girard@arcadie.fr", montant: 27500, joursSansContact: 48, statut: "Proposition envoyée", notes: "Demande une référence client du même secteur" },
  { entreprise: "Verdure & Co", contact: "Camille Faure", email: "camille@verdure.co", montant: 9400, joursSansContact: 140, statut: "Découverte", notes: "" },
  { entreprise: "Halo Santé", contact: "Nadia Chevalier", email: "n.chevalier@halo-sante.fr", montant: 23600, joursSansContact: 12, statut: "Négociation", notes: "Échange en cours, pas encore oublié" },
  { entreprise: "Fjord Design", contact: "Antoine Mercier", email: "antoine@fjord.design", montant: 14200, joursSansContact: 5, statut: "Proposition envoyée", notes: "Proposition envoyée cette semaine" },
  { entreprise: "Solenne Bio", contact: "Anaïs Roux", email: "anais@solenne-bio.fr", montant: 12000, joursSansContact: 54, statut: "Gagné", notes: "Contrat signé" },
  { entreprise: "Cobalt Énergie", contact: "Marc Dubois", email: "marc.dubois@cobalt-energie.fr", montant: 38000, joursSansContact: 70, statut: "Perdu", notes: "A choisi un concurrent" },
];

const pad = (value: number) => String(value).padStart(2, "0");

function frenchDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const SAMPLE_FILE_NAME = "exemple-leadpilot.csv";

/** Contenu CSV du jeu d'exemple, dates relatives à `today`. */
export function buildSampleCsv(today: Date = new Date()): string {
  const header = "entreprise,contact,email,téléphone,montant,date dernier contact,statut,notes";
  const lines = ROWS.map((row) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - row.joursSansContact);
    return [row.entreprise, row.contact, row.email, "", String(row.montant), frenchDate(date), row.statut, row.notes]
      .map(quote)
      .join(",");
  });
  return [header, ...lines].join("\n") + "\n";
}
