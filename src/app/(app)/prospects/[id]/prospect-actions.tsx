"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BanIcon, CompassIcon, MailIcon, PenLineIcon } from "lucide-react";

import {
  FollowupBlock,
  type FollowupState,
} from "@/components/shared/followup-block";
import { StatusMenu } from "@/components/shared/status-menu";
import { MovingBorderButton } from "@/components/shared/moving-border-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildGmailComposeUrl } from "@/lib/gmail";
import { FOLLOWUP_TONES, type FollowupTone, type ProspectStatus } from "@/lib/prospects";
import { useLocale, useT } from "@/i18n/client";
import { FOLLOWUP_SCENARIOS, type FollowupScenario } from "@/lib/followups/templates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  setProspectOpposition,
  getEmailPreview,
  markFollowupCopied,
  prepareFollowup,
  saveFollowupDraft,
  updateProspectStatus,
  type EmailPreview,
} from "../../actions";

/** Badge de statut de la fiche, avec mise à jour optimiste et annulation. */
export function ProspectStatusControl({
  prospectId,
  status,
}: {
  prospectId: string;
  status: ProspectStatus;
}) {
  const t = useT();
  const [value, setValue] = React.useState(status);
  React.useEffect(() => setValue(status), [status]);

  async function change(
    next: ProspectStatus,
    previous: ProspectStatus = value,
  ) {
    setValue(next);
    const result = await updateProspectStatus(prospectId, next);
    if (!result.ok) {
      setValue(previous);
      toast.error(result.message);
      return;
    }
    toast.success(t.sheet.statusChanged(t.enums.status[next]), {
      action: { label: t.common.undo, onClick: () => void change(previous, next) },
    });
  }

  return <StatusMenu value={value} onChange={(next) => void change(next)} />;
}

const oppositionDateFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Opposition à la prospection (désabonnement, « STOP », refus oral) : enregistrée, elle bloque
 * tout contact depuis LeadPilot et passe le dossier en « Ignoré ». La lever demande confirmation.
 */
export function OppositionControl({
  prospectId,
  opposition,
}: {
  prospectId: string;
  opposition: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const opposed = Boolean(opposition);

  function confirm() {
    startTransition(async () => {
      const result = await setProspectOpposition(prospectId, !opposed);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setOpen(false);
      toast.success(
        opposed
          ? t.sheet.opposition.lifted
          : t.sheet.opposition.recorded,
      );
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-start gap-1.5">
      {opposed ? (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-0.5 text-caption font-semibold text-danger">
          <BanIcon className="size-3.5" aria-hidden />
          {t.sheet.opposition.since(oppositionDateFormat(locale).format(new Date(opposition!)))}
        </span>
      ) : (
        <span className="text-foreground-secondary">
          {t.sheet.opposition.none}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm text-dense font-medium text-primary-hover underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
      >
        {opposed ? t.sheet.opposition.lift : t.sheet.opposition.record}
      </button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {opposed ? t.sheet.opposition.liftTitle : t.sheet.opposition.recordTitle}
            </DialogTitle>
            <DialogDescription>
              {opposed
                ? t.sheet.opposition.liftText
                : t.sheet.opposition.recordText}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant={opposed ? "primary" : "danger"}
              onClick={confirm}
              loading={pending}
            >
              {opposed ? t.sheet.opposition.lift : t.sheet.opposition.recordConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}

type FollowupRelance = {
  id: string;
  objet: string;
  corps: string;
  ton: FollowupTone;
  scenario: FollowupScenario | null;
};

/** Envoi par e-mail déjà effectué (Brevo). */
type SentInfo = { at: string; to: string };

type FollowupPanelProps = {
  prospectId: string;
  nextProspectId: string | null;
  relance:
    (FollowupRelance & { copiee: boolean; sent: SentInfo | null }) | null;
  /** Date d'opposition à la prospection : tout contact est alors bloqué. */
  opposition: string | null;
  /** Envoi par e-mail (Brevo) configuré sur le serveur. */
  emailSending: boolean;
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
export function FollowupPanel({
  prospectId,
  nextProspectId,
  relance: initialRelance,
  defaultTone,
  contactEmail,
  context,
  opposition,
  emailSending,
}: FollowupPanelProps) {
  const t = useT();
  const router = useRouter();
  const [relance, setRelance] = React.useState<FollowupRelance | null>(
    initialRelance,
  );
  const [subject, setSubject] = React.useState(initialRelance?.objet ?? "");
  const [body, setBody] = React.useState(initialRelance?.corps ?? "");
  const [tone, setTone] = React.useState<FollowupTone>(
    initialRelance?.ton ?? defaultTone,
  );
  const [scenario, setScenario] = React.useState<FollowupScenario>(
    initialRelance?.scenario ?? context.recommended,
  );
  const [state, setState] = React.useState<FollowupState>("ready");
  const [error, setError] = React.useState<string | null>(null);
  const saved = React.useRef({
    subject: initialRelance?.objet ?? "",
    body: initialRelance?.corps ?? "",
  });
  const [sent, setSent] = React.useState<SentInfo | null>(
    initialRelance?.sent ?? null,
  );
  const [sendOpen, setSendOpen] = React.useState(false);
  const blockedReason = opposition
    ? t.sheet.opposition.blocked
    : null;

  async function prepare(
    nextScenario: FollowupScenario,
    nextTone: FollowupTone,
  ) {
    const previous = {
      subject,
      body,
      edited: state === "edited",
      scenario,
      tone,
    };
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
    saved.current = {
      subject: result.relance.objet,
      body: result.relance.corps,
    };
    setState("ready");
    if (previous.edited) {
      // Le texte modifié a été remplacé par le modèle : on laisse la possibilité de le récupérer.
      toast.success(t.followup.templateApplied, {
        description: t.followup.templateReplaced,
        action: {
          label: t.followup.recoverText,
          onClick: () => {
            setSubject(previous.subject);
            setBody(previous.body);
            setState("edited");
            void saveFollowupDraft(
              result.relance.id,
              previous.subject,
              previous.body,
            ).then((saveResult) => {
              if (saveResult.ok)
                saved.current = {
                  subject: previous.subject,
                  body: previous.body,
                };
            });
          },
        },
      });
    }
  }

  async function persistDraft(): Promise<boolean> {
    if (!relance || sent) return true;
    if (subject === saved.current.subject && body === saved.current.body)
      return true;
    const result = await saveFollowupDraft(relance.id, subject, body);
    if (!result.ok) {
      toast.error(result.message);
      return false;
    }
    saved.current = { subject, body };
    return true;
  }

  async function markFollowedUp() {
    const result = await updateProspectStatus(prospectId, "relance");
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    if (nextProspectId) {
      toast.success(t.followup.markedNext);
      router.push(`/prospects/${nextProspectId}`);
    } else {
      toast.success(t.followup.marked);
    }
  }

  async function copy() {
    if (!relance) return;
    try {
      await navigator.clipboard.writeText(`Objet : ${subject}\n\n${body}`);
    } catch {
      toast.error(
        t.followup.copyBlocked,
      );
      return;
    }
    toast.success(t.followup.copied, {
      description: t.followup.copiedHint,
      action: {
        label: t.followup.markDone,
        onClick: () => void markFollowedUp(),
      },
    });
    const [copied] = await Promise.all([
      markFollowupCopied(relance.id),
      persistDraft(),
    ]);
    if (!copied.ok) toast.error(copied.message);
  }

  async function openInGmail(bodyIncluded: boolean) {
    if (!relance) return;
    if (!bodyIncluded) {
      // Message trop long pour l'URL : il est copié pour être collé dans le brouillon.
      await navigator.clipboard.writeText(body).catch(() => undefined);
    }
    // Gmail est seulement ouvert : rien n'est envoyé tant que l'utilisateur ne l'a pas fait.
    toast.success(
      bodyIncluded
        ? t.followup.gmailOpened
        : t.followup.gmailOpenedPaste,
      {
        description: contactEmail
          ? t.followup.gmailNotSent
          : t.followup.gmailNoRecipient,
        action: {
          label: t.followup.markDone,
          onClick: () => void markFollowedUp(),
        },
      },
    );
    const [used] = await Promise.all([
      markFollowupCopied(relance.id),
      persistDraft(),
    ]);
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
            <PenLineIcon
              className="size-5 text-white"
              strokeWidth={2}
              aria-hidden
            />
          </span>
          <h3 className="mt-3 text-[15px] leading-6 font-semibold text-foreground">{t.followup.prepareTitle}</h3>
          <p className="mt-1 text-body text-foreground-secondary">{t.followup.prepareText}</p>

          <div className="mt-5 w-full rounded-lg border bg-surface p-4 text-left">
            <p className="flex items-center gap-2 text-dense font-semibold text-foreground">
              <CompassIcon className="size-4 text-primary" aria-hidden />
              {t.followup.detected}
            </p>
            <p className="mt-1 text-dense text-foreground-secondary">
              {context.reasons.join(" · ")}
            </p>
            <p className="mt-2 text-dense text-foreground">
              {t.followup.recommendedTemplate}{" "}
              <span className="font-semibold">
                {t.enums.scenario[context.recommended]}
              </span>
            </p>
          </div>

          <div className="mt-4 grid w-full gap-3 text-left sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <p className="mb-1.5 text-dense font-medium text-foreground">{t.followup.template}</p>
              <Select
                value={scenario}
                onValueChange={(value) =>
                  setScenario(value as FollowupScenario)
                }
              >
                <SelectTrigger
                  className="w-full"
                  aria-label={t.followup.templateAria}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLLOWUP_SCENARIOS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t.enums.scenario[value]}
                      {value === context.recommended && (
                        <span className="text-caption text-success">
                          {t.followup.recommended}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-dense font-medium text-foreground">{t.followup.tone}</p>
              <ToggleGroup
                type="single"
                value={tone}
                onValueChange={(value) =>
                  value && setTone(value as FollowupTone)
                }
                aria-label={t.followup.toneAria}
              >
                {FOLLOWUP_TONES.map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {t.enums.tone[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <p className="mt-2 w-full text-left text-caption text-foreground-tertiary">
            {t.enums.scenarioHint[scenario]}
          </p>

          {error && (
            <p role="alert" className="mt-4 text-dense text-danger">
              {error}
            </p>
          )}
          {blockedReason && (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-2.5 text-left text-dense text-danger"
            >
              <BanIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {blockedReason}
            </p>
          )}
          <MovingBorderButton
            className="mt-6"
            disabled={Boolean(blockedReason)}
            onClick={() => void prepare(scenario, tone)}
          >
            <PenLineIcon />
            {t.followup.prepareTitle}
          </MovingBorderButton>
        </div>
      </section>
    );
  }

  return (
    <>
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
        blockedReason={blockedReason}
        sentInfo={sent}
        sendEmail={{
          onClick: () => setSendOpen(true),
          disabledReason: !emailSending
            ? t.followup.emailNotConfigured
            : !contactEmail
              ? t.followup.noEmailAddress
              : null,
        }}
      />
      {relance && (
        <SendEmailDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          relanceId={relance.id}
          beforePreview={persistDraft}
          onSent={(info) => {
            setSent(info);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; preview: EmailPreview };

/**
 * Aperçu puis confirmation de l'envoi par e-mail. Le contenu affiché est celui que le serveur
 * enverra ; il est renvoyé tel quel à la route d'envoi, qui refuse s'il a changé entre-temps.
 */
function SendEmailDialog({
  open,
  onOpenChange,
  relanceId,
  beforePreview,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relanceId: string;
  beforePreview: () => Promise<boolean>;
  onSent: (info: SentInfo) => void;
}) {
  const t = useT();
  const [state, setState] = React.useState<PreviewState>({ kind: "loading" });
  const [sending, setSending] = React.useState(false);
  const sendingRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      const saved = await beforePreview();
      if (!saved) {
        if (!cancelled)
          setState({
            kind: "error",
            message: t.followup.previewSaveFailed,
          });
        return;
      }
      const result = await getEmailPreview(relanceId);
      if (cancelled) return;
      setState(
        result.ok
          ? { kind: "ready", preview: result.preview }
          : { kind: "error", message: result.message },
      );
    })();
    return () => {
      cancelled = true;
    };
    // L'aperçu est recalculé à chaque ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, relanceId]);

  async function confirmSend() {
    if (state.kind !== "ready" || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const response = await fetch("/api/relances/envoyer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relanceId,
          objet: state.preview.subject,
          corps: state.preview.body,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok: true; envoyeeLe: string; envoyeeA: string }
        | { ok: false; message: string }
        | null;
      if (!result || !result.ok) {
        toast.error(
          result && !result.ok
            ? result.message
            : t.followup.sendFailed,
        );
        return;
      }
      toast.success(t.followup.emailSent, {
        description: t.followup.emailSentTo(result.envoyeeA),
      });
      onSent({ at: result.envoyeeLe, to: result.envoyeeA });
      onOpenChange(false);
    } catch {
      toast.error(
        t.followup.connectionLost,
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t.followup.dialogTitle}</DialogTitle>
          <DialogDescription>{t.followup.dialogText}</DialogDescription>
        </DialogHeader>

        {state.kind === "loading" && (
          <p className="py-6 text-center text-body text-foreground-secondary">
            {t.followup.previewLoading}
          </p>
        )}
        {state.kind === "error" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-soft px-3.5 py-3 text-dense text-danger"
          >
            <BanIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.message}
          </p>
        )}
        {state.kind === "ready" && (
          <div className="flex min-w-0 flex-col gap-3">
            <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 rounded-lg border bg-surface-tinted px-3.5 py-3 text-dense">
              <dt className="text-foreground-secondary">{t.followup.to}</dt>
              <dd className="min-w-0 font-medium break-all text-foreground">
                {state.preview.to.name
                  ? `${state.preview.to.name} <${state.preview.to.email}>`
                  : state.preview.to.email}
              </dd>
              <dt className="text-foreground-secondary">{t.followup.from}</dt>
              <dd className="min-w-0 break-all text-foreground">
                {state.preview.from.name} &lt;{state.preview.from.email}&gt;
              </dd>
              {state.preview.replyTo && (
                <>
                  <dt className="text-foreground-secondary">{t.followup.replyTo}</dt>
                  <dd className="min-w-0 break-all text-foreground">
                    {state.preview.replyTo}
                  </dd>
                </>
              )}
              <dt className="text-foreground-secondary">{t.followup.subject}</dt>
              <dd className="min-w-0 font-medium text-foreground">
                {state.preview.subject}
              </dd>
            </dl>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-surface px-3.5 py-3 font-sans text-dense leading-[20px] whitespace-pre-wrap text-foreground">
              {state.preview.text}
            </pre>
            <p className="text-caption text-foreground-tertiary">{t.followup.oppositionNote}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            {t.common.cancel}
          </Button>
          <Button
            onClick={() => void confirmSend()}
            disabled={state.kind !== "ready"}
            loading={sending}
          >
            <MailIcon />
            {t.followup.confirmSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
