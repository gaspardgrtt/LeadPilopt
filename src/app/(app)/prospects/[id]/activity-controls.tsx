"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, ChevronDownIcon, MessageSquareIcon, NotebookPenIcon, PhoneIcon, RepeatIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field } from "@/components/shared/field";
import { useFormat, useT } from "@/i18n/client";
import {
  CHANNELS_BY_TYPE,
  NEXT_ACTION_CHOICES,
  dueState,
  parisToday,
  type ActivityType,
  type Channel,
  type NextActionChoice,
} from "@/lib/activity/activity";
import { cn } from "@/lib/utils";

import { recordActivity, scheduleNextAction } from "../../actions";

// Saisie des activités et des prochaines actions (fiche prospect). Les données sont enregistrées
// par des actions serveur (Supabase, RLS) : rien n'est conservé seulement dans l'état local.

type NextValue = NextActionChoice | "inchangee";

function NextActionPicker({
  value,
  onChange,
  date,
  onDateChange,
  allowKeep,
  idPrefix,
}: {
  value: NextValue;
  onChange: (value: NextValue) => void;
  date: string;
  onDateChange: (date: string) => void;
  allowKeep?: boolean;
  idPrefix: string;
}) {
  const t = useT();
  const choices: NextValue[] = allowKeep ? ["inchangee", ...NEXT_ACTION_CHOICES] : [...NEXT_ACTION_CHOICES];
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => next && onChange(next as NextValue)}
        className="flex-wrap justify-start"
        aria-label={t.activity.dialog.nextAction}
      >
        {choices.map((choice) => (
          <ToggleGroupItem key={choice} value={choice} className="h-9 px-3">
            {choice === "inchangee" ? t.activity.dialog.keepNext : t.activity.dialog.next[choice]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {value === "date" && (
        <Input
          id={`${idPrefix}-next-date`}
          type="date"
          min={parisToday()}
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className="max-w-48"
          aria-label={t.activity.dialog.next.date}
        />
      )}
    </div>
  );
}

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  relance: RepeatIcon,
  appel: PhoneIcon,
  message: MessageSquareIcon,
  note: NotebookPenIcon,
};

export type RecordedActivity = { type: ActivityType; nextAction: string | null; nextChanged: boolean };

/**
 * Enregistre une activité réellement effectuée. Pour une relance, un appel ou un message, la date de
 * dernier contact est mise à jour côté serveur ; une note ne la modifie pas.
 */
export function RecordActivityDialog({
  open,
  onOpenChange,
  prospectId,
  type,
  defaultChannel,
  defaultSummary,
  onRecorded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  type: ActivityType;
  defaultChannel?: Channel | null;
  defaultSummary?: string;
  onRecorded?: (activity: RecordedActivity) => void;
}) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const channels = CHANNELS_BY_TYPE[type];
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [when, setWhen] = React.useState<"maintenant" | "hier" | "date">("maintenant");
  const [whenDate, setWhenDate] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [next, setNext] = React.useState<NextValue>("3j");
  const [nextDate, setNextDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Même identifiant pour toutes les tentatives d'un même formulaire : pas de doublon.
  const requestId = React.useRef<string>("");

  React.useEffect(() => {
    if (!open) return;
    requestId.current = crypto.randomUUID();
    setChannel(channels.length === 0 ? null : defaultChannel && channels.includes(defaultChannel) ? defaultChannel : channels[0]);
    setWhen("maintenant");
    setWhenDate("");
    setSummary(defaultSummary ?? "");
    setNext(type === "note" ? "inchangee" : "3j");
    setNextDate("");
    setError(null);
    // Réinitialisé à chaque ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (type === "note" && !summary.trim()) {
      setError(t.activity.dialog.noteRequired);
      return;
    }
    if (when === "date" && !whenDate) {
      setError(t.activity.dialog.errorDate);
      return;
    }
    if (next === "date" && !nextDate) {
      setError(t.activity.dialog.errorNextDate);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await recordActivity({
        id: requestId.current,
        prospectId,
        type,
        channel,
        summary,
        when: when === "date" ? whenDate : when,
        next: next === "inchangee" ? null : next,
        nextDate: next === "date" ? nextDate : null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const details = [
        result.created ? null : t.activity.alreadySaved,
        result.contact ? t.activity.contactUpdated : null,
        result.nextChanged && result.nextAction ? t.activity.nextScheduled(format.date(result.nextAction)) : null,
      ].filter(Boolean);
      onOpenChange(false);
      router.refresh();
      if (onRecorded) onRecorded({ type, nextAction: result.nextAction, nextChanged: result.nextChanged });
      else toast.success(t.activity.saved[type], { description: details.join(" ") || undefined });
    } catch {
      setError(t.followup.connectionLost);
    } finally {
      setSaving(false);
    }
  }

  const Icon = ICONS[type];
  const id = `activite-${type}`;
  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="size-4 text-primary" />
              {t.activity.dialog.titles[type]}
            </DialogTitle>
            <DialogDescription>{t.activity.dialog.descriptions[type]}</DialogDescription>
          </DialogHeader>

          {channels.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-dense font-medium text-foreground">{t.activity.dialog.channel}</span>
              <ToggleGroup
                type="single"
                value={channel ?? undefined}
                onValueChange={(value) => value && setChannel(value as Channel)}
                className="flex-wrap justify-start"
                aria-label={t.activity.dialog.channel}
              >
                {channels.map((value) => (
                  <ToggleGroupItem key={value} value={value} className="h-9 px-3">
                    {t.activity.channels[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-dense font-medium text-foreground">{t.activity.dialog.when}</span>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                value={when}
                onValueChange={(value) => value && setWhen(value as typeof when)}
                className="justify-start"
                aria-label={t.activity.dialog.when}
              >
                <ToggleGroupItem value="maintenant" className="h-9 px-3">{t.activity.dialog.today}</ToggleGroupItem>
                <ToggleGroupItem value="hier" className="h-9 px-3">{t.activity.dialog.yesterday}</ToggleGroupItem>
                <ToggleGroupItem value="date" className="h-9 px-3">{t.activity.dialog.otherDate}</ToggleGroupItem>
              </ToggleGroup>
              {when === "date" && (
                <Input
                  type="date"
                  max={parisToday()}
                  value={whenDate}
                  onChange={(event) => setWhenDate(event.target.value)}
                  className="max-w-48"
                  aria-label={t.activity.dialog.otherDate}
                />
              )}
            </div>
          </div>

          <Field label={type === "note" ? t.activity.dialog.note : t.activity.dialog.summary} htmlFor={`${id}-resume`} required={type === "note"}>
            <Textarea
              id={`${id}-resume`}
              value={summary}
              maxLength={2000}
              rows={3}
              onChange={(event) => setSummary(event.target.value)}
              placeholder={type === "note" ? t.activity.dialog.notePlaceholder : t.activity.dialog.summaryPlaceholder}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <span className="text-dense font-medium text-foreground">{t.activity.dialog.nextAction}</span>
            <NextActionPicker value={next} onChange={setNext} date={nextDate} onDateChange={setNextDate} allowKeep={type === "note"} idPrefix={id} />
          </div>

          {error && (
            <p role="alert" className="text-dense text-danger">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? t.activity.dialog.saving : t.activity.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Programme ou retire la prochaine action (après un envoi par e-mail, ou depuis la fiche). */
export function ScheduleNextActionDialog({
  open,
  onOpenChange,
  prospectId,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prospectId: string;
  description?: string;
}) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const [next, setNext] = React.useState<NextValue>("3j");
  const [nextDate, setNextDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef("");

  React.useEffect(() => {
    if (!open) return;
    requestId.current = crypto.randomUUID();
    setNext("3j");
    setNextDate("");
    setError(null);
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || next === "inchangee") return;
    if (next === "date" && !nextDate) {
      setError(t.activity.dialog.errorNextDate);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await scheduleNextAction({ id: requestId.current, prospectId, next, nextDate: next === "date" ? nextDate : null });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onOpenChange(false);
      router.refresh();
      toast.success(result.nextAction ? t.activity.schedule.saved(format.date(result.nextAction)) : t.activity.schedule.cleared);
    } catch {
      setError(t.followup.connectionLost);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !saving && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClockIcon className="size-4 text-primary" />
              {t.activity.schedule.title}
            </DialogTitle>
            <DialogDescription>{description ?? t.activity.schedule.description}</DialogDescription>
          </DialogHeader>
          <NextActionPicker value={next} onChange={setNext} date={nextDate} onDateChange={setNextDate} idPrefix="planifier" />
          {error && (
            <p role="alert" className="text-dense text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" loading={saving}>
              {saving ? t.activity.dialog.saving : t.activity.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Menu « Enregistrer une activité » de l'historique. */
export function AddActivityMenu({ prospectId, opposition }: { prospectId: string; opposition: boolean }) {
  const t = useT();
  const [type, setType] = React.useState<ActivityType | null>(null);
  // Prospect opposé à la prospection : seule une note peut être ajoutée.
  const types: ActivityType[] = opposition ? ["note"] : ["relance", "appel", "message", "note"];
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            {t.activity.add}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {types.map((value) => {
            const Icon = ICONS[value];
            return (
              <DropdownMenuItem key={value} onSelect={() => setType(value)}>
                <Icon className="size-4" />
                {t.activity.menu[value]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <RecordActivityDialog open={type !== null} onOpenChange={(open) => !open && setType(null)} prospectId={prospectId} type={type ?? "note"} />
    </>
  );
}

/** Prochaine action du dossier (carte Statut) : affichage, planification, modification, retrait. */
export function NextActionControl({ prospectId, date }: { prospectId: string; date: string | null }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  async function remove() {
    setRemoving(true);
    const result = await scheduleNextAction({ id: crypto.randomUUID(), prospectId, next: "aucune", nextDate: null });
    setRemoving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    router.refresh();
    toast.success(t.activity.schedule.cleared);
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {date ? <DueBadge date={date} /> : <span className="text-foreground-secondary">{t.activity.none}</span>}
      <span className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className="text-body font-medium text-primary-hover hover:underline">
          {date ? t.activity.change : t.activity.plan}
        </button>
        {date && (
          <button
            type="button"
            onClick={() => void remove()}
            disabled={removing}
            className="inline-flex items-center gap-1 text-body text-foreground-secondary hover:text-foreground hover:underline disabled:opacity-50"
          >
            <XIcon className="size-3.5" />
            {t.activity.remove}
          </button>
        )}
      </span>
      <ScheduleNextActionDialog open={open} onOpenChange={setOpen} prospectId={prospectId} />
    </div>
  );
}

/** Échéance d'une prochaine action : en retard (rouge), aujourd'hui (ambre), demain / à venir. */
export function DueBadge({ date, className }: { date: string; className?: string }) {
  const t = useT();
  const format = useFormat();
  const state = dueState(date);
  const label =
    state === "retard" ? t.activity.due.retard(format.date(date)) : state === "a_venir" ? t.activity.due.a_venir(format.date(date)) : t.activity.due[state];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-caption font-medium tabular-nums whitespace-nowrap",
        state === "retard" && "bg-danger-soft text-danger",
        state === "aujourdhui" && "bg-warning-soft text-warning",
        (state === "demain" || state === "a_venir") && "bg-primary-soft text-primary-hover",
        className
      )}
    >
      <CalendarClockIcon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

