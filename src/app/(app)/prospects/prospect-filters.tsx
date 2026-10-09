"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROSPECT_STATUSES, STATUS_LABELS } from "@/lib/prospects";
import { formatInteger } from "@/lib/format";

const SORT_LABELS = {
  ca: "Argent récupérable",
  score: "Score",
  montant: "Montant",
  silence: "Silence",
  entreprise: "Entreprise",
} as const;

type ProspectFiltersProps = {
  view: "oublies" | "tous";
  status: string;
  sort: keyof typeof SORT_LABELS;
  counts: { oublies: number; tous: number };
};

/** Filtres E4 (spéc. UX/UI repères 2 à 4), portés par l'URL pour être partageables. */
export function ProspectFilters({ view, status, sort, counts }: ProspectFiltersProps) {
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
        aria-label="Prospects affichés"
      >
        <ToggleGroupItem value="oublies">
          Oubliés <span className="text-foreground-tertiary tabular-nums">{formatInteger(counts.oublies)}</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="tous">
          Tous <span className="text-foreground-tertiary tabular-nums">{formatInteger(counts.tous)}</span>
        </ToggleGroupItem>
      </ToggleGroup>

      <Select value={status} onValueChange={(value) => update("statut", value, "a_traiter")}>
        <SelectTrigger className="w-48" aria-label="Filtrer par statut">
          <span className="text-foreground-tertiary">Statut</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="tous">Tous les statuts</SelectItem>
          {PROSPECT_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {STATUS_LABELS[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={sort} onValueChange={(value) => update("tri", value, "ca")}>
        <SelectTrigger className="w-52" aria-label="Trier par">
          <span className="text-foreground-tertiary">Tri</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
