"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";

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
import { formatEuro, formatInteger } from "@/lib/format";
import { BATCH_SIZE, IMPORT_FIELDS, type ColumnMapping, type ImportFieldKey } from "@/lib/import/fields";
import { ImportFileError, readCsvFile, type ParsedFile } from "@/lib/import/read-file";
import { buildImportRows, guessMapping, missingRequiredFields } from "@/lib/import/rows";
import { buildSampleCsv, SAMPLE_FILE_NAME } from "@/lib/import/sample";
import { FOLLOWUP_TONES, TONE_LABELS, type FollowupTone } from "@/lib/prospects";

import { finishImport, importBatch, startImport } from "./actions";

const STEPS = ["Fichier", "Colonnes", "Réglages"];

function plural(count: number, singular: string, pluralForm: string) {
  return `${formatInteger(count)} ${count > 1 ? pluralForm : singular}`;
}
const IGNORE = "__ignorer__";
const MAPPING_STORAGE_PREFIX = "leadpilot:import-mapping:";

type ImportWizardProps = {
  existingCount: number;
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

export function ImportWizard({ existingCount, defaults }: ImportWizardProps) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("fichier");
  const [file, setFile] = React.useState<ParsedFile | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [mapping, setMapping] = React.useState<ColumnMapping | null>(null);

  const preview = React.useMemo(
    () => (file && mapping ? buildImportRows(file.records, mapping) : null),
    [file, mapping]
  );

  async function handleFile(selected: File) {
    setReading(true);
    setFileError(null);
    try {
      const parsed = await readCsvFile(selected);
      setFile(parsed);
      setMapping(loadSavedMapping(parsed.headers) ?? guessMapping(parsed.headers));
      setPhase("colonnes");
    } catch (error) {
      setFileError(error instanceof ImportFileError ? error.message : "Le fichier n'a pas pu être lu.");
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
        title="Importer des prospects"
        description="Importez votre liste de prospects depuis un fichier CSV"
        actions={
          <Stepper
            steps={STEPS}
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
          defaults={{
            ...defaults,
            panier: defaults.panier ?? (preview.averageAmount ? Math.round(preview.averageAmount / 100) * 100 : null),
          }}
          averageFromFile={preview.averageAmount}
          onBack={() => setPhase("colonnes")}
          onStart={() => setPhase("analyse")}
          onDone={(summary) => {
            toast.success(
              `${formatInteger(summary.nbProspects)} prospects analysés · ${formatInteger(summary.nbOublies)} oubliés · ${formatEuro(summary.caRecuperable)} récupérables`
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
        <CardTitle>Associer les colonnes</CardTitle>
        <CardDescription>
          {file.name} · {plural(file.records.length, "ligne", "lignes")}. {plural(recognized, "champ reconnu", "champs reconnus")} sur {IMPORT_FIELDS.length} :
          vérifiez avant de continuer.
        </CardDescription>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="h-10 hover:bg-transparent">
            <TableHead className="w-[30%]">Champ</TableHead>
            <TableHead className="w-[35%]">Colonne de votre fichier</TableHead>
            <TableHead>Exemple</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {IMPORT_FIELDS.map((field) => {
            const isMissing = field.required && !mapping[field.key];
            const sample = example(field.key);
            return (
              <TableRow key={field.key} className="hover:bg-transparent">
                <TableCell className="font-medium text-foreground">
                  {field.label}
                  {field.required && <span className="text-foreground-tertiary"> *</span>}
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping[field.key] ?? IGNORE}
                    onValueChange={(value) => onChange({ ...mapping, [field.key]: value === IGNORE ? null : value })}
                  >
                    <SelectTrigger
                      className={cn("w-full max-w-72", isMissing && "border-warning ring-[3px] ring-warning/15 aria-invalid:border-warning")}
                      aria-label={`Colonne pour ${field.label}`}
                      aria-invalid={isMissing || undefined}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE}>
                        {field.required ? "Choisir une colonne" : "Ignorer"}
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
                    <span className="font-semibold text-warning">Obligatoire</span>
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
          <span className="font-semibold">{plural(preview.rows.length, "prospect prêt", "prospects prêts")} à importer</span>
          {preview.skipped.length > 0 && <> · {plural(preview.skipped.length, "ligne ignorée", "lignes ignorées")}</>}
          {preview.duplicates > 0 && <> · {plural(preview.duplicates, "doublon fusionné", "doublons fusionnés")}</>}
        </p>
        {issues.length > 0 && (
          <details className="mt-2 text-dense text-foreground-secondary">
            <summary className="cursor-pointer select-none hover:text-foreground">
              {plural(issues.length, "remarque", "remarques")} sur le contenu du fichier
            </summary>
            <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
              {issues.slice(0, 50).map((issue, index) => (
                <li key={`${issue.line}-${index}`} className="flex gap-2">
                  <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                  <span>
                    Ligne {issue.line} : {issue.message}
                  </span>
                </li>
              ))}
              {issues.length > 50 && <li>… et {formatInteger(issues.length - 50)} autres</li>}
            </ul>
          </details>
        )}
      </div>

      <CardFooter className="justify-between border-t pt-5">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeftIcon />
          Changer de fichier
        </Button>
        <Button onClick={onNext} disabled={missing.length > 0 || preview.rows.length === 0}>
          Continuer
          <ArrowRightIcon />
        </Button>
      </CardFooter>
      {missing.length > 0 && (
        <p className="px-6 pb-5 text-right text-caption font-normal text-foreground-secondary">
          Associez {missing.map((key) => IMPORT_FIELDS.find((field) => field.key === key)!.label).join(" et ")} pour continuer.
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
  defaults: ImportWizardProps["defaults"];
  averageFromFile: number | null;
  onBack: () => void;
  onStart: () => void;
  onDone: (summary: { nbProspects: number; nbOublies: number; caRecuperable: number }) => void;
  onFailed: () => void;
};

function SettingsStep({ rows, existingCount, defaults, averageFromFile, onBack, onStart, onDone, onFailed }: SettingsStepProps) {
  const [seuil, setSeuil] = React.useState(String(defaults.seuil));
  const [panier, setPanier] = React.useState(defaults.panier === null ? "" : String(defaults.panier));
  const [ton, setTon] = React.useState<FollowupTone>(defaults.ton);
  const [signature, setSignature] = React.useState(defaults.signature);
  const [commission, setCommission] = React.useState(defaults.commission === null ? "" : String(defaults.commission).replace(".", ","));
  const [mode, setMode] = React.useState<"maj" | "remplacer">("maj");
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const resumeFrom = React.useRef<{ importId: string; batch: number } | null>(null);

  const seuilValue = Number(seuil);
  const seuilError = !Number.isInteger(seuilValue) || seuilValue < 1 || seuilValue > 365 ? "Entre 1 et 365 jours" : undefined;
  const panierValue = panier.trim() === "" ? null : Number(panier.replace(/\s/g, "").replace(",", "."));
  const panierError = panierValue !== null && (!Number.isFinite(panierValue) || panierValue < 0) ? "Montant invalide" : undefined;
  const commissionValue = commission.trim() === "" ? null : Number(commission.replace(/\s/g, "").replace(",", "."));
  const commissionError =
    commissionValue !== null && (!Number.isFinite(commissionValue) || commissionValue <= 0 || commissionValue > 100)
      ? "Entre 0,01 et 100 %"
      : undefined;
  const batches = Math.ceil(rows.length / BATCH_SIZE);

  async function run() {
    setError(null);
    onStart();
    try {
      let importId = resumeFrom.current?.importId;
      let firstBatch = resumeFrom.current?.batch ?? 0;
      if (!importId) {
        const started = await startImport(mode === "remplacer");
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
      setError(caught instanceof Error ? caught.message : "L'import a échoué.");
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
              ? `Import de ${formatInteger(progress.total)} prospects…`
              : "Calcul des opportunités à relancer et de l'argent récupérable…"}
          </p>
          <Progress value={progress.done < progress.total ? percent : 100} className="h-2 w-full max-w-md" />
          <p className="text-dense text-foreground-secondary tabular-nums">
            {formatInteger(progress.done)} / {formatInteger(progress.total)}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réglages de l&apos;analyse</CardTitle>
        <CardDescription>
          {plural(rows.length, "prospect sera analysé", "prospects seront analysés")}. Ces réglages s&apos;appliquent à tout votre compte.
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
          label="Seuil d'oubli"
          htmlFor="seuil"
          hint="Au-delà, une affaire ouverte sans contact est considérée comme oubliée."
          error={seuilError}
        >
          <InputWithSuffix id="seuil" suffix="jours" inputMode="numeric" value={seuil} onChange={(e) => setSeuil(e.target.value)} />
        </Field>
        <Field
          label="Panier moyen"
          htmlFor="panier"
          hint={
            averageFromFile
              ? `Utilisé quand le montant est vide. Moyenne de votre fichier : ${formatEuro(averageFromFile)}.`
              : "Utilisé quand le montant est vide."
          }
          error={panierError}
        >
          <InputWithSuffix id="panier" suffix="€" inputMode="decimal" value={panier} onChange={(e) => setPanier(e.target.value)} />
        </Field>
        <Field
          label="Taux de commission (facultatif)"
          htmlFor="commission"
          hint="Affiche votre commission potentielle sur l'argent récupérable."
          error={commissionError}
          className="sm:col-span-2 sm:max-w-[calc(50%-10px)]"
        >
          <InputWithSuffix
            id="commission"
            suffix="%"
            inputMode="decimal"
            placeholder="Ex. 4"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-dense font-medium text-foreground">Ton des relances</span>
          <ToggleGroup type="single" value={ton} onValueChange={(value) => value && setTon(value as FollowupTone)} aria-label="Ton des relances">
            {FOLLOWUP_TONES.map((value) => (
              <ToggleGroupItem key={value} value={value}>
                {TONE_LABELS[value]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Field label="Signature" htmlFor="signature" hint="Ajoutée à la fin de chaque relance." className="sm:col-span-2">
          <Textarea id="signature" value={signature} maxLength={1000} onChange={(e) => setSignature(e.target.value)} placeholder={"Paul Durand · Ventes\n06 12 34 56 78"} />
        </Field>
        {existingCount > 0 && (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-dense font-medium text-foreground">Vos {formatInteger(existingCount)} prospects existants</span>
            <ToggleGroup type="single" value={mode} onValueChange={(value) => value && setMode(value as "maj" | "remplacer")} aria-label="Mode d'import">
              <ToggleGroupItem value="maj">Mettre à jour</ToggleGroupItem>
              <ToggleGroupItem value="remplacer">Remplacer toutes les données</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-caption font-normal text-foreground-tertiary">
              {mode === "maj"
                ? "Les prospects déjà présents sont mis à jour ; leurs statuts et relances sont conservés."
                : "Tous vos prospects actuels et leurs relances seront supprimés avant l'import."}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between border-t pt-5">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeftIcon />
          Retour
        </Button>
        <Button
          disabled={Boolean(seuilError || panierError || commissionError)}
          onClick={() => (mode === "remplacer" && !resumeFrom.current ? setConfirmReplace(true) : void run())}
        >
          {resumeFrom.current ? "Reprendre l'import" : "Lancer l'analyse"}
          <ArrowRightIcon />
        </Button>
      </CardFooter>

      <Dialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remplacer toutes les données ?</DialogTitle>
            <DialogDescription>
              Vos {formatInteger(existingCount)} prospects actuels, leurs statuts et leurs relances seront définitivement
              supprimés, puis remplacés par les {formatInteger(rows.length)} prospects de ce fichier.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmReplace(false);
                void run();
              }}
            >
              Remplacer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
