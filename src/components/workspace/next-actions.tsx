import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import type { NextActionItem } from "@/lib/data/prospects";
import { getI18n } from "@/i18n/server";
import { DueBadge } from "@/app/(app)/prospects/[id]/activity-controls";

// « Prochaines actions » (Mes priorités) : rappels internes programmés par l'agent, du plus urgent
// au plus lointain. Rien n'apparaît tant qu'aucun rappel n'a été programmé.
export async function NextActions({ items }: { items: NextActionItem[] }) {
  if (items.length === 0) return null;
  const { t } = await getI18n();
  return (
    <Card className="mb-6 shadow-none">
      <CardHeader>
        <CardTitle className="text-[15px]">{t.activity.upcomingTitle}</CardTitle>
        <p className="text-dense text-foreground-secondary">{t.activity.upcomingDescription}</p>
      </CardHeader>
      <CardContent className="pt-1">
        <ul className="divide-y divide-border/60">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/prospects/${item.id}#historique`}
                className="flex items-center gap-3 rounded-md py-2.5 outline-none hover:bg-surface-tinted/60 focus-visible:ring-[3px] focus-visible:ring-primary/25 sm:px-2"
              >
                <InitialsAvatar name={item.contact_nom || item.entreprise} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium text-foreground">{item.entreprise}</span>
                  {item.contact_nom && <span className="block truncate text-dense text-foreground-secondary">{item.contact_nom}</span>}
                </span>
                <StatusBadge status={item.statut} className="hidden sm:inline-flex" />
                {item.prochaine_action_le && <DueBadge date={item.prochaine_action_le} />}
                <ChevronRightIcon className="size-4 shrink-0 text-foreground-tertiary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
