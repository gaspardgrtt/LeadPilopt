"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowRightIcon, ClockIcon, PlusIcon, TrophyIcon, WalletIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, InputWithSuffix } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Logo } from "@/components/brand/logo";
import { AiFollowupBlock, type FollowupState } from "@/components/shared/ai-followup-block";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/field";
import { KpiCard } from "@/components/shared/kpi-card";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { SilenceDays } from "@/components/shared/silence-days";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatusMenu } from "@/components/shared/status-menu";
import { Stepper } from "@/components/shared/stepper";
import { UploadZone } from "@/components/shared/upload-zone";
import { ProspectTable } from "@/components/shared/prospect-table";
import { FollowupPanel } from "@/app/(app)/prospects/[id]/prospect-actions";
import { formatEuro } from "@/lib/format";
import { buildGmailComposeUrl } from "@/lib/gmail";
import { buildScoreContext, explainScore, type ScoringInput } from "@/lib/scoring/score";
import { ScoreExplanationCard } from "@/components/score/score-explanation-card";
import {
  PROSPECT_STATUSES,
  STAGE_LABELS,
  type DealStage,
  type FollowupTone,
  type ProspectStatus,
} from "@/lib/prospects";

// Données d'exemple, uniquement pour visualiser les composants.
const SAMPLE_ROWS: {
  company: string;
  stage: DealStage;
  amount: number;
  silence: number;
  score: number;
  recoverable: number;
  status: ProspectStatus;
}[] = [
  { company: "Nordwind GmbH", stage: "negociation", amount: 41700, silence: 26, score: 91, recoverable: 21400, status: "a_traiter" },
  { company: "Atelier Lumen", stage: "proposition", amount: 31900, silence: 41, score: 78, recoverable: 9850, status: "relance" },
  { company: "Kairos Conseil", stage: "negociation", amount: 20800, silence: 63, score: 70, recoverable: 8100, status: "a_traiter" },
  { company: "Acme SAS", stage: "proposition", amount: 15000, silence: 34, score: 64, recoverable: 4870, status: "gagne" },
  { company: "Opaline Studio", stage: "qualification", amount: 6000, silence: 75, score: 25, recoverable: 700, status: "ignore" },
];

// Compte d'exemple pour « Pourquoi ce score ? » (dates relatives à aujourd'hui).
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const SCORE_SAMPLE: (ScoringInput & { entreprise: string })[] = [
  { entreprise: "Nordwind GmbH", montant_eur: 41700, etape: "negociation", date_dernier_contact: daysAgo(26) },
  { entreprise: "Atelier Lumen", montant_eur: 31900, etape: "proposition", date_dernier_contact: daysAgo(41) },
  { entreprise: "Acme SAS", montant_eur: 15000, etape: "proposition", date_dernier_contact: daysAgo(34) },
  { entreprise: "Brio Logistique", montant_eur: 20500, etape: "qualification", date_dernier_contact: daysAgo(22) },
  { entreprise: "Opaline Studio", montant_eur: 6000, etape: "decouverte", date_dernier_contact: daysAgo(160) },
  { entreprise: "Solenne Bio", montant_eur: 12000, etape: "gagne", date_dernier_contact: daysAgo(90) },
];
const SCORE_CONTEXT = buildScoreContext(SCORE_SAMPLE, 8000);

const SAMPLE_BODY = `Bonjour Claire,

Début septembre, vous attendiez la validation du budget Q4 pour avancer sur notre proposition. Est-ce toujours d'actualité ?

Je peux vous appeler jeudi à 10 h.

Bonne journée,
Paul`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t pt-8">
      <h2 className="text-section text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-12 rounded-md border ${className}`} />
      <span className="font-mono text-caption font-normal text-foreground-secondary">{name}</span>
    </div>
  );
}

export function Catalogue() {
  const [statuses, setStatuses] = React.useState(SAMPLE_ROWS.map((row) => row.status));
  const [selected, setSelected] = React.useState(3);
  const [followupState, setFollowupState] = React.useState<FollowupState>("ready");
  const [tone, setTone] = React.useState<FollowupTone>("direct");
  const [subject, setSubject] = React.useState("Proposition Nimbus · budget Q4");
  const [body, setBody] = React.useState(SAMPLE_BODY);

  return (
    <main className="mx-auto flex max-w-content flex-col gap-10 px-4 py-10 md:px-8">
      <header className="flex items-center justify-between">
        <div>
          <Logo />
          <h1 className="mt-4 text-title text-foreground">Catalogue UI</h1>
          <p className="mt-1 text-body text-foreground-secondary">
            Jetons et composants du design system. Visible en développement uniquement.
          </p>
        </div>
      </header>

      <Section title="Couleurs">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <Swatch name="fond" className="bg-background" />
          <Swatch name="surface" className="bg-surface" />
          <Swatch name="surface-subtle" className="bg-surface-subtle" />
          <Swatch name="border-strong" className="bg-border-strong" />
          <Swatch name="foreground" className="bg-foreground" />
          <Swatch name="primary" className="bg-primary" />
          <Swatch name="primary-soft" className="bg-primary-soft" />
          <Swatch name="success" className="bg-success" />
          <Swatch name="warning" className="bg-warning" />
          <Swatch name="danger" className="bg-danger" />
          <Swatch name="info" className="bg-info" />
          <Swatch name="success-soft" className="bg-success-soft" />
          <Swatch name="warning-soft" className="bg-warning-soft" />
          <Swatch name="danger-soft" className="bg-danger-soft" />
          <Swatch name="info-soft" className="bg-info-soft" />
          <Swatch name="foreground-tertiary" className="bg-foreground-tertiary" />
        </div>
      </Section>

      <Section title="Typographie">
        <div className="flex flex-col gap-3">
          <p className="text-kpi tabular-nums">184 300 €</p>
          <p className="text-title">Titre de page — 24 / 32</p>
          <p className="text-section">Titre de section — 16 / 24</p>
          <p className="text-body">Corps — 14 / 20. Texte courant, champs et boutons.</p>
          <p className="text-dense text-foreground-secondary">Corps dense — 13 / 20. Cellules de tableau.</p>
          <p className="text-overline text-foreground-secondary">Légende en majuscules — 12 / 16</p>
          <p className="font-mono text-dense">Deal stage · Last activity date</p>
        </div>
      </Section>

      <Section title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Fantôme</Button>
          <Button variant="danger">Remplacer les données</Button>
          <Button variant="link">Lien</Button>
          <Button loading>Analyse…</Button>
          <Button disabled>Désactivé</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button shortcut="C">Copier la relance</Button>
          <Button variant="secondary" shortcut="R">Régénérer</Button>
          <Button size="sm">
            <PlusIcon />
            Petit
          </Button>
          <Button size="sm" variant="secondary">
            Petit secondaire
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Suivant">
            <ArrowRightIcon />
          </Button>
        </div>
      </Section>

      <Section title="Champs">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Email professionnel" htmlFor="demo-email" hint="Un lien de connexion vous sera envoyé.">
            <Input id="demo-email" type="email" placeholder="vous@entreprise.fr" />
          </Field>
          <Field label="Email" htmlFor="demo-email-error" error="Cette adresse ne semble pas valide">
            <Input id="demo-email-error" defaultValue="claire@acme" />
          </Field>
          <Field label="Seuil d'oubli" htmlFor="demo-threshold" hint="Au-delà, un prospect est considéré comme oublié.">
            <InputWithSuffix id="demo-threshold" suffix="jours" defaultValue="21" inputMode="numeric" />
          </Field>
          <Field label="Panier moyen" htmlFor="demo-basket" hint="Utilisé quand le montant est vide.">
            <InputWithSuffix id="demo-basket" suffix="€" defaultValue="8 000" inputMode="numeric" />
          </Field>
          <Field label="Signature" htmlFor="demo-signature" className="sm:col-span-2">
            <Textarea id="demo-signature" defaultValue={"Paul Durand · Ventes, Nimbus\n06 12 34 56 78"} />
          </Field>
        </div>
        <ToggleGroup type="single" defaultValue="direct" aria-label="Ton des relances">
          <ToggleGroupItem value="formel">Formel</ToggleGroupItem>
          <ToggleGroupItem value="direct">Direct</ToggleGroupItem>
          <ToggleGroupItem value="chaleureux">Chaleureux</ToggleGroupItem>
        </ToggleGroup>
      </Section>

      <Section title="Statuts, score, silence">
        <div className="flex flex-wrap items-center gap-2">
          {PROSPECT_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <ScoreGauge score={91} />
          <ScoreGauge score={64} />
          <ScoreGauge score={25} />
          <SilenceDays days={34} />
          <SilenceDays days={63} />
        </div>
      </Section>

      <Section title="Cartes KPI">
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            icon={WalletIcon}
            label="Argent récupérable"
            value={formatEuro(184300)}
            explanation="Somme, pour chaque prospect oublié, du montant × poids de l'étape × décote d'ancienneté."
            href="/prospects"
          />
          <KpiCard icon={ClockIcon} tone="warning" tintValue label="Opportunités à relancer" value="42" />
          <KpiCard icon={TrophyIcon} tone="success" tintValue label="Argent récupéré" value={formatEuro(12000)} />
        </div>
      </Section>

      <Section title="Tableau">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle>Dossiers prioritaires</CardTitle>
            <CardAction>
              <Button variant="link" size="sm">
                Voir les 42 prospects
              </Button>
            </CardAction>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="h-9 hover:bg-transparent">
                <TableHead>Entreprise</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead numeric>Montant</TableHead>
                <TableHead numeric>Silence</TableHead>
                <TableHead>Score</TableHead>
                <TableHead numeric>Argent récupérable</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((row, index) => (
                <TableRow
                  key={row.company}
                  data-state={index === selected ? "selected" : undefined}
                  onClick={() => setSelected(index)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium text-foreground">{row.company}</TableCell>
                  <TableCell className="text-foreground-secondary">{STAGE_LABELS[row.stage]}</TableCell>
                  <TableCell numeric className="text-foreground-secondary">
                    {formatEuro(row.amount)}
                  </TableCell>
                  <TableCell numeric>
                    <SilenceDays days={row.silence} />
                  </TableCell>
                  <TableCell>
                    <ScoreGauge score={row.score} />
                  </TableCell>
                  <TableCell numeric className="font-semibold text-foreground">
                    {formatEuro(row.recoverable)}
                  </TableCell>
                  <TableCell>
                    <StatusMenu
                      value={statuses[index]}
                      onChange={(status) => {
                        setStatuses((current) => current.map((value, i) => (i === index ? status : value)));
                        toast("Statut mis à jour", { action: { label: "Annuler", onClick: () => {} } });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section title="Tableau des prospects (E3 et E4)">
        <Card className="overflow-hidden">
          <ProspectTable
            rows={SAMPLE_ROWS.map((row, index) => ({
              id: `demo-${index}`,
              entreprise: row.company,
              contact_nom: null,
              montant_eur: row.amount,
              etape: row.stage,
              date_dernier_contact: new Date(Date.now() - row.silence * 86_400_000).toISOString().slice(0, 10),
              score: row.score,
              ca_recuperable_eur: row.recoverable,
              statut: row.status,
            }))}
            onStatusChange={async () => ({ ok: true })}
          />
        </Card>
      </Section>

      <Section title="Import">
        <Stepper steps={["Fichier", "Colonnes", "Réglages"]} current={1} onStepClick={() => {}} />
        <div className="grid gap-4 md:grid-cols-2">
          <UploadZone />
          <div className="flex flex-col gap-4">
            <UploadZone file={{ name: "export-hubspot.csv", rows: 318 }} onRemove={() => {}} />
            <UploadZone error="Ce fichier n'est pas un CSV valide." />
          </div>
        </div>
      </Section>

      <Section title="Bloc relance IA">
        <ToggleGroup
          type="single"
          size="sm"
          value={followupState}
          onValueChange={(value) => value && setFollowupState(value as FollowupState)}
          aria-label="État du bloc"
        >
          <ToggleGroupItem value="generating">Génération</ToggleGroupItem>
          <ToggleGroupItem value="ready">Prêt</ToggleGroupItem>
          <ToggleGroupItem value="edited">Modifié</ToggleGroupItem>
          <ToggleGroupItem value="error">Erreur</ToggleGroupItem>
        </ToggleGroup>
        <AiFollowupBlock
          className="max-w-xl"
          state={followupState}
          subject={followupState === "generating" ? "" : subject}
          body={followupState === "generating" ? "" : body}
          tone={tone}
          onToneChange={setTone}
          onSubjectChange={(value) => {
            setSubject(value);
            setFollowupState("edited");
          }}
          onBodyChange={(value) => {
            setBody(value);
            setFollowupState("edited");
          }}
          onCopy={() =>
            toast.success("Relance copiée", {
              action: { label: "Marquer comme relancé", onClick: () => {} },
            })
          }
          onRegenerate={() => setFollowupState("generating")}
          gmailHref={buildGmailComposeUrl({ to: "claire@acme.fr", subject, body }).url}
          onOpenGmail={() => toast.success("Brouillon ouvert dans Gmail")}
        />
      </Section>

      <Section title="Pourquoi ce score ?">
        <ScoreExplanationCard
          explanation={explainScore(
            { montant_eur: 41700, etape: "negociation", date_dernier_contact: SCORE_SAMPLE[0].date_dernier_contact },
            SCORE_CONTEXT
          )}
        />
        <ScoreExplanationCard explanation={explainScore(SCORE_SAMPLE[2], SCORE_CONTEXT)} />
        <ScoreExplanationCard explanation={explainScore(SCORE_SAMPLE[5], SCORE_CONTEXT)} />
      </Section>

      <Section title="Relance IA de la fiche (sans relance)">
        <div className="max-w-xl">
          <FollowupPanel
            prospectId="00000000-0000-4000-8000-000000000000"
            nextProspectId={null}
            relance={null}
            defaultTone="direct"
            contactEmail="jonas@nordwind.com"
          />
        </div>
      </Section>

      <Section title="État vide">
        <EmptyState
          icon={WalletIcon}
          title="Aucune donnée pour l'instant"
          description="Importez un export CSV pour voir l'argent qui dort dans vos dossiers."
          action={<Button>Importer un fichier</Button>}
        />
      </Section>
    </main>
  );
}
