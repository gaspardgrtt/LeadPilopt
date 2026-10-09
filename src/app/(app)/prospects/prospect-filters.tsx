"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROSPECT_STATUSES } from "@/lib/prospects";
import { useFormat, useT } from "@/i18n/client";

const SORTS = ["ca", "score", "montant", "silence", "entreprise"] as const;

type ProspectFiltersProps = {
  view: "oublies" | "tous";
  status: string;
  sort: (typeof SORTS)[number];
  counts: { oublies: number; tous: number };
};

/** Filtres E4 (spéc. UX/UI repères 2 à 4), portés par l'URL pour être partageables. */
export function ProspectFilters({ view, status, sort, counts }: ProspectFiltersProps) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  function update(key: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams);
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3" aria-busy={pending || undefined}>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(value) => value && update("vue", value, "oublies")}
        aria-label={t.workspace.prospects.shown}
      >
        <ToggleGroupItem value="oublies">
          {t.workspace.prospects.forgotten} <span className="text-foreground-tertiary tabular-nums">{format.integer(counts.oublies)}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="tous">
          {t.workspace.prospects.all} <span className="text-foreground-tertiary tabular-nums">{format.integer(counts.tous)}</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <Select value={status} onValueChange={(value) => update("statut", value, "a_traiter")}>
        <SelectTrigger className="w-48" aria-label={t.workspace.prospects.statusFilter}>
          <span className="text-foreground-tertiary">{t.workspace.prospects.status}</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">{t.workspace.prospects.allStatuses}</SelectItem>
          {PROSPECT_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t.enums.status[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => update("tri", value, "ca")}>
        <SelectTrigger className="w-52" aria-label={t.workspace.prospects.sortBy}>
          <span className="text-foreground-tertiary">{t.workspace.prospects.sort}</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((value) => (
            <SelectItem key={value} value={value}>
              {t.workspace.prospects.sorts[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
