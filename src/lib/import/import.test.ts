import { describe, expect, it } from "vitest";

import { parseAmount, parseDate, parseEmail, parsePhone, parseStage } from "./normalize";
import { readCsvFile } from "./read-file";
import { buildImportRows, guessMapping, missingRequiredFields, validateImportRow } from "./rows";

describe("parseAmount", () => {
  it.each([
    ["15000", 15000],
    ["15 000 €", 15000],
    ["15 000,50 €", 15000.5],
    ["15.000", 15000],
    ["15,000", 15000],
    ["$15,000.00", 15000],
    ["1.250.000,75", 1250000.75],
    ["12,5", 12.5],
    ["0,750", 0.75],
    ["EUR 9 800", 9800],
    ["1’250", 1250],
  ])("« %s » → %s", (raw, expected) => {
    expect(parseAmount(raw).value).toBe(expected);
  });

  it("vide → null sans erreur", () => {
    expect(parseAmount("  ")).toEqual({ value: null });
  });

  it("négatif ou illisible → null avec message", () => {
    expect(parseAmount("-500").error).toMatch(/négatif/);
    expect(parseAmount("à définir").error).toMatch(/illisible/);
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-09-04", "2026-09-04"],
    ["2026-09-04T10:30:00Z", "2026-09-04"],
    ["2026-09-04 10:30", "2026-09-04"],
    ["04/09/2026", "2026-09-04"],
    ["4/9/2026", "2026-09-04"],
    ["04-09-2026", "2026-09-04"],
    ["04.09.26", "2026-09-04"],
    ["09/24/2026", "2026-09-24"],
    ["4 sept. 2026", "2026-09-04"],
    ["12 septembre 2026", "2026-09-12"],
    ["Sep 4, 2026", "2026-09-04"],
    ["46269", "2026-09-04"],
  ])("« %s » → %s", (raw, expected) => {
    expect(parseDate(raw).value).toBe(expected);
  });

  it("dates impossibles refusées", () => {
    expect(parseDate("31/02/2026").value).toBeNull();
    expect(parseDate("31/02/2026").error).toBeDefined();
    expect(parseDate("hier").value).toBeNull();
    expect(parseDate("01/01/1970").value).toBeNull();
  });
});

describe("parseStage", () => {
  it.each([
    ["Proposition envoyée", "proposition"],
    ["Devis envoyé", "proposition"],
    ["Négociation", "negociation"],
    ["Contract sent", "negociation"],
    ["Closed Won", "gagne"],
    ["Gagné", "gagne"],
    ["Closed lost", "perdu"],
    ["Perdu", "perdu"],
    ["Qualifié", "qualification"],
    ["Rendez-vous planifié", "qualification"],
    ["Nouveau lead", "decouverte"],
  ])("« %s » → %s", (raw, expected) => {
    expect(parseStage(raw).etape).toBe(expected);
  });

  it("valeur inconnue conservée brute", () => {
    expect(parseStage("En attente du comité")).toEqual({ etape: null, brute: "En attente du comité" });
  });
});

describe("parseEmail / parsePhone", () => {
  it("normalise et valide l'email", () => {
    expect(parseEmail("  Claire@ACME.fr ").value).toBe("claire@acme.fr");
    expect(parseEmail("claire@acme").error).toBeDefined();
  });

  it("garde un téléphone plausible", () => {
    expect(parsePhone("06 12 34 56 78").value).toBe("06 12 34 56 78");
    expect(parsePhone("+33 (0)6 12 34 56 78").value).toBe("+33 (0)6 12 34 56 78");
    expect(parsePhone("n/a").error).toBeDefined();
  });
});

describe("guessMapping", () => {
  it("reconnaît les colonnes du CSV classique demandé", () => {
    const mapping = guessMapping([
      "Entreprise", "Contact", "Email", "Téléphone", "Montant", "Date dernier contact", "Statut", "Notes",
    ]);
    expect(mapping).toEqual({
      entreprise: "Entreprise",
      contact: "Contact",
      email: "Email",
      telephone: "Téléphone",
      montant: "Montant",
      dernier_contact: "Date dernier contact",
      statut: "Statut",
      notes: "Notes",
    });
    expect(missingRequiredFields(mapping)).toEqual([]);
  });

  it("reconnaît un export HubSpot en anglais", () => {
    const mapping = guessMapping(["Deal Name", "Company name", "Amount", "Deal Stage", "Last Activity Date", "Contact email"]);
    expect(mapping.entreprise).toBe("Company name");
    expect(mapping.montant).toBe("Amount");
    expect(mapping.statut).toBe("Deal Stage");
    expect(mapping.dernier_contact).toBe("Last Activity Date");
    expect(mapping.email).toBe("Contact email");
  });

  it("signale les champs obligatoires manquants", () => {
    expect(missingRequiredFields(guessMapping(["Société", "Montant"]))).toEqual(["dernier_contact"]);
  });

  it("n'associe pas une même colonne à deux champs", () => {
    const mapping = guessMapping(["Nom", "Email"]);
    expect(mapping.contact).toBe("Nom");
    expect(mapping.entreprise).toBeNull();
  });
});

describe("buildImportRows", () => {
  const headers = ["entreprise", "contact", "email", "téléphone", "montant", "date dernier contact", "statut", "notes"];
  const record = (values: string[]) => Object.fromEntries(headers.map((header, i) => [header, values[i] ?? ""]));
  const mapping = guessMapping(headers);

  it("construit les lignes, écarte celles sans entreprise et dédoublonne", () => {
    const preview = buildImportRows(
      [
        record(["Acme SAS", "Claire Martin", "claire@acme.fr", "06 12 34 56 78", "15 000 €", "04/09/2026", "Proposition", "Budget Q4"]),
        record(["", "Sans entreprise", "x@y.fr"]),
        record(["Acme SAS", "Claire Martin", "CLAIRE@acme.fr", "", "16 000", "10/09/2026", "Négociation", ""]),
        record(["Brio", "", "pas-un-email", "", "beaucoup", "hier", "Inconnu", ""]),
      ],
      mapping
    );

    expect(preview.rows).toHaveLength(2);
    expect(preview.duplicates).toBe(1);
    expect(preview.skipped).toEqual([{ line: 3, message: "Entreprise manquante : ligne ignorée" }]);
    expect(preview.warnings.map((w) => w.line)).toEqual([5, 5, 5]);

    const acme = preview.rows.find((row) => row.entreprise === "Acme SAS");
    expect(acme).toMatchObject({
      contact_email: "claire@acme.fr",
      montant_eur: 16000,
      date_dernier_contact: "2026-09-10",
      etape: "negociation",
      etape_brute: "Négociation",
    });
    expect(acme?.donnees_brutes.montant).toBe("16 000");
    expect(preview.averageAmount).toBe(16000);
  });

  it("produit des lignes que le serveur accepte, et le serveur refuse les lignes falsifiées", () => {
    const [row] = buildImportRows([record(["Acme SAS", "", "claire@acme.fr", "", "15000", "2026-09-04", "Devis", ""])], mapping).rows;
    expect(validateImportRow(row)).toEqual(row);
    expect(validateImportRow({ ...row, entreprise: "" })).toBeNull();
    expect(validateImportRow({ ...row, montant_eur: -1 })).toBeNull();
    expect(validateImportRow({ ...row, etape: "inventee" })).toBeNull();
    expect(validateImportRow({ ...row, date_dernier_contact: "2026-02-31" })).toBeNull();
    expect(validateImportRow({ ...row, contact_email: "pas-un-email" })).toBeNull();
    expect(validateImportRow({ ...row, donnees_brutes: { x: 1 } })).toBeNull();
    expect(validateImportRow("n'importe quoi")).toBeNull();
  });
});

describe("readCsvFile", () => {
  const asFile = (content: BlobPart, name = "prospects.csv") => new File([content], name, { type: "text/csv" });

  it("lit le fichier d'exemple fourni et reconnaît toutes les colonnes", async () => {
    const { readFileSync } = await import("node:fs");
    const parsed = await readCsvFile(asFile(readFileSync("public/exemple-prospects.csv"), "exemple-prospects.csv"));
    const mapping = guessMapping(parsed.headers);
    expect(missingRequiredFields(mapping)).toEqual([]);
    const preview = buildImportRows(parsed.records, mapping);
    expect(preview.rows).toHaveLength(5);
    expect(preview.warnings).toEqual([]);
    expect(preview.rows.map((row) => row.etape)).toEqual(["proposition", "negociation", "proposition", "qualification", "gagne"]);
  });

  it("lit un export Excel français (point-virgule, Windows-1252, BOM absent)", async () => {
    const text = "Société;Téléphone;Montant;Date dernier contact\r\nÉtoile Créations;01 23 45 67 89;1 500,50;03/08/2026\r\n";
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0)));
    const parsed = await readCsvFile(asFile(bytes));
    expect(parsed.headers).toEqual(["Société", "Téléphone", "Montant", "Date dernier contact"]);
    const [row] = buildImportRows(parsed.records, guessMapping(parsed.headers)).rows;
    expect(row).toMatchObject({ entreprise: "Étoile Créations", montant_eur: 1500.5, date_dernier_contact: "2026-08-03" });
  });

  it("gère le BOM UTF-8 et les champs entre guillemets sur plusieurs lignes", async () => {
    const parsed = await readCsvFile(asFile('﻿entreprise,notes,date dernier contact\n"Acme, SAS","Ligne 1\nLigne 2",2026-09-04\n'));
    expect(parsed.headers[0]).toBe("entreprise");
    expect(parsed.records[0]).toMatchObject({ entreprise: "Acme, SAS", notes: "Ligne 1\nLigne 2" });
  });

  it("refuse les fichiers vides, sans données ou non CSV", async () => {
    await expect(readCsvFile(asFile(""))).rejects.toThrow(/vide/);
    await expect(readCsvFile(asFile("entreprise,contact\n"))).rejects.toThrow(/aucune ligne/);
    await expect(readCsvFile(asFile("x", "export.xlsx"))).rejects.toThrow(/Excel ne sont pas acceptés/);
    await expect(readCsvFile(asFile("x", "rapport.pdf"))).rejects.toThrow(/pas un CSV/);
  });
});

describe("jeu d'exemple de l'onboarding", () => {
  it("passe l'import sans erreur, avec des dates relatives à aujourd'hui", async () => {
    const { buildSampleCsv } = await import("./sample");
    const Papa = (await import("papaparse")).default;
    const csv = buildSampleCsv(new Date(2026, 9, 8));
    const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
    const headers = parsed.meta.fields ?? [];
    const { buildImportRows, guessMapping } = await import("./rows");
    const result = buildImportRows(parsed.data, guessMapping(headers));
    expect(result.rows).toHaveLength(14);
    expect(result.rows.find((row) => row.entreprise === "Nordwind GmbH")?.date_dernier_contact).toBe("2026-09-12");
  });
});
