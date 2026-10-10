import {
  CalendarClockIcon,
  FileTextIcon,
  MailCheckIcon,
  MailXIcon,
  MessageSquareIcon,
  NotebookPenIcon,
  PhoneIcon,
  RepeatIcon,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTimeline, type ActivityRow, type TimelineKind } from "@/lib/activity/activity";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";

import { AddActivityMenu } from "./activity-controls";

// Historique des activités de la fiche : ce qui a réellement été fait sur le dossier, du plus récent
// au plus ancien. Un brouillon copié ou ouvert dans Gmail est signalé comme tel (envoi non confirmé).

const KIND_STYLE: Record<TimelineKind, { icon: LucideIcon; tone: string }> = {
  email_envoye: { icon: MailCheckIcon, tone: "bg-success-soft text-success" },
  email_echec: { icon: MailXIcon, tone: "bg-danger-soft text-danger" },
  brouillon_utilise: { icon: FileTextIcon, tone: "bg-surface-tinted text-foreground-tertiary" },
  relance: { icon: RepeatIcon, tone: "bg-primary-soft text-primary-hover" },
  appel: { icon: PhoneIcon, tone: "bg-primary-soft text-primary-hover" },
  message: { icon: MessageSquareIcon, tone: "bg-primary-soft text-primary-hover" },
  note: { icon: NotebookPenIcon, tone: "bg-surface-tinted text-foreground-secondary" },
  prochaine_action: { icon: CalendarClockIcon, tone: "bg-warning-soft text-warning" },
};

export async function ActivityHistory({ prospectId, rows, opposition }: { prospectId: string; rows: ActivityRow[]; opposition: boolean }) {
  const { t, locale, format } = await getI18n();
  const items = buildTimeline(rows);
  const dateTime = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-[15px]">{t.activity.historyTitle}</CardTitle>
        <AddActivityMenu prospectId={prospectId} opposition={opposition} />
      </CardHeader>
      <CardContent className="pt-2 sm:pt-3">
        {items.length === 0 ? (
          <p className="rounded-lg bg-surface-tinted px-4 py-5 text-center text-dense text-foreground-secondary">{t.activity.historyEmpty}</p>
        ) : (
          <ol className="relative flex flex-col">
            {items.map((item, index) => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;
              const meta = [dateTime.format(new Date(item.at)), item.channel ? t.activity.channels[item.channel] : null].filter(Boolean).join(" · ");
              return (
                <li key={`${item.id}-${item.kind}`} className="relative flex gap-3 pb-5 last:pb-0">
                  {index < items.length - 1 && <span aria-hidden className="absolute top-9 bottom-1 left-[17px] w-px bg-border" />}
                  <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full", style.tone)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="flex flex-wrap items-baseline gap-x-2 text-body font-medium text-foreground">
                      {t.activity.kinds[item.kind]}
                      <span className="text-caption font-normal text-foreground-tertiary tabular-nums">{meta}</span>
                    </p>
                    {item.kind === "email_envoye" && item.to && <p className="text-dense text-foreground-secondary">{t.activity.sentTo(item.to)}</p>}
                    {item.summary && (
                      <p className="mt-0.5 text-dense break-words whitespace-pre-line text-foreground-secondary">{item.summary}</p>
                    )}
                    {item.kind === "brouillon_utilise" && <p className="mt-0.5 text-caption text-foreground-tertiary">{t.activity.draftNotConfirmed}</p>}
                    {item.kind === "email_echec" && <p className="mt-0.5 text-caption text-danger">{t.activity.failedNothingSent}</p>}
                    {item.nextAction && (
                      <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-foreground-secondary">
                        <CalendarClockIcon className="size-3.5" aria-hidden />
                        {t.activity.nextActionOn(format.date(item.nextAction))}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
