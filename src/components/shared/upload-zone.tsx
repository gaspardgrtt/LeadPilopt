"use client";

import * as React from "react";
import { CircleAlertIcon, FileSpreadsheetIcon, UploadIcon, XIcon } from "lucide-react";
import { useT } from "@/i18n/client";

import { cn } from "@/lib/utils";
import { formatInteger } from "@/lib/format";
import { Button } from "@/components/ui/button";

// Zone d'import de la maquette : cadre pointillé, pastille ronde avec flèche d'upload,
// titre, phrase d'aide, bouton « Choisir un fichier », format accepté.
// Composant purement visuel : la lecture du fichier est faite par l'appelant via onFileSelected.
type UploadZoneProps = {
  onFileSelected?: (file: File) => void;
  onRemove?: () => void;
  /** Fichier déjà chargé : affiche la puce « nom · lignes » à la place de la zone. */
  file?: { name: string; rows?: number } | null;
  loading?: boolean;
  error?: string | null;
  accept?: string;
  className?: string;
};

export function UploadZone({
  onFileSelected,
  onRemove,
  file,
  loading = false,
  error,
  accept = ".csv,text/csv",
  className,
}: UploadZoneProps) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  function handleFiles(files: FileList | null) {
    const selected = files?.[0];
    if (selected) onFileSelected?.(selected);
  }

  if (file) {
    return (
      <div className={cn("flex h-14 items-center gap-3 rounded-lg border bg-surface px-4 shadow-xs", className)}>
        <span className="flex size-8 items-center justify-center rounded-md bg-success-soft text-success">
          <FileSpreadsheetIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-body font-medium text-foreground">
          {file.name}
          {file.rows !== undefined && (
            <span className="font-normal text-foreground-secondary"> · {formatInteger(file.rows)} lignes</span>
          )}
        </span>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <XIcon />
            {t.import.upload.remove}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        onClick={() => !loading && inputRef.current?.click()}
        aria-busy={loading || undefined}
        className={cn(
          "flex min-h-[248px] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-surface-subtle/60 hover:border-foreground-tertiary/60",
          error && "border-danger/60 bg-danger-soft/40"
        )}
      >
        <span
          className={cn(
            "mb-5 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary",
            dragging && "bg-primary-muted"
          )}
        >
          <UploadIcon className={cn("size-6", loading && "animate-pulse")} strokeWidth={2.25} aria-hidden />
        </span>
        <span className="text-[16px] leading-6 font-semibold text-foreground">
          {loading ? t.import.upload.reading : t.import.upload.drop}
        </span>
        <span className="mt-1 text-body text-foreground-secondary">
          {t.import.upload.orClick}
        </span>
        <Button
          type="button"
          size="md"
          className="mt-5"
          loading={loading}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {t.import.upload.choose}
        </Button>
        <span className="mt-4 text-caption font-normal text-foreground-tertiary">
          {t.import.upload.accepted}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          handleFiles(event.target.files);
          // Permet de resélectionner le même fichier après une correction.
          event.target.value = "";
        }}
      />
      {error && (
        <p className="mt-2 flex items-center gap-1 text-caption font-normal text-danger" role="alert">
          <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
