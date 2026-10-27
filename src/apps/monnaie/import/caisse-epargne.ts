// Parser of the Caisse d'Épargne CSV export ("Télécharger mes opérations"), current account and livrets alike.
// Columns: Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;
// Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
// The file is Windows-1252 encoded, with ";" separators, French decimals ("-10,00", "+14,75") and dd/mm/yyyy dates.

import { BankFileError, frenchDate, linesOf, operationIds, splitLine, toCents } from "./csv";
import type { BankOperation } from "./types";

export const CAISSE_EPARGNE_HEADER = ["Date de comptabilisation", "Libelle simplifie", "Libelle operation"];

export function parseCaisseEpargneCsv(text: string): BankOperation[] {
  const lines = linesOf(text);
  const header = splitLine(lines[0] ?? "", ";");
  if (!CAISSE_EPARGNE_HEADER.every((h, i) => header[i] === h)) {
    throw new BankFileError("Fichier non reconnu : il faut l'export CSV des opérations de la Caisse d'Épargne.");
  }
  const at = (cells: string[], name: string) => cells[header.indexOf(name)] ?? "";

  const rows = lines.slice(1).flatMap((line) => {
    const cells = splitLine(line, ";");
    const bookedDate = frenchDate(at(cells, "Date de comptabilisation"));
    const date = frenchDate(at(cells, "Date operation")) ?? bookedDate;
    const amount = toCents(at(cells, "Debit")) ?? toCents(at(cells, "Credit"));
    if (!date || !bookedDate || amount === undefined || amount === 0) return [];
    const fullLabel = at(cells, "Libelle operation");
    const key = [at(cells, "Date de comptabilisation"), fullLabel, amount, at(cells, "Reference")].join("|");
    return [{ cells, key, date, bookedDate, amount, fullLabel }];
  });
  const ids = operationIds("ce", rows.map((r) => r.key), 24);
  const operations = rows.map(({ cells, date, bookedDate, amount, fullLabel }, i) => ({
    importId: ids[i],
    date,
    bookedDate,
    label: at(cells, "Libelle simplifie") || fullLabel,
    detail: [fullLabel, at(cells, "Informations complementaires")].filter(Boolean).join(" · "),
    amount,
    type: at(cells, "Type operation"),
    bankCategory: at(cells, "Categorie"),
    bankSubcategory: at(cells, "Sous categorie"),
  }));
  if (!operations.length) throw new BankFileError("Aucune opération lisible dans ce fichier.");
  // The bank lists the newest first.
  return operations.reverse();
}
