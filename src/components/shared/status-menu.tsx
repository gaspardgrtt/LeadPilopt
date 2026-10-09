"use client";

import { CheckIcon } from "lucide-react";
import { useT } from "@/i18n/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/prospects";

type StatusMenuProps = {
  value: ProspectStatus;
  onChange?: (status: ProspectStatus) => void;
};

/** Badge de statut cliquable qui ouvre le menu des 5 statuts. */
export function StatusMenu({ value, onChange }: StatusMenuProps) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t.workspace.changeStatus}
        onClick={(event) => event.stopPropagation()}
      >
        <StatusBadge status={value} interactive />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {PROSPECT_STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onSelect={() => onChange?.(status)}
            className="justify-between"
          >
            <StatusBadge status={status} className="bg-transparent px-0 ring-0" />
            {status === value && <CheckIcon className="size-3.5 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
