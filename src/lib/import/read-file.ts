import Papa from "papaparse";

import { MAX_FILE_BYTES, MAX_ROWS } from "./fields";

export type ParsedFile = {
  name: string;
  headers: string[];
  records: Record<string, string>[];
};

export class ImportFileError extends Error {}

/**
 * Lit un CSV dans le navigateur : séparateur détecté (« , », « ; », tabulation, « | »),
 * encodage UTF-8 ou Windows-1252 (exports Excel français), BOM ignoré.
 */
export async function readCsvFile(file: File): Promise<ParsedFile> {
  // L'extension prime sur le type annoncé par le navigateur, souvent approximatif.
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const looksLikeCsv = extension ? ["csv", "txt"].includes(extension) : /csv|text\/plain/.test(file.type);
  if (!looksLikeCsv) {
    throw new ImportFileError(
      extension === "xlsx" || extension === "xls"
        ? "Les fichiers Excel ne sont pas acceptés : dans Excel, utilisez Fichier > Enregistrer sous > CSV."
        : "Ce fichier n'est pas un CSV. Exportez vos prospects au format CSV depuis votre CRM ou Excel."
    );
  }
  if (file.size === 0) throw new ImportFileError("Le fichier est vide.");
  if (file.size > MAX_FILE_BYTES) throw new ImportFileError("Le fichier dépasse 10 Mo.");

  const buffer = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }
  text = text.replace(/^﻿/, "");

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
    transformHeader: (header) => header.trim(),
  });

  const headers = (result.meta.fields ?? []).filter((header) => header.length > 0);
  if (headers.length < 2) {
    throw new ImportFileError("Le fichier doit contenir une ligne d'en-têtes et au moins 2 colonnes.");
  }
  const records = result.data.filter((record) => Object.values(record).some((value) => value?.trim()));
  if (records.length === 0) throw new ImportFileError("Le fichier ne contient aucune ligne de données.");
  if (records.length > MAX_ROWS) {
    throw new ImportFileError(`Le fichier contient ${records.length} lignes : la limite est de ${MAX_ROWS} par import.`);
  }

  return { name: file.name, headers, records };
}
