// Parser of the Revolut CSV statement (app: account > Relevé > Excel), personal and business accounts alike.
// Columns: Type,Produit,Date de début,Date de fin,Description,Montant,Frais,Devise,État,Solde
// UTF-8, "," separators, "." decimals, "YYYY-MM-DD HH:MM:SS" dates, oldest first. Only TERMINÉ lines moved money.

import { BankFileError, linesOf, operationIds, splitLine, toCents } from "./csv";
import type { BankOperation } from "./types";

export const REVOLUT_HEADER = ["Type", "Produit", "Date de début", "Date de fin", "Description", "Montant"];

export function parseRevolutCsv(text: string): { product: string; operations: BankOperation[] } {
  const lines = linesOf(text);
  const header = splitLine(lines[0] ?? "", ",");
  if (!REVOLUT_HEADER.every((h, i) => header[i] === h)) throw new BankFileError("Fichier non reconnu : il faut le relevé Revolut au format Excel (CSV).");
  const at = (cells: string[], name: string) => cells[header.indexOf(name)] ?? "";

  const rows = lines.slice(1).flatMap((line) => {
    const cells = splitLine(line, ",");
    if (at(cells, "État") !== "TERMINÉ") return [];
    const amount = (toCents(at(cells, "Montant")) ?? 0) - (toCents(at(cells, "Frais")) ?? 0);
    const started = at(cells, "Date de début");
    if (!amount || !/^\d{4}-\d{2}-\d{2}/.test(started)) return [];
    // The id keeps the bank's text as is (non-breaking spaces included): ids already stored depend on it.
    const raw = at(cells, "Description");
    return [{ cells, amount, started, description: raw.replace(/\u00a0/g, " "), key: `${started}|${raw}|${amount}` }];
  });
  const product = rows[0] ? at(rows[0].cells, "Produit") : "";
  const ids = operationIds(product === "Pro" ? "rvp" : "rv", rows.map((r) => r.key), 40);
  const operations = rows.map(({ cells, amount, started, description }, i) => ({
    importId: ids[i],
    date: started.slice(0, 10),
    bookedDate: (at(cells, "Date de fin") || started).slice(0, 10),
    label: description,
    detail: [at(cells, "Type"), description, toCents(at(cells, "Frais")) ? `frais ${at(cells, "Frais")} €` : ""].filter(Boolean).join(" · "),
    amount,
    type: at(cells, "Type"),
    bankCategory: "",
    bankSubcategory: "",
    balance: toCents(at(cells, "Solde")),
  }));
  if (!operations.length) throw new BankFileError("Aucune opération terminée dans ce relevé.");
  return { product, operations };
}
