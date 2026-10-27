// Parser of the Crédit Mutuel CSV export of a current account.
// Columns: Date;Date de valeur;Débit;Crédit;Libellé;Solde
// Latin-1, ";" separators, French decimals, dd/mm/yyyy dates, oldest first, a running balance on every line.

import { BankFileError, frenchDate, linesOf, operationIds, splitLine, toCents } from "./csv";
import type { BankOperation } from "./types";

export const CREDIT_MUTUEL_HEADER = ["Date", "Date de valeur", "Débit", "Crédit", "Libellé", "Solde"];

/** Places the bank writes before the shop of a card payment ("PAIEMENT PSC 0110 ANNECY SM CASINO CS585 CARTE 2646"). */
const PLACES = /^(ANNECY(-LE-VIE| LE VIE| CEDEX)?|PARIS( CEDEX| LA DEFE)?|LUXEMBOURG|DUBLIN|LONDON|EUR|USD|MUNCHEN|VILNIUS|BIARRITZ|BAYONNE|ANGLET|IVRY SUR SEIN|LIMASSOL|MONACO|BERLIN|STOCKHOLM|LYON|DIJON|SEYNOD|AMSTERDAM|FRANKFURT AM|ROUBAIX|BRON CEDEX|CHAMBERY|RENNES|MONTPELLIER|NICE|INTERNET|FRANCE|[+/]) /;

/** "PAIEMENT PSC 0110 ANNECY SM CASINO CS585 CARTE 2646" -> "SM CASINO CS585"; other labels stay. */
export function creditMutuelLabel(raw: string): string {
  const card = /^PAIEMENT (?:PSC|CB) \d{4} (.*?)(?: CARTE \d{4}.*)?$/.exec(raw);
  if (!card) return raw;
  return card[1].replace(PLACES, "").replace(/^\*+|\*+$/g, "").trim() || raw;
}

export function parseCreditMutuelCsv(text: string): BankOperation[] {
  const lines = linesOf(text);
  const header = splitLine(lines[0] ?? "", ";");
  if (!CREDIT_MUTUEL_HEADER.every((h, i) => header[i] === h)) throw new BankFileError("Fichier non reconnu : il faut l'export CSV d'un compte Crédit Mutuel.");
  const at = (cells: string[], name: string) => cells[header.indexOf(name)] ?? "";

  const rows = lines.slice(1).flatMap((line) => {
    const cells = splitLine(line, ";");
    const date = frenchDate(at(cells, "Date"));
    const amount = toCents(at(cells, "Débit")) ?? toCents(at(cells, "Crédit"));
    if (!date || !amount) return [];
    const raw = at(cells, "Libellé").replace(/\s+/g, " ").trim();
    return [{ cells, date, amount, raw, key: `${at(cells, "Date")}|${raw}|${amount}` }];
  });
  const ids = operationIds("cm", rows.map((r) => r.key), 40);
  const operations = rows.map(({ cells, date, amount, raw }, i) => ({
    importId: ids[i],
    date,
    bookedDate: date,
    label: creditMutuelLabel(raw),
    detail: raw,
    amount,
    type: /^PAIEMENT (PSC|CB)/.test(raw) ? "Carte" : /^VIR/.test(raw) ? "Virement" : /^PRLV/.test(raw) ? "Prélèvement" : "",
    bankCategory: "",
    bankSubcategory: "",
    balance: toCents(at(cells, "Solde")),
  }));
  if (!operations.length) throw new BankFileError("Aucune opération lisible dans ce fichier.");
  return operations;
}
