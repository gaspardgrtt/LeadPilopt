import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { ScoreGauge } from "@/components/shared/score-gauge";
import { SilenceDays } from "@/components/shared/silence-days";
import { ScoreExplanationCard } from "@/components/score/score-explanation-card";
import { MarkScoreSeen } from "@/components/onboarding/onboarding";
import { detectFollowupContext, scenarioFromTag } from "@/lib/followups/templates";
import { getBrevoSenderIdentity } from "@/lib/brevo/config";
import type { ProspectDetail } from "@/lib/data/prospects";
import type { ScoreExplanation } from "@/lib/scoring/score";
import { daysSince } from "@/lib/format";
import { getI18n } from "@/i18n/server";
import type { FollowupTone } from "@/lib/prospects";

import { FollowupPanel, OppositionControl, ProspectStatusControl } from "./prospect-actions";

// E5 — vue de la fiche (présentation) : pourquoi ce dossier compte, la relance à envoyer, puis les
// informations. Alimentée par la page (données réelles) et par l'aperçu /ui/apercu/prospect.

const DASH = "—";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-4 sm:py-1.5">
      <dt className="text-dense text-foreground-secondary sm:text-body">{label}</dt>
      <dd className="min-w-0 text-body break-words text-foreground">{children}</dd>
    </div>
  );
}

type ProspectViewProps = {
  detail: ProspectDetail;
  explanation: ScoreExplanation;
  defaultTone: FollowupTone;
};

export async function ProspectView({ detail, explanation, defaultTone }: ProspectViewProps) {
  const { t, locale, format } = await getI18n();
  const { prospect, relance, position } = detail;
  const silence = prospect.date_dernier_contact ? daysSince(prospect.date_dernier_contact) : null;
  const stage = prospect.etape ? t.enums.stage[prospect.etape] : null;
  const shownScore = explanation.kind === "scored" ? explanation.score : prospect.score;
  const followupContext = detectFollowupContext(prospect, undefined, locale);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: t.sheet.prospects, href: "/prospects" }, { label: prospect.entreprise }]}
        backHref="/prospects"
        className="mb-5 sm:mb-8"
      />

      <Card className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <InitialsAvatar name={prospect.contact_nom || prospect.entreprise} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="min-w-0 text-[19px] leading-7 font-semibold tracking-[-0.01em] break-words text-foreground sm:text-[20px]">
                  {prospect.entreprise}
                </h1>
                <ProspectStatusControl prospectId={prospect.id} status={prospect.statut} />
              </div>
              <p className="mt-0.5 text-body text-foreground-secondary">
                {[prospect.contact_nom, stage].filter(Boolean).join(" · ") || DASH}
              </p>
            </div>
          </div>
          {position && (
            <div className="flex w-full items-center justify-between gap-2.5 border-t pt-3 sm:w-auto sm:justify-start sm:border-0 sm:pt-0">
              <span className="mr-1 text-dense text-foreground-tertiary tabular-nums">
                {t.sheet.position(position.index, position.total)}
              </span>
              <span className="flex items-center gap-2">
                <NavButton id={position.previousId} label={t.sheet.previous}>
                  <ArrowUpIcon />
                </NavButton>
                <NavButton id={position.nextId} label={t.sheet.next}>
                  <ArrowDownIcon />
                </NavButton>
              </span>
            </div>
          )}
        </div>

        <div id="score" className="mt-5 scroll-mt-6 sm:mt-6">
          <ScoreExplanationCard explanation={explanation} />
          <MarkScoreSeen />
        </div>

        <div id="relance" className="mt-5 scroll-mt-6">
          <FollowupPanel
            key={relance?.id ?? "aucune"}
            prospectId={prospect.id}
            nextProspectId={position?.nextId ?? null}
            defaultTone={defaultTone}
            contactEmail={prospect.contact_email}
            context={{ recommended: followupContext.scenario, reasons: followupContext.reasons }}
            opposition={prospect.opposition_prospection_le ?? null}
            emailSending={getBrevoSenderIdentity() !== null}
            relance={
              relance
                ? {
                    id: relance.id,
                    objet: relance.objet,
                    corps: relance.corps,
                    ton: relance.ton,
                    scenario: scenarioFromTag(relance.modele_ia),
                    copiee: Boolean(relance.copiee_le),
                    sent:
                      relance.envoi_statut === "envoyee" && relance.envoyee_le && relance.envoyee_a
                        ? { at: relance.envoyee_le, to: relance.envoyee_a }
                        : null,
                  }
                : null
            }
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.45fr_1fr]">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-[15px]">{t.sheet.information}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 sm:pt-3">
              <dl className="divide-y divide-border/60 sm:divide-y-0">
                <InfoRow label={t.sheet.email}>
                  {prospect.contact_email ? (
                    <a href={`mailto:${prospect.contact_email}`} className="hover:underline">
                      {prospect.contact_email}
                    </a>
                  ) : (
                    DASH
                  )}
                </InfoRow>
                <InfoRow label={t.sheet.contact}>{prospect.contact_nom ?? DASH}</InfoRow>
                <InfoRow label={t.sheet.amount}>
                  {prospect.montant_eur === null ? t.sheet.estimatedAmount : format.euro(prospect.montant_eur)}
                </InfoRow>
                <InfoRow label={t.sheet.stage}>{stage ?? prospect.etape_brute ?? DASH}</InfoRow>
                {prospect.notes && (
                  <InfoRow label={t.sheet.notes}>
                    <span className="block rounded-md bg-surface-tinted px-3.5 py-2.5 whitespace-pre-line text-foreground-secondary">
                      {prospect.notes}
                    </span>
                  </InfoRow>
                )}
              </dl>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-[15px]">{t.sheet.status}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 sm:pt-3">
              <dl className="divide-y divide-border/60 sm:divide-y-0">
                <InfoRow label={t.sheet.lastContact}>
                  {prospect.date_dernier_contact ? (
                    <span className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5">
                      {format.date(prospect.date_dernier_contact)}
                      {silence !== null && <SilenceDays days={silence} relative />}
                    </span>
                  ) : (
                    DASH
                  )}
                </InfoRow>
                <InfoRow label={t.sheet.recoverable}>
                  <span className="font-semibold">
                    {prospect.ca_recuperable_eur === null ? DASH : format.euro(prospect.ca_recuperable_eur)}
                  </span>
                </InfoRow>
                <InfoRow label={t.sheet.score}>{shownScore === null ? DASH : <ScoreGauge score={shownScore} />}</InfoRow>
                <InfoRow label={t.sheet.prospecting}>
                  <OppositionControl prospectId={prospect.id} opposition={prospect.opposition_prospection_le ?? null} />
                </InfoRow>
              </dl>
            </CardContent>
          </Card>
        </div>
      </Card>
    </>
  );
}

function NavButton({ id, label, children }: { id: string | null; label: string; children: React.ReactNode }) {
  if (!id) {
    return (
      <Button variant="secondary" size="icon" aria-label={label} disabled>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="secondary" size="icon" aria-label={label} asChild>
      <Link href={`/prospects/${id}`}>{children}</Link>
    </Button>
  );
}
