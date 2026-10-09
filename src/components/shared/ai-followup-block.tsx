"use client";

import { CheckIcon, FileTextIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FOLLOWUP_TONES, TONE_LABELS, type FollowupTone } from "@/lib/prospects";
import { Button } from "@/components/ui/button";
import { GmailIcon } from "@/components/brand/gmail-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Bloc « Relance générée par l'IA » de la maquette : panneau teinté, icône étincelle violette,
// message dans un encart blanc, actions « Copier le message » et « Marquer comme relancé ».
// Composant contrôlé et sans logique : génération, copie et sauvegarde sont fournies par l'appelant.
export type FollowupState = "generating" | "ready" | "edited" | "error";

type AiFollowupBlockProps = {
  state: FollowupState;
  subject: string;
  body: string;
  tone: FollowupTone;
  onSubjectChange?: (value: string) => void;
  onBodyChange?: (value: string) => void;
  onToneChange?: (tone: FollowupTone) => void;
  onCopy?: () => void;
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

export function AiFollowupBlock({
  state,
  subject,
  body,
  tone,
  onSubjectChange,
  onBodyChange,
  onToneChange,
  onCopy,
  onRegenerate,
  onMarkFollowedUp,
  onEditEnd,
  gmailHref,
  onOpenGmail,
  className,
}: AiFollowupBlockProps) {
  const generating = state === "generating";

  return (
    <section
      aria-label="Relance générée par l'IA"
      className={cn(
        "relative isolate rounded-xl border border-primary/15 bg-surface-tinted/80 p-5 shadow-[0_12px_40px_-20px_var(--primary)] backdrop-blur-sm",
        className
      )}
    >
      {/* Liseré lumineux en dégradé et halo discret : identité « IA » du bloc. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -top-px h-px bg-gradient-to-r from-transparent via-accent-violet/70 to-transparent"
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-10 left-1/2 -z-10 h-24 w-2/3 -translate-x-1/2 rounded-full bg-accent-violet/15 blur-3xl transition-opacity duration-500",
          generating ? "opacity-100" : "opacity-50"
        )}
      />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 text-[15px] leading-6 font-semibold whitespace-nowrap text-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-violet shadow-[0_4px_14px_-4px_var(--accent-violet)]">
            <SparklesIcon className={cn("size-4 text-white", generating && "animate-pulse")} strokeWidth={2} aria-hidden />
          </span>
          <span className={cn("text-ai-gradient", generating && "animate-ai-shimmer")}>
            {generating ? "Rédaction en cours…" : "Relance générée par l'IA"}
          </span>
          {state === "edited" && (
            <span className="text-caption font-normal text-foreground-tertiary">· modifiée</span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {onToneChange ? (
            <Select
              value={tone}
              onValueChange={(value) => onToneChange(value as FollowupTone)}
              disabled={generating}
            >
              <SelectTrigger size="sm" className="w-[132px]" aria-label="Ton de la relance">
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
                  disabled={generating}
                  aria-label="Régénérer la relance (R)"
                >
                  <RefreshCwIcon className={cn(generating && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Régénérer · R</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      <div className="relative rounded-lg border bg-surface shadow-xs" aria-busy={generating || undefined}>
        {state === "error" ? (
          <div className="flex flex-col items-start gap-3 p-4">
            <p className="text-body text-foreground">La rédaction a échoué.</p>
            {onRegenerate && (
              <Button variant="secondary" size="sm" onClick={onRegenerate}>
                <RefreshCwIcon />
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
                className="h-11 min-w-0 flex-1 bg-transparent text-body font-medium text-foreground outline-none"
              />
            </label>
            {generating && (
              <span aria-hidden className="pointer-events-none absolute right-4 bottom-3 h-4 w-0.5 animate-caret rounded-full bg-primary" />
            )}
            <textarea
              aria-label="Message"
              value={body}
              onChange={(event) => onBodyChange?.(event.target.value)}
              onBlur={onEditEnd}
              readOnly={generating}
              className="block min-h-60 w-full resize-y bg-transparent px-4 py-3.5 text-body leading-[22px] text-foreground outline-none"
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
        <Button
          variant={gmailHref !== undefined ? "secondary" : "primary"}
          onClick={onCopy}
          disabled={generating || state === "error"}
        >
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
    </section>
  );
}
