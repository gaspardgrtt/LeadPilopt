"use client";

import { CheckIcon, FileTextIcon, PenLineIcon, RotateCcwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FOLLOWUP_TONES, TONE_LABELS, type FollowupTone } from "@/lib/prospects";
import { FOLLOWUP_SCENARIOS, SCENARIO_LABELS, type FollowupScenario } from "@/lib/followups/templates";
import { Button } from "@/components/ui/button";
import { GmailIcon } from "@/components/brand/gmail-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Bloc relance de la fiche : panneau teinté, message dans un encart blanc modifiable, choix du
// modèle et du ton, actions « Ouvrir dans Gmail », « Copier le message » et « Marquer comme
// relancé ». Composant contrôlé et sans logique : préparation, copie et sauvegarde sont fournies
// par l'appelant.
export type FollowupState = "generating" | "ready" | "edited" | "error";

type FollowupBlockProps = {
  state: FollowupState;
  subject: string;
  body: string;
  tone: FollowupTone;
  scenario?: FollowupScenario;
  /** Modèle conseillé d'après la situation du dossier (signalé dans la liste). */
  recommendedScenario?: FollowupScenario;
  onSubjectChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
  onToneChange?: (tone: FollowupTone) => void;
  onScenarioChange?: (scenario: FollowupScenario) => void;
  onCopy?: () => void;
  /** Revenir au texte du modèle (les modifications sont remplacées). */
  onRegenerate?: () => void;
  onMarkFollowedUp?: () => void;
  /** Appelé quand l'objet ou le message perd le focus (enregistrement des modifications). */
  onEditEnd?: () => void;
  /**
   * Lien de rédaction Gmail pré-rempli. Absent : pas de bouton Gmail ; `null` : bouton désactivé
   * (prospect sans email). Quand il est fourni, « Ouvrir dans Gmail » devient l'action principale.
   */
  gmailHref?: string | null;
  onOpenGmail?: () => void;
  className?: string;
};

export function FollowupBlock({
  state,
  subject,
  body,
  tone,
  scenario,
  recommendedScenario,
  onSubjectChange,
  onBodyChange,
  onToneChange,
  onScenarioChange,
  onCopy,
  onRegenerate,
  onMarkFollowedUp,
  onEditEnd,
  gmailHref,
  onOpenGmail,
  className,
}: FollowupBlockProps) {
  const generating = state === "generating";

  return (
    <section
      aria-label="Relance"
      className={cn(
        "relative isolate rounded-xl border border-primary/15 bg-surface-tinted/80 p-4 shadow-[0_12px_40px_-20px_var(--primary)] backdrop-blur-sm sm:p-5",
        className
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] leading-6 font-semibold text-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-violet shadow-[0_4px_14px_-4px_var(--accent-violet)]">
            <PenLineIcon className="size-4 text-white" strokeWidth={2} aria-hidden />
          </span>
          {generating ? "Préparation…" : "Relance à personnaliser"}
          {state === "edited" && <span className="text-caption font-normal text-foreground-tertiary">· modifiée</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {onScenarioChange && scenario && (
            <Select value={scenario} onValueChange={(value) => onScenarioChange(value as FollowupScenario)} disabled={generating}>
              <SelectTrigger size="sm" className="w-[220px] max-w-full" aria-label="Modèle de relance">
                <span className="text-foreground-tertiary">Modèle</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {FOLLOWUP_SCENARIOS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {SCENARIO_LABELS[value]}
                    {value === recommendedScenario && <span className="text-caption text-success"> · conseillé</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onToneChange ? (
            <Select value={tone} onValueChange={(value) => onToneChange(value as FollowupTone)} disabled={generating}>
              <SelectTrigger size="sm" className="w-[150px]" aria-label="Ton de la relance">
                <span className="text-foreground-tertiary">Ton</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {FOLLOWUP_TONES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {TONE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-dense text-foreground-tertiary">Ton : {TONE_LABELS[tone]}</span>
          )}
          {onRegenerate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={onRegenerate}
                  disabled={generating || state !== "edited"}
                  aria-label="Revenir au texte du modèle"
                >
                  <RotateCcwIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revenir au texte du modèle</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      <div className="relative rounded-lg border bg-surface shadow-xs" aria-busy={generating || undefined}>
        {state === "error" ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-body text-foreground">La relance n&apos;a pas pu être préparée.</p>
            {onRegenerate && (
              <Button variant="secondary" size="sm" onClick={onRegenerate}>
                <RotateCcwIcon />
                Réessayer
              </Button>
            )}
          </div>
        ) : generating && !body ? (
          <div className="flex flex-col gap-2.5 p-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 border-b px-4">
              <span className="text-dense text-foreground-tertiary">Objet</span>
              <input
                value={subject}
                onChange={(event) => onSubjectChange?.(event.target.value)}
                onBlur={onEditEnd}
                readOnly={generating}
                maxLength={300}
                className="h-11 min-w-0 flex-1 bg-transparent text-body font-medium text-foreground outline-none"
              />
            </label>
            <textarea
              aria-label="Message"
              value={body}
              onChange={(event) => onBodyChange?.(event.target.value)}
              onBlur={onEditEnd}
              readOnly={generating}
              maxLength={10000}
              className="block min-h-72 w-full resize-y bg-transparent [field-sizing:content] px-4 py-3.5 text-body leading-[22px] text-foreground outline-none"
            />
          </>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap items-center gap-2.5">
        {gmailHref !== undefined &&
          (gmailHref && !generating && state !== "error" ? (
            <Button asChild>
              <a href={gmailHref} target="_blank" rel="noopener noreferrer" onClick={onOpenGmail}>
                <span className="flex size-5 items-center justify-center rounded-[5px] bg-white shadow-xs">
                  <GmailIcon className="size-3.5" />
                </span>
                Ouvrir dans Gmail
              </a>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={gmailHref ? -1 : 0} className="inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25">
                  <Button disabled>
                    <span className="flex size-5 items-center justify-center rounded-[5px] bg-white shadow-xs">
                      <GmailIcon className="size-3.5" />
                    </span>
                    Ouvrir dans Gmail
                  </Button>
                </span>
              </TooltipTrigger>
              {!gmailHref && <TooltipContent>Aucun email pour ce prospect : copiez le message.</TooltipContent>}
            </Tooltip>
          ))}
        <Button variant={gmailHref !== undefined ? "secondary" : "primary"} onClick={onCopy} disabled={generating || state === "error"}>
          <FileTextIcon />
          Copier le message
        </Button>
        {onMarkFollowedUp && (
          <Button variant="secondary" onClick={onMarkFollowedUp} disabled={generating}>
            <CheckIcon />
            Marquer comme relancé
          </Button>
        )}
      </footer>
      {gmailHref !== undefined && (
        <p className="mt-3 text-caption text-foreground-tertiary">
          Gmail s&apos;ouvre avec un brouillon prérempli : relisez-le et envoyez-le depuis Gmail. LeadPilot n&apos;envoie rien à
          votre place.
        </p>
      )}
    </section>
  );
}
