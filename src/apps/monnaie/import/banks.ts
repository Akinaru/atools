// Reads any supported bank export: the bank is recognized from the header line.

import { CAISSE_EPARGNE_HEADER, parseCaisseEpargneCsv } from "./caisse-epargne";
import { CREDIT_MUTUEL_HEADER, parseCreditMutuelCsv } from "./credit-mutuel";
import { BankFileError, linesOf } from "./csv";
import { parseRevolutCsv, REVOLUT_HEADER } from "./revolut";
import type { BankFile } from "./types";

const starts = (line: string, header: string[], separator: string) => line.replace(/^\uFEFF/, "").split(separator).slice(0, header.length).join(separator) === header.join(separator);

export function parseBankFile(text: string): BankFile {
  const first = linesOf(text)[0] ?? "";
  if (starts(first, CAISSE_EPARGNE_HEADER, ";")) return { bank: "caisse-epargne", bankName: "Caisse d'Épargne", operations: parseCaisseEpargneCsv(text) };
  if (starts(first, REVOLUT_HEADER, ",")) {
    const { product, operations } = parseRevolutCsv(text);
    return { bank: "revolut", bankName: product === "Pro" ? "Revolut Pro" : "Revolut", product, operations };
  }
  if (starts(first, CREDIT_MUTUEL_HEADER, ";")) return { bank: "credit-mutuel", bankName: "Crédit Mutuel", operations: parseCreditMutuelCsv(text) };
  throw new BankFileError("Fichier non reconnu. Exports acceptés : Caisse d'Épargne (CSV), Revolut (relevé Excel/CSV), Crédit Mutuel (CSV).");
}
