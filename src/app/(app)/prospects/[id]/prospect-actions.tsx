"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SparklesIcon } from "lucide-react";

import { AiFollowupBlock, type FollowupState } from "@/components/shared/ai-followup-block";
import { StatusMenu } from "@/components/shared/status-menu";
import { MovingBorderButton } from "@/components/shared/moving-border-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parseFollowupText, type FollowupStreamEvent } from "@/lib/ai/followup-format";
import { buildGmailComposeUrl } from "@/lib/gmail";
import { FOLLOWUP_TONES, STATUS_LABELS, TONE_LABELS, type FollowupTone, type ProspectStatus } from "@/lib/prospects";

import { markFollowupCopied, saveFollowupDraft, updateProspectStatus } from "../../actions";

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

type FollowupRelance = { id: string; objet: string; corps: string; ton: FollowupTone };

type FollowupPanelProps = {
  prospectId: string;
  nextProspectId: string | null;
  relance: (FollowupRelance & { copiee: boolean }) | null;
  /** Ton par défaut du compte, utilisé pour la première génération. */
  defaultTone: FollowupTone;
  /** Destinataire du brouillon Gmail. */
  contactEmail: string | null;
};

/** Lit le flux NDJSON de /api/relances/generer et rend chaque événement. */
async function* readFollowupStream(response: Response): AsyncGenerator<FollowupStreamEvent> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as FollowupStreamEvent;
      newline = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as FollowupStreamEvent;
}

/**
 * Relance de la fiche : génération par Claude en streaming (ton au choix, régénération),
 * copie dans le presse-papiers (horodatée), enregistrement des modifications à la sortie du
 * champ, « Marquer comme relancé » puis passage au suivant.
 */
export function FollowupPanel({ prospectId, nextProspectId, relance: initialRelance, defaultTone, contactEmail }: FollowupPanelProps) {
  const router = useRouter();
  const [relance, setRelance] = React.useState<FollowupRelance | null>(initialRelance);
  const [subject, setSubject] = React.useState(initialRelance?.objet ?? "");
  const [body, setBody] = React.useState(initialRelance?.corps ?? "");
  const [tone, setTone] = React.useState<FollowupTone>(initialRelance?.ton ?? defaultTone);
  const [state, setState] = React.useState<FollowupState>("ready");
  const [generationError, setGenerationError] = React.useState<string | null>(null);
  const saved = React.useRef({ subject: initialRelance?.objet ?? "", body: initialRelance?.corps ?? "" });
  const abortRef = React.useRef<AbortController | null>(null);

  // Arrête une génération en cours si l'utilisateur quitte la fiche.
  React.useEffect(() => () => abortRef.current?.abort(), []);

  async function generate(nextTone: FollowupTone) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const previous = { relance, subject, body };
    setTone(nextTone);
    setGenerationError(null);
    setState("generating");
    setSubject("");
    setBody("");

    const restore = (message: string) => {
      setRelance(previous.relance);
      setSubject(previous.subject);
      setBody(previous.body);
      setState(previous.relance ? "ready" : "error");
      setGenerationError(message);
      toast.error(message);
    };

    try {
      const response = await fetch("/api/relances/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId, ton: nextTone }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        restore(payload?.message ?? "La rédaction a échoué. Réessayez.");
        return;
      }

      let text = "";
      for await (const event of readFollowupStream(response)) {
        if (event.type === "delta") {
          text += event.text;
          const parsed = parseFollowupText(text, "");
          setSubject(parsed.objet);
          setBody(parsed.corps);
        } else if (event.type === "done") {
          setRelance(event.relance);
          setSubject(event.relance.objet);
          setBody(event.relance.corps);
          saved.current = { subject: event.relance.objet, body: event.relance.corps };
          setState("ready");
          router.refresh();
          return;
        } else {
          restore(event.message);
          return;
        }
      }
      restore("La rédaction a été interrompue. Réessayez.");
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error(error);
      restore("La connexion a été interrompue pendant la rédaction. Réessayez.");
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
    toast.success(bodyIncluded ? "Brouillon ouvert dans Gmail" : "Brouillon ouvert : collez le message copié", {
      description: contactEmail ? "Relisez puis envoyez depuis Gmail." : "Ce prospect n'a pas d'email : ajoutez le destinataire dans Gmail.",
      action: { label: "Marquer comme relancé", onClick: () => void markFollowedUp() },
    });
    const [used] = await Promise.all([markFollowupCopied(relance.id), persistDraft()]);
    if (!used.ok) toast.error(used.message);
  }

  const gmail = buildGmailComposeUrl({ to: contactEmail, subject, body });

  if (!relance && state !== "generating") {
    return (
      <section className="relative isolate flex flex-col items-center justify-center overflow-hidden rounded-xl border border-primary/15 bg-surface-tinted/80 px-6 py-12 text-center">
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/2 -z-10 h-40 w-2/3 -translate-x-1/2 rounded-full bg-accent-violet/15 blur-3xl"
        />
        <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-violet shadow-[0_8px_24px_-8px_var(--accent-violet)]">
          <SparklesIcon className="size-5 text-white" strokeWidth={2} aria-hidden />
        </span>
        <h3 className="mt-3 text-[15px] leading-6 font-semibold text-foreground">Aucune relance pour ce prospect</h3>
        <p className="mt-1 max-w-sm text-body text-foreground-secondary">
          Claude rédige une relance à partir des notes, de l&apos;étape et de l&apos;ancienneté du dernier échange.
        </p>
        <ToggleGroup
          type="single"
          value={tone}
          onValueChange={(value) => value && setTone(value as FollowupTone)}
          aria-label="Ton de la relance"
          className="mt-5"
        >
          {FOLLOWUP_TONES.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {TONE_LABELS[value]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {generationError && (
          <p role="alert" className="mt-4 max-w-sm text-dense text-danger">
            {generationError}
          </p>
        )}
        <MovingBorderButton className="mt-6" onClick={() => void generate(tone)}>
          <SparklesIcon />
          Générer une relance IA
        </MovingBorderButton>
      </section>
    );
  }

  return (
    <AiFollowupBlock
      state={state}
      subject={subject}
      body={body}
      tone={tone}
      onToneChange={(next) => void generate(next)}
      onRegenerate={() => void generate(tone)}
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
