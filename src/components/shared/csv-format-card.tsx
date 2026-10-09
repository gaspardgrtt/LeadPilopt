import { DownloadIcon, FileSpreadsheetIcon, InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Encarts « Format du fichier CSV » et « Exemple de fichier » sous la zone d'import (maquette).
// Seules « entreprise » et « date dernier contact » sont obligatoires ; les noms de colonnes
// HubSpot, Pipedrive et Salesforce (FR et EN) sont aussi reconnus.
const COLUMNS = ["entreprise", "contact", "email", "téléphone", "montant", "date dernier contact", "statut", "notes"];
const EXAMPLE = ["Acme SAS", "Claire Martin", "claire@acme.fr", "06 12 34 56 78", "15 000", "04/09/2026", "Proposition envoyée", "Attend le budget Q4"];

export function CsvFormatCard({ className }: { className?: string }) {
  return (
    <section className={cn("rounded-lg border bg-surface-tinted p-5 sm:p-6", className)}>
      <div className="flex gap-3.5">
        <InfoIcon className="mt-0.5 size-5 shrink-0 text-info" strokeWidth={2} aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] leading-6 font-semibold text-foreground">Format du fichier CSV</h2>
          <p className="mt-0.5 text-body text-foreground-secondary">
            Colonnes reconnues (seules « entreprise » et « date dernier contact » sont obligatoires ; les noms HubSpot, Pipedrive et Salesforce sont aussi acceptés) :
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
  return (
    <section className={cn("flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-lg border bg-primary-soft/70 px-5 py-4 sm:px-6 sm:py-5", className)}>
      <FileSpreadsheetIcon className="size-5 shrink-0 text-primary" strokeWidth={2} aria-hidden />
      <h2 className="flex-1 text-[15px] leading-6 font-semibold whitespace-nowrap text-foreground">Exemple de fichier</h2>
      {href && (
        <a
          href={href}
          download
          className="inline-flex items-center gap-1.5 rounded-sm text-dense font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25"
        >
          <DownloadIcon className="size-4" aria-hidden />
          Télécharger un exemple CSV
        </a>
      )}
    </section>
  );
}
