"use client";

import { DownloadIcon, FileSpreadsheetIcon, InfoIcon } from "lucide-react";
import { useT } from "@/i18n/client";

import { cn } from "@/lib/utils";

// Encarts « Format du fichier CSV » et « Exemple de fichier » sous la zone d'import (maquette).
// Obligatoires : la date du dernier contact, et le nom du contact (ou prénom + nom) ou l'entreprise ;
// l'entreprise reste vide pour un particulier. Les noms de colonnes HubSpot, Pipedrive et Salesforce
// (FR et EN) sont aussi reconnus. Les noms de colonnes affichés sont ceux attendus dans le fichier
// (non traduits) ; l'exemple est une donnée, non traduite.
const COLUMNS = ["prénom", "nom", "entreprise", "email", "téléphone", "budget", "dernier contact", "statut", "notes"];
const EXAMPLE = ["Claire", "Martin", "—", "claire.martin@example.com", "06 12 34 56 78", "420 000", "04/09/2026", "Visite effectuée", "Maison T4 avec jardin"];

export function CsvFormatCard({ className }: { className?: string }) {
  const t = useT();
  return (
    <section className={cn("rounded-lg border bg-surface-tinted p-5 sm:p-6", className)}>
      <div className="flex gap-3.5">
        <InfoIcon className="mt-0.5 size-5 shrink-0 text-info" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-6 font-semibold text-foreground">{t.import.format.title}</h2>
          <p className="mt-0.5 text-body text-foreground-secondary">
            {t.import.format.text}
          </p>
          <div className="mt-4 overflow-x-auto rounded-md border bg-surface">
            <table className="w-full text-dense">
              <thead>
                <tr className="border-b">
                  {COLUMNS.map((column) => (
                    <th key={column} className="h-10 px-4 text-left font-semibold whitespace-nowrap text-foreground">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {EXAMPLE.map((value, index) => (
                    <td key={COLUMNS[index]} className="h-10 px-4 whitespace-nowrap text-foreground-secondary">
                      {value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CsvExampleCard({ href, className }: { href?: string; className?: string }) {
  const t = useT();
  return (
    <section className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border bg-primary-soft/70 px-5 py-4 sm:px-6 sm:py-5", className)}>
      <FileSpreadsheetIcon className="size-5 shrink-0 text-primary" strokeWidth={2} aria-hidden />
      <h2 className="flex-1 text-[15px] leading-6 font-semibold whitespace-nowrap text-foreground">{t.import.format.example}</h2>
      {href && (
        <a
          href={href}
          download
          className="inline-flex items-center gap-1.5 rounded-sm text-dense font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <DownloadIcon className="size-4" aria-hidden />
          {t.import.format.download}
        </a>
      )}
    </section>
  );
}
