"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputWithSuffix } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { CsvExampleCard, CsvFormatCard } from "@/components/shared/csv-format-card";
import { Field } from "@/components/shared/field";
import { Stepper } from "@/components/shared/stepper";
import { UploadZone } from "@/components/shared/upload-zone";
import { ImportWelcome } from "@/components/onboarding/onboarding";
import { cn } from "@/lib/utils";
import { useFormat, useLocale, useT } from "@/i18n/client";
import { BATCH_SIZE, IMPORT_FIELDS, type ColumnMapping, type ImportFieldKey } from "@/lib/import/fields";
import { ImportFileError, readCsvFile, type ParsedFile } from "@/lib/import/read-file";
import { buildImportRows, guessMapping, missingRequiredFields } from "@/lib/import/rows";
import { buildSampleCsv, SAMPLE_FILE_NAME } from "@/lib/import/sample";
import { FOLLOWUP_TONES, type FollowupTone } from "@/lib/prospects";

import { finishImport, importBatch, startImport } from "./actions";

const IGNORE = "__ignorer__";
const MAPPING_STORAGE_PREFIX = "leadpilot:import-mapping:";

type ImportWizardProps = {
  existingCount: number;
  historyCount: number;
  defaults: { seuil: number; panier: number | null; ton: FollowupTone; signature: string; commission: number | null };
};

type Phase = "fichier" | "colonnes" | "reglages" | "analyse";

/** Association mémorisée pour un fichier aux mêmes colonnes (spéc. E2, repère 5). */
function loadSavedMapping(headers: string[]): ColumnMapping | null {
  try {
    const saved = window.localStorage.getItem(MAPPING_STORAGE_PREFIX + headers.join("|"));
    if (!saved) return null;
    const mapping = JSON.parse(saved) as ColumnMapping;
    const valid = IMPORT_FIELDS.every((field) => mapping[field.key] === null || headers.includes(mapping[field.key]!));
    return valid ? mapping : null;
  } catch {
    return null;
  }
}

function saveMapping(headers: string[], mapping: ColumnMapping) {
  try {
    window.localStorage.setItem(MAPPING_STORAGE_PREFIX + headers.join("|"), JSON.stringify(mapping));
  } catch {
    // Stockage indisponible (navigation privée) : l'association sera simplement redevinée.
  }
}

export function ImportWizard({ existingCount, historyCount, defaults }: ImportWizardProps) {
  const t = useT();
  const locale = useLocale();
  const format = useFormat();
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("fichier");
  const [file, setFile] = React.useState<ParsedFile | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [mapping, setMapping] = React.useState<ColumnMapping | null>(null);

  const preview = React.useMemo(
    () => (file && mapping ? buildImportRows(file.records, mapping, locale) : null),
    [file, mapping, locale]
  );

  async function handleFile(selected: File) {
    setReading(true);
    setFileError(null);
    try {
      const parsed = await readCsvFile(selected, locale);
      setFile(parsed);
      setMapping(loadSavedMapping(parsed.headers) ?? guessMapping(parsed.headers));
      setPhase("colonnes");
    } catch (error) {
      setFileError(error instanceof ImportFileError ? error.message : t.import.readFailed);
    } finally {
      setReading(false);
    }
  }

  function trySample() {
    void handleFile(new File([buildSampleCsv()], SAMPLE_FILE_NAME, { type: "text/csv" }));
  }

  function reset() {
    setFile(null);
    setMapping(null);
    setPhase("fichier");
  }

  const stepIndex = phase === "fichier" ? 0 : phase === "colonnes" ? 1 : 2;

  return (
    <>
      <PageHeader
        title={t.import.title}
        description={t.import.description}
        actions={
          <Stepper
            steps={t.import.steps}
            current={stepIndex}
            onStepClick={
              phase === "analyse"
                ? undefined
                : (index) => {
                    if (index === 0) reset();
                    if (index === 1) setPhase("colonnes");
                  }
            }
          />
        }
      />

      {phase === "fichier" && (
        <div className="flex flex-col gap-5">
          {existingCount === 0 && <ImportWelcome onTrySample={trySample} loading={reading} />}
          <UploadZone onFileSelected={handleFile} loading={reading} error={fileError} accept=".csv,text/csv" />
          <CsvFormatCard />
          <CsvExampleCard href="/exemple-prospects.csv" />
        </div>
      )}

      {phase === "colonnes" && file && mapping && preview && (
        <MappingStep
          file={file}
          mapping={mapping}
          preview={preview}
          onChange={setMapping}
          onBack={reset}
          onNext={() => {
            saveMapping(file.headers, mapping);
            setPhase("reglages");
          }}
        />
      )}

      {(phase === "reglages" || phase === "analyse") && file && preview && (
        <SettingsStep
          rows={preview.rows}
          existingCount={existingCount}
          historyCount={historyCount}
          defaults={{
            ...defaults,
            panier: defaults.panier ?? (preview.averageAmount ? Math.round(preview.averageAmount / 100) * 100 : null),
          }}
          averageFromFile={preview.averageAmount}
          onBack={() => setPhase("colonnes")}
          onStart={() => setPhase("analyse")}
          onDone={(summary) => {
            toast.success(
              t.import.done(format.integer(summary.nbProspects), format.integer(summary.nbOublies), format.euro(summary.caRecuperable))
            );
            router.push("/tableau-de-bord");
            router.refresh();
          }}
          onFailed={() => setPhase("reglages")}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Étape 2 : association des colonnes
// ---------------------------------------------------------------------------

type MappingStepProps = {
  file: ParsedFile;
  mapping: ColumnMapping;
  preview: ReturnType<typeof buildImportRows>;
  onChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onNext: () => void;
};

function MappingStep({ file, mapping, preview, onChange, onBack, onNext }: MappingStepProps) {
  const t = useT();
  const format = useFormat();
  const missing = missingRequiredFields(mapping);
  const recognized = IMPORT_FIELDS.filter((field) => mapping[field.key]).length;
  const issues = [...preview.skipped, ...preview.warnings].sort((a, b) => a.line - b.line);

  const example = (key: ImportFieldKey) => {
    const column = mapping[key];
    if (!column) return null;
    return file.records.map((record) => record[column]?.trim()).find(Boolean) ?? null;
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-5">
        <CardTitle>{t.import.mapping.title}</CardTitle>
        <CardDescription>
          {t.import.mapping.summary(file.name, file.records.length, recognized, IMPORT_FIELDS.length)}
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[30%]">{t.import.mapping.field}</TableHead>
            <TableHead className="w-[35%]">{t.import.mapping.column}</TableHead>
            <TableHead>{t.import.mapping.example}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {IMPORT_FIELDS.map((field) => {
            const isMissing = field.required && !mapping[field.key];
            const sample = example(field.key);
            return (
              <TableRow key={field.key} className="hover:bg-transparent">
                <TableCell className="font-medium text-foreground">
                  {t.import.fields[field.key]}
                  {field.required && <span className="text-foreground-tertiary"> *</span>}
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping[field.key] ?? IGNORE}
                    onValueChange={(value) => onChange({ ...mapping, [field.key]: value === IGNORE ? null : value })}
                  >
                    <SelectTrigger
                      className={cn("w-full max-w-72", isMissing && "border-warning ring-[3px] ring-warning/15 aria-invalid:border-warning")}
                      aria-label={t.import.mapping.columnFor(t.import.fields[field.key])}
                      aria-invalid={isMissing || undefined}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>
                        {field.required ? t.import.mapping.choose : t.import.mapping.ignore}
                      </SelectItem>
                      {file.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="max-w-64 truncate">
                  {isMissing ? (
                    <span className="font-semibold text-warning">{t.import.mapping.required}</span>
                  ) : (
                    (sample ?? <span className="text-foreground-tertiary">—</span>)
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="border-t px-6 py-4">
        <p className="text-body text-foreground">
          <span className="font-semibold">{t.import.mapping.ready(preview.rows.length)}</span>
          {preview.skipped.length > 0 && <> · {t.import.mapping.skipped(preview.skipped.length)}</>}
          {preview.duplicates > 0 && <> · {t.import.mapping.duplicates(preview.duplicates)}</>}
        </p>
        {issues.length > 0 && (
          <details className="mt-2 text-dense text-foreground-secondary">
            <summary className="cursor-pointer select-none hover:text-foreground">
              {t.import.mapping.issues(issues.length)}
            </summary>
            <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
              {issues.slice(0, 50).map((issue, index) => (
                <li key={`${issue.line}-${index}`} className="flex gap-2">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    {t.import.mapping.line(issue.line, issue.message)}
                  </span>
                </li>
              ))}
              {issues.length > 50 && <li>{t.import.mapping.more(format.integer(issues.length - 50))}</li>}
            </ul>
          </details>
        )}
      </div>

      <CardFooter className="justify-between border-t pt-5">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeftIcon />
          {t.import.mapping.changeFile}
        </Button>
        <Button onClick={onNext} disabled={missing.length > 0 || preview.rows.length === 0}>
          {t.import.mapping.continue}
          <ArrowRightIcon />
        </Button>
      </CardFooter>
      {missing.length > 0 && (
        <p className="px-6 pb-5 text-right text-caption font-normal text-foreground-secondary">
          {t.import.mapping.missing(missing.map((key) => t.import.fields[key]).join(t.import.mapping.and))}
        </p>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Étape 3 : réglages et analyse
// ---------------------------------------------------------------------------

type SettingsStepProps = {
  rows: ReturnType<typeof buildImportRows>["rows"];
  existingCount: number;
  historyCount: number;
  defaults: ImportWizardProps["defaults"];
  averageFromFile: number | null;
  onBack: () => void;
  onStart: () => void;
  onDone: (summary: { nbProspects: number; nbOublies: number; caRecuperable: number }) => void;
  onFailed: () => void;
};

function SettingsStep({ rows, existingCount, historyCount, defaults, averageFromFile, onBack, onStart, onDone, onFailed }: SettingsStepProps) {
  const t = useT();
  const format = useFormat();
  const [seuil, setSeuil] = React.useState(String(defaults.seuil));
  const [panier, setPanier] = React.useState(defaults.panier === null ? "" : String(defaults.panier));
  const [ton, setTon] = React.useState<FollowupTone>(defaults.ton);
  const [signature, setSignature] = React.useState(defaults.signature);
  const [commission, setCommission] = React.useState(defaults.commission === null ? "" : String(defaults.commission).replace(".", ","));
  const [mode, setMode] = React.useState<"maj" | "remplacer">("maj");
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  // La suppression n'est possible qu'après avoir coché la case de l'avertissement.
  const [replaceAcknowledged, setReplaceAcknowledged] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resumeFrom = React.useRef<{ importId: string; batch: number } | null>(null);

  const seuilValue = Number(seuil);
  const seuilError = !Number.isInteger(seuilValue) || seuilValue < 1 || seuilValue > 365 ? t.import.settings.thresholdError : undefined;
  const panierValue = panier.trim() === "" ? null : Number(panier.replace(/\s/g, "").replace(",", "."));
  const panierError = panierValue !== null && (!Number.isFinite(panierValue) || panierValue < 0) ? t.import.settings.basketError : undefined;
  const commissionValue = commission.trim() === "" ? null : Number(commission.replace(/\s/g, "").replace(",", "."));
  const commissionError =
    commissionValue !== null && (!Number.isFinite(commissionValue) || commissionValue <= 0 || commissionValue > 100)
      ? t.import.settings.commissionError
      : undefined;
  const batches = Math.ceil(rows.length / BATCH_SIZE);

  async function run() {
    setError(null);
    onStart();
    try {
      let importId = resumeFrom.current?.importId;
      let firstBatch = resumeFrom.current?.batch ?? 0;
      if (!importId) {
        const started = await startImport(mode === "remplacer", mode === "remplacer" && replaceAcknowledged ? "supprimer-prospects-et-historique" : undefined);
        if (!started.ok) throw new Error(started.message);
        importId = started.importId;
        firstBatch = 0;
      }

      for (let batch = firstBatch; batch < batches; batch += 1) {
        setProgress({ done: batch * BATCH_SIZE, total: rows.length });
        resumeFrom.current = { importId, batch };
        const result = await importBatch(importId, rows.slice(batch * BATCH_SIZE, (batch + 1) * BATCH_SIZE));
        if (!result.ok) throw new Error(result.message);
      }
      setProgress({ done: rows.length, total: rows.length });

      const finished = await finishImport({ seuil: seuilValue, panier: panierValue, commission: commissionValue, ton, signature });
      if (!finished.ok) throw new Error(finished.message);
      resumeFrom.current = null;
      onDone(finished.summary);
    } catch (caught) {
      setProgress(null);
      setError(caught instanceof Error ? caught.message : t.import.settings.failed);
      onFailed();
    }
  }

  if (progress) {
    const percent = Math.round((progress.done / Math.max(progress.total, 1)) * 100);
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16 text-center" aria-live="polite">
          <p className="text-[16px] leading-6 font-semibold text-foreground">
            {progress.done < progress.total
              ? t.import.settings.importing(format.integer(progress.total))
              : t.import.settings.computing}
          </p>
          <Progress value={progress.done < progress.total ? percent : 100} className="h-2 w-full max-w-md" />
          <p className="text-dense text-foreground-secondary tabular-nums">
            {format.integer(progress.done)} / {format.integer(progress.total)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.import.settings.title}</CardTitle>
        <CardDescription>
          {t.import.settings.summary(rows.length)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-2.5 text-dense text-danger sm:col-span-2">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <Field
          label={t.import.settings.threshold}
          htmlFor="seuil"
          hint={t.import.settings.thresholdHint}
          error={seuilError}
        >
          <InputWithSuffix id="seuil" suffix={t.import.settings.days} inputMode="numeric" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
        </Field>
        <Field
          label={t.import.settings.basket}
          htmlFor="panier"
          hint={
            averageFromFile
              ? t.import.settings.basketHintAverage(format.euro(averageFromFile))
              : t.import.settings.basketHint
          }
          error={panierError}
        >
          <InputWithSuffix id="panier" suffix="€" inputMode="decimal" value={panier} onChange={(e) => setPanier(e.target.value)} />
        </Field>
        <Field
          label={t.import.settings.commission}
          htmlFor="commission"
          hint={t.import.settings.commissionHint}
          error={commissionError}
          className="sm:col-span-2 sm:max-w-[calc(50%-10px)]"
        >
          <InputWithSuffix
            id="commission"
            suffix="%"
            inputMode="decimal"
            placeholder={t.import.settings.commissionPlaceholder}
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-dense font-medium text-foreground">{t.import.settings.tone}</span>
          <ToggleGroup type="single" value={ton} onValueChange={(value) => value && setTon(value as FollowupTone)} aria-label={t.import.settings.tone}>
            {FOLLOWUP_TONES.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {t.enums.tone[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Field label={t.import.settings.signature} htmlFor="signature" hint={t.import.settings.signatureHint} className="sm:col-span-2">
          <Textarea id="signature" value={signature} maxLength={1000} onChange={(e) => setSignature(e.target.value)} placeholder={t.import.settings.signaturePlaceholder} />
        </Field>
        {existingCount > 0 && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-dense font-medium text-foreground">{t.import.settings.existing(format.integer(existingCount))}</span>
            <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as "maj" | "remplacer")} aria-label={t.import.settings.mode}>
              <ToggleGroupItem value="maj">{t.import.settings.update}</ToggleGroupItem>
              <ToggleGroupItem value="remplacer">{t.import.settings.replace}</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-caption font-normal text-foreground-tertiary">
              {mode === "maj"
                ? t.import.settings.updateHint
                : t.import.settings.replaceHint(format.integer(historyCount))}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between border-t pt-5">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeftIcon />
          {t.common.back}
        </Button>
        <Button
          disabled={Boolean(seuilError || panierError || commissionError)}
          onClick={() => {
            if (mode === "remplacer" && !resumeFrom.current) {
              setReplaceAcknowledged(false);
              setConfirmReplace(true);
            } else void run();
          }}
        >
          {resumeFrom.current ? t.import.settings.resume : t.import.settings.start}
          <ArrowRightIcon />
        </Button>
      </CardFooter>

      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t.import.settings.replaceTitle}</DialogTitle>
            <DialogDescription>
              {t.import.settings.replaceText(format.integer(existingCount), format.integer(rows.length))}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-dense text-foreground">
            <li>{t.import.settings.replaceLost.prospects(format.integer(existingCount))}</li>
            <li>{t.import.settings.replaceLost.history(format.integer(historyCount))}</li>
            <li>{t.import.settings.replaceLost.nextActions}</li>
          </ul>
          <p className="rounded-lg bg-warning-soft px-3.5 py-2.5 text-dense text-warning">{t.import.settings.replaceAdvice}</p>
          <label className="flex cursor-pointer items-start gap-2.5 text-dense text-foreground">
            <Checkbox checked={replaceAcknowledged} onCheckedChange={(value) => setReplaceAcknowledged(value === true)} className="mt-0.5" />
            {t.import.settings.replaceAcknowledge}
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{t.common.cancel}</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={!replaceAcknowledged}
              onClick={() => {
                setConfirmReplace(false);
                void run();
              }}
            >
              {t.import.settings.replaceConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
