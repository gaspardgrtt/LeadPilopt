"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CompassIcon, PenLineIcon } from "lucide-react";

import { FollowupBlock, type FollowupState } from "@/components/shared/followup-block";
import { StatusMenu } from "@/components/shared/status-menu";
import { MovingBorderButton } from "@/components/shared/moving-border-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildGmailComposeUrl } from "@/lib/gmail";
import { FOLLOWUP_TONES, STATUS_LABELS, TONE_LABELS, type FollowupTone, type ProspectStatus } from "@/lib/prospects";
import { FOLLOWUP_SCENARIOS, SCENARIO_HINTS, SCENARIO_LABELS, type FollowupScenario } from "@/lib/followups/templates";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { markFollowupCopied, prepareFollowup, saveFollowupDraft, updateProspectStatus } from "../../actions";

/** Badge de statut de la fiche, avec mise à jour optimiste et annulation. */
export function ProspectStatusControl({ prospectId, status }: { prospectId: string; status: ProspectStatus }) {
  const [value, setValue] = React.useState(status);
  React.useEffect(() => setValue(status), [status]);

  async function change(next: ProspectStatus, previous: ProspectStatus = value) {
    setValue(next);
    const result = await updateProspectStatus(prospectId, next);
    if (!result.ok) {
      setValue(previous);
      toast.error(result.message);
      return;
    }
    toast.success(`Statut : ${STATUS_LABELS[next]}`, {
      action: { label: "Annuler", onClick: () => void change(previous, next) },
    });
  }

  return <StatusMenu value={value} onChange={(next) => void change(next)} />;
}

type FollowupRelance = { id: string; objet: string; corps: string; ton: FollowupTone; scenario: FollowupScenario | null };

type FollowupPanelProps = {
  prospectId: string;
  nextProspectId: string | null;
  relance: (FollowupRelance & { copiee: boolean }) | null;
  /** Ton par défaut du compte, utilisé pour la première relance. */
  defaultTone: FollowupTone;
  /** Destinataire du brouillon Gmail. */
  contactEmail: string | null;
  /** Situation détectée d'après le dossier : modèle conseillé et raisons affichées. */
  context: { recommended: FollowupScenario; reasons: string[] };
};

/**
 * Relance de la fiche, à partir de modèles (aucune IA, aucun coût) : choix du modèle et du ton,
 * texte modifiable (enregistré à la sortie du champ), ouverture d'un brouillon Gmail ou copie
 * (horodatées), puis « Marquer comme relancé » et passage au dossier suivant.
 */
export function FollowupPanel({ prospectId, nextProspectId, relance: initialRelance, defaultTone, contactEmail, context }: FollowupPanelProps) {
  const router = useRouter();
  const [relance, setRelance] = React.useState<FollowupRelance | null>(initialRelance);
  const [subject, setSubject] = React.useState(initialRelance?.objet ?? "");
  const [body, setBody] = React.useState(initialRelance?.corps ?? "");
  const [tone, setTone] = React.useState<FollowupTone>(initialRelance?.ton ?? defaultTone);
  const [scenario, setScenario] = React.useState<FollowupScenario>(initialRelance?.scenario ?? context.recommended);
  const [state, setState] = React.useState<FollowupState>("ready");
  const [error, setError] = React.useState<string | null>(null);
  const saved = React.useRef({ subject: initialRelance?.objet ?? "", body: initialRelance?.corps ?? "" });

  async function prepare(nextScenario: FollowupScenario, nextTone: FollowupTone) {
    const previous = { subject, body, edited: state === "edited", scenario, tone };
    setScenario(nextScenario);
    setTone(nextTone);
    setError(null);
    setState("generating");
    const result = await prepareFollowup(prospectId, nextScenario, nextTone);
    if (!result.ok) {
      setScenario(previous.scenario);
      setTone(previous.tone);
      setState(relance ? (previous.edited ? "edited" : "ready") : "error");
      setError(result.message);
      toast.error(result.message);
      return;
    }
    setRelance(result.relance);
    setSubject(result.relance.objet);
    setBody(result.relance.corps);
    saved.current = { subject: result.relance.objet, body: result.relance.corps };
    setState("ready");
    if (previous.edited) {
      // Le texte modifié a été remplacé par le modèle : on laisse la possibilité de le récupérer.
      toast.success("Modèle appliqué", {
        description: "Votre texte modifié a été remplacé.",
        action: {
          label: "Récupérer mon texte",
          onClick: () => {
            setSubject(previous.subject);
            setBody(previous.body);
            setState("edited");
            void saveFollowupDraft(result.relance.id, previous.subject, previous.body).then((saveResult) => {
              if (saveResult.ok) saved.current = { subject: previous.subject, body: previous.body };
            });
          },
        },
      });
    }
  }

  async function persistDraft() {
    if (!relance) return;
    if (subject === saved.current.subject && body === saved.current.body) return;
    const result = await saveFollowupDraft(relance.id, subject, body);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    saved.current = { subject, body };
  }

  async function markFollowedUp() {
    const result = await updateProspectStatus(prospectId, "relance");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (nextProspectId) {
      toast.success("Marqué comme relancé · prospect suivant");
      router.push(`/prospects/${nextProspectId}`);
    } else {
      toast.success("Marqué comme relancé");
    }
  }

  async function copy() {
    if (!relance) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
    } catch {
      toast.error("La copie a été bloquée par le navigateur. Sélectionnez le texte et copiez-le manuellement.");
      return;
    }
    toast.success("Relance copiée", {
      description: "Collez-la dans votre messagerie. Une fois envoyée, marquez le dossier comme relancé.",
      action: { label: "Marquer comme relancé", onClick: () => void markFollowedUp() },
    });
    const [copied] = await Promise.all([markFollowupCopied(relance.id), persistDraft()]);
    if (!copied.ok) toast.error(copied.message);
  }

  async function openInGmail(bodyIncluded: boolean) {
    if (!relance) return;
    if (!bodyIncluded) {
      // Message trop long pour l'URL : il est copié pour être collé dans le brouillon.
      await navigator.clipboard.writeText(body).catch(() => undefined);
    }
    // Gmail est seulement ouvert : rien n'est envoyé tant que l'utilisateur ne l'a pas fait.
    toast.success(bodyIncluded ? "Brouillon ouvert dans Gmail" : "Brouillon ouvert : collez le message copié", {
      description: contactEmail
        ? "Il n'est pas encore envoyé : relisez-le puis envoyez-le depuis Gmail."
        : "Ce prospect n'a pas d'email : ajoutez le destinataire dans Gmail avant d'envoyer.",
      action: { label: "Marquer comme relancé", onClick: () => void markFollowedUp() },
    });
    const [used] = await Promise.all([markFollowupCopied(relance.id), persistDraft()]);
    if (!used.ok) toast.error(used.message);
  }

  const gmail = buildGmailComposeUrl({ to: contactEmail, subject, body });

  if (!relance && state !== "generating") {
    return (
      <section className="relative isolate overflow-hidden rounded-xl border border-primary/15 bg-surface-tinted/80 px-5 py-8 sm:px-8">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-40 w-2/3 -translate-x-1/2 rounded-full bg-accent-violet/10 blur-3xl"
        />
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-violet shadow-[0_8px_24px_-8px_var(--accent-violet)]">
            <PenLineIcon className="size-5 text-white" strokeWidth={2} aria-hidden />
          </span>
          <h3 className="mt-3 text-[15px] leading-6 font-semibold text-foreground">Préparer la relance</h3>
          <p className="mt-1 text-body text-foreground-secondary">
            Un modèle rédigé à l&apos;avance, complété avec les données du dossier (prénom, entreprise, date du dernier
            échange). Vous pourrez le modifier avant de l&apos;ouvrir dans Gmail.
          </p>

          <div className="mt-5 w-full rounded-lg border bg-surface p-4 text-left">
            <p className="flex items-center gap-2 text-dense font-semibold text-foreground">
              <CompassIcon className="size-4 text-primary" aria-hidden />
              Situation détectée
            </p>
            <p className="mt-1 text-dense text-foreground-secondary">{context.reasons.join(" · ")}</p>
            <p className="mt-2 text-dense text-foreground">
              Modèle conseillé : <span className="font-semibold">{SCENARIO_LABELS[context.recommended]}</span>
            </p>
          </div>

          <div className="mt-4 grid w-full gap-3 text-left sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="mb-1.5 text-dense font-medium text-foreground">Modèle</p>
              <Select value={scenario} onValueChange={(value) => setScenario(value as FollowupScenario)}>
                <SelectTrigger className="w-full" aria-label="Modèle de relance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_SCENARIOS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {SCENARIO_LABELS[value]}
                      {value === context.recommended && <span className="text-caption text-success"> · conseillé</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-dense font-medium text-foreground">Ton</p>
              <ToggleGroup type="single" value={tone} onValueChange={(value) => value && setTone(value as FollowupTone)} aria-label="Ton de la relance">
                {FOLLOWUP_TONES.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {TONE_LABELS[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <p className="mt-2 w-full text-left text-caption text-foreground-tertiary">{SCENARIO_HINTS[scenario]}</p>

          {error && (
            <p role="alert" className="mt-4 text-dense text-danger">
              {error}
            </p>
          )}
          <MovingBorderButton className="mt-6" onClick={() => void prepare(scenario, tone)}>
            <PenLineIcon />
            Préparer la relance
          </MovingBorderButton>
        </div>
      </section>
    );
  }

  return (
    <FollowupBlock
      state={state}
      subject={subject}
      body={body}
      tone={tone}
      scenario={scenario}
      recommendedScenario={context.recommended}
      onToneChange={(next) => void prepare(scenario, next)}
      onScenarioChange={(next) => void prepare(next, tone)}
      onRegenerate={() => void prepare(scenario, tone)}
      onSubjectChange={(value) => {
        setSubject(value);
        setState("edited");
      }}
      onBodyChange={(value) => {
        setBody(value);
        setState("edited");
      }}
      onEditEnd={() => void persistDraft()}
      gmailHref={gmail.url}
      onOpenGmail={() => void openInGmail(gmail.bodyIncluded)}
      onCopy={() => void copy()}
      onMarkFollowedUp={() => void markFollowedUp()}
    />
  );
}
