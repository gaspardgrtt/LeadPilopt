import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { normalizeLabel } from "./normalize";
import { readCsvFile } from "./read-file";
import { analyzeColumns, buildImportRows, guessMapping, importKey, missingRequiredFields, validateImportRow } from "./rows";
import type { ImportFieldKey } from "./fields";

const TODAY = new Date("2026-10-10T12:00:00Z");
const records = (headers: string[], rows: string[][]) =>
  rows.map((values) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""])));

describe("normalisation des en-têtes", () => {
  it.each([
    ["Date_Dernier-Contact", "date dernier contact"],
    ["  E-MAIL ", "e mail"],
    ["TÉLÉPHONE", "telephone"],
    ["Société", "societe"],
    ["nom_complet", "nom complet"],
    ["Prénom", "prenom"],
    ["﻿nom", "nom"],
  ])("« %s » → « %s »", (raw, expected) => {
    expect(normalizeLabel(raw)).toBe(expected);
  });
});

describe("détection des correspondances", () => {
  it.each<[string, ImportFieldKey]>([
    ["nom_complet", "contact"],
    ["contact", "contact"],
    ["full_name", "contact"],
    ["Full Name", "contact"],
    ["entreprise", "entreprise"],
    ["societe", "entreprise"],
    ["Société", "entreprise"],
    ["company", "entreprise"],
    ["organization", "entreprise"],
    ["email", "email"],
    ["e-mail", "email"],
    ["E_Mail", "email"],
    ["courriel", "email"],
    ["telephone", "telephone"],
    ["Téléphone", "telephone"],
    ["tel", "telephone"],
    ["phone", "telephone"],
    ["mobile", "telephone"],
    ["montant", "montant"],
    ["budget", "montant"],
    ["valeur", "montant"],
    ["amount", "montant"],
    ["value", "montant"],
    ["dernier_contact", "dernier_contact"],
    ["date_dernier_contact", "dernier_contact"],
    ["last_contact", "dernier_contact"],
    ["last_contact_date", "dernier_contact"],
    ["lastContactDate", "dernier_contact"],
    ["Last-Contact Date", "dernier_contact"],
    ["statut", "statut"],
    ["status", "statut"],
    ["stage", "statut"],
    ["notes", "notes"],
    ["commentaires", "notes"],
    ["description", "notes"],
    ["prenom", "prenom"],
    ["first_name", "prenom"],
    ["last_name", "nom"],
  ])("« %s » → %s", (header, field) => {
    expect(guessMapping([header, "colonne_inconnue"])[field]).toBe(header);
  });

  it("fichier de l'agence : prénom et nom séparés, aucune entreprise", () => {
    const { mapping, suggestions } = analyzeColumns(["nom", "prenom", "email", "telephone", "dernier_contact", "notes"]);
    expect(mapping).toEqual({
      entreprise: null,
      contact: null,
      prenom: "prenom",
      nom: "nom",
      email: "email",
      telephone: "telephone",
      montant: null,
      dernier_contact: "dernier_contact",
      statut: null,
      notes: "notes",
    });
    expect(suggestions).toEqual({});
    expect(missingRequiredFields(mapping)).toEqual([]);
  });

  it("« nom » n'est jamais associé à l'entreprise", () => {
    for (const headers of [["nom", "email"], ["Nom", "prenom"], ["nom", "dernier_contact"], ["NOM", "entreprise_cliente"]]) {
      const { mapping, suggestions } = analyzeColumns(headers);
      expect(mapping.entreprise ?? "").not.toMatch(/^nom$/i);
      expect(suggestions.entreprise ?? "").not.toMatch(/^nom$/i);
    }
  });

  it("« nom » seul est ambigu : proposé comme nom du contact, à confirmer", () => {
    const { mapping, suggestions } = analyzeColumns(["nom", "email", "dernier_contact"]);
    expect(mapping.contact).toBeNull();
    expect(mapping.nom).toBeNull();
    expect(suggestions.contact).toBe("nom");
    expect(missingRequiredFields(mapping)).toEqual(["identite"]);
  });

  it("un nom complet existant prime, sans perdre le prénom ni le nom", () => {
    const mapping = guessMapping(["nom_complet", "prenom", "nom", "dernier_contact"]);
    expect(mapping).toMatchObject({ contact: "nom_complet", prenom: "prenom", nom: "nom" });
  });

  it("un en-tête ambigu reste une suggestion", () => {
    const { mapping, suggestions } = analyzeColumns(["Client", "Date", "Estimation"]);
    expect(mapping.dernier_contact).toBeNull();
    expect(suggestions.dernier_contact).toBe("Date");
    expect(mapping.montant).toBeNull();
    expect(suggestions.montant).toBe("Estimation");
    expect(mapping.contact).toBeNull();
    expect(suggestions.contact).toBe("Client");
  });

  it("une colonne dont les valeurs ne correspondent pas à l'en-tête n'est pas présentée comme sûre", () => {
    const headers = ["contact", "dernier_contact", "email"];
    const rows = records(headers, [
      ["Jean Martin", "à rappeler", "jean@example.com"],
      ["Sophie Bernard", "voir notes", "sophie@example.com"],
    ]);
    const { mapping, suggestions } = analyzeColumns(headers, rows);
    expect(mapping.dernier_contact).toBeNull();
    expect(suggestions.dernier_contact).toBe("dernier_contact");
    expect(mapping.email).toBe("email");
  });

  it("des valeurs d'e-mails ou de dates sous un en-tête inconnu donnent une suggestion", () => {
    const headers = ["contact", "adr", "quand"];
    const rows = records(headers, [
      ["Jean Martin", "jean@example.com", "18/09/2026"],
      ["Sophie Bernard", "sophie@example.com", "22/08/2026"],
    ]);
    const { mapping, suggestions } = analyzeColumns(headers, rows);
    expect(mapping.email).toBeNull();
    expect(suggestions).toMatchObject({ email: "adr", dernier_contact: "quand" });
  });

  it("une même colonne n'est jamais associée ni suggérée pour deux champs", () => {
    const { mapping, suggestions } = analyzeColumns(["Client", "Contact principal", "Date"]);
    const columns = [...Object.values(mapping).filter(Boolean), ...Object.values(suggestions)];
    expect(new Set(columns).size).toBe(columns.length);
  });
});

describe("construction des lignes", () => {
  const headers = ["nom", "prenom", "email", "telephone", "dernier_contact", "notes"];
  const mapping = guessMapping(headers);
  const build = (rows: string[][]) => buildImportRows(records(headers, rows), mapping, "fr", TODAY);

  it("reconstruit le contact complet sans perdre le prénom ni le nom", () => {
    const { rows, skipped } = build([
      ["Martin", "Jean", "jean.martin@example.com", "0600000001", "2026-09-18", "Acheteur"],
      ["Bernard", "", "", "0600000002", "2026-08-22", ""],
      ["", "Lucas", "lucas@example.com", "", "2026-10-06", ""],
    ]);
    expect(skipped).toEqual([]);
    expect(rows.map((row) => row.contact_nom)).toEqual(["Jean Martin", "Bernard", "Lucas"]);
    expect(rows[0].entreprise).toBeNull();
    expect(rows[0].donnees_brutes).toMatchObject({ nom: "Martin", prenom: "Jean" });
  });

  it("montant et statut absents : l'import n'est pas bloqué, les valeurs restent vides", () => {
    const { rows, warnings } = build([["Martin", "Jean", "jean@example.com", "0600000001", "2026-09-18", ""]]);
    expect(rows[0]).toMatchObject({ montant_eur: null, etape: null, etape_brute: null, notes: null });
    expect(warnings).toEqual([]);
  });

  it("dates : reconnues, absentes, illisibles ou dans le futur", () => {
    const { rows, warnings } = build([
      ["A", "Jean", "a@example.com", "", "18/09/2026", ""],
      ["B", "Jean", "b@example.com", "", "", ""],
      ["C", "Jean", "c@example.com", "", "la semaine dernière", ""],
      ["D", "Jean", "d@example.com", "", "2026-12-24", ""],
    ]);
    expect(rows.map((row) => row.date_dernier_contact)).toEqual(["2026-09-18", null, null, null]);
    expect(warnings.map((w) => [w.line, w.message.split(" :")[0]])).toEqual([
      [3, "Date du dernier contact absente"],
      [4, "Date illisible"],
      [5, "Date du dernier contact dans le futur ignorée"],
    ]);
  });

  it("aucune colonne d'identité associée : aucune ligne n'est déclarée invalide à tort", () => {
    const partial = { ...mapping, nom: null, prenom: null };
    const preview = buildImportRows(records(headers, [["Martin", "Jean", "a@example.com", "", "2026-09-18", ""]]), partial, "fr", TODAY);
    expect(preview).toMatchObject({ lines: 1, rows: [], skipped: [] });
    expect(missingRequiredFields(partial)).toEqual(["identite"]);
  });

  it("ligne sans nom ni entreprise : signalée comme invalide", () => {
    const { rows, skipped } = build([["", "", "anonyme@example.com", "", "2026-09-18", "?"]]);
    expect(rows).toEqual([]);
    expect(skipped).toEqual([{ line: 2, message: "Ni nom du contact ni entreprise : ligne ignorée" }]);
  });

  it("doublons : même contact fusionné et signalé, couple ou homonymes conservés", () => {
    const preview = build([
      ["Martin", "Jean", "jean.martin@example.com", "", "2026-09-01", "v1"],
      ["MARTIN", "Jean", "Jean.Martin@example.com", "", "2026-09-18", "v2"],
      ["Martin", "Marie", "jean.martin@example.com", "", "2026-09-18", "même adresse"],
      ["Petit", "Lucas", "", "0600000003", "2026-09-18", ""],
      ["Petit", "Lucas", "", "0600000099", "2026-09-18", "homonyme"],
    ]);
    expect(preview.rows).toHaveLength(4);
    expect(preview.duplicates).toBe(1);
    expect(preview.rows.find((row) => row.contact_nom === "Jean MARTIN")?.notes).toBe("v2");
    expect(preview.warnings).toContainEqual({ line: 3, message: expect.stringContaining("Doublon de la ligne 2") });
    expect(new Set(preview.rows.map(importKey)).size).toBe(4);
  });

  it("le serveur accepte un particulier sans entreprise, et refuse une ligne sans nom ni entreprise", () => {
    const [row] = build([["Martin", "Jean", "jean@example.com", "", "2026-09-18", ""]]).rows;
    expect(validateImportRow(row)).toEqual(row);
    expect(validateImportRow({ ...row, contact_nom: null })).toBeNull();
    expect(validateImportRow({ ...row, contact_nom: "   " })).toBeNull();
    expect(validateImportRow({ ...row, contact_nom: null, entreprise: "Agence Dupont" })).not.toBeNull();
  });
});

describe("fichier de démonstration izmo_test_prospects_agence.csv", () => {
  const content = readFileSync(new URL("./__fixtures__/izmo_test_prospects_agence.csv", import.meta.url));

  it("importe les 40 prospects sans perte ni erreur", async () => {
    const file = await readCsvFile(new File([content], "izmo_test_prospects_agence.csv", { type: "text/csv" }));
    expect(file.headers).toEqual(["nom", "prenom", "email", "telephone", "dernier_contact", "notes"]);
    expect(file.records).toHaveLength(40);

    const { mapping, suggestions } = analyzeColumns(file.headers, file.records);
    expect(mapping.entreprise).toBeNull();
    expect(suggestions.entreprise).toBeUndefined();
    expect(missingRequiredFields(mapping)).toEqual([]);

    const preview = buildImportRows(file.records, mapping, "fr", TODAY);
    expect(preview).toMatchObject({ lines: 40, skipped: [], warnings: [], duplicates: 0, linesWithWarnings: 0 });
    expect(preview.rows).toHaveLength(40);

    preview.rows.forEach((row, i) => {
      const source = file.records[i];
      expect(row.contact_nom).toBe(`${source.prenom} ${source.nom}`);
      expect(row.entreprise).toBeNull();
      expect(row.contact_email).toBe(source.email);
      expect(row.contact_telephone).toBe(source.telephone);
      expect(row.date_dernier_contact).toBe(source.dernier_contact);
      expect(row.notes).toBe(source.notes);
      expect(row.montant_eur).toBeNull();
      expect(row.etape).toBeNull();
      expect(row.donnees_brutes).toMatchObject({ nom: source.nom, prenom: source.prenom });
      expect(validateImportRow(row)).toEqual(row);
    });
    expect(new Set(preview.rows.map(importKey)).size).toBe(40);
  });
});
