// Parser of the Caisse d'Épargne CSV export ("Télécharger mes opérations").
// Columns: Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;
// Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
// The file is Windows-1252 encoded, with ";" separators, French decimals ("-10,00", "+14,75") and dd/mm/yyyy dates.

import { createHash } from "node:crypto";

/** One line of the bank export. */
export type BankOperation = {
  /** Stable id of the operation: re-importing an overlapping export skips it. */
  importId: string;
  /** YYYY-MM-DD, the day of the payment (falls back on the booking day). */
  date: string;
  /** YYYY-MM-DD, the day the bank booked it: when it hits the balance. */
  bookedDate: string;
  /** Short label chosen by the bank ("SB CROUSTY", "VIREMENT VERS THIBAUD EVRARD"). */
  label: string;
  /** Full label and extra information, for display. */
  detail: string;
  /** Signed amount in cents: money out is negative. */
  amount: number;
  type: string;
  bankCategory: string;
  bankSubcategory: string;
};

export class BankFileError extends Error {}

const HEADER = ["Date de comptabilisation", "Libelle simplifie", "Libelle operation"];

/** Bytes of the uploaded file to text: UTF-8 when valid, Windows-1252 (the bank's encoding) otherwise. */
export function decodeBankFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** "26/10/2026" -> "2026-10-26". */
function toIsoDate(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

/** "-1 234,56" or "+14,75" -> cents. */
function toCents(value: string): number | undefined {
  const cleaned = value.replace(/[\s +]/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : undefined;
}

/** Splits a ";" line, honoring double quotes. */
function splitLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ";" && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

export function parseCaisseEpargneCsv(text: string): BankOperation[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const header = splitLine(lines[0] ?? "");
  if (!HEADER.every((h, i) => header[i] === h)) {
    throw new BankFileError("Fichier non reconnu : il faut l'export CSV des opérations de la Caisse d'Épargne.");
  }
  const col = (name: string) => header.indexOf(name);
  const at = (cells: string[], name: string) => cells[col(name)] ?? "";

  const seen = new Map<string, number>();
  const operations: BankOperation[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const bookedDate = toIsoDate(at(cells, "Date de comptabilisation"));
    const date = toIsoDate(at(cells, "Date operation")) ?? bookedDate;
    const amount = toCents(at(cells, "Debit")) ?? toCents(at(cells, "Credit"));
    if (!date || !bookedDate || amount === undefined || amount === 0) continue;

    const fullLabel = at(cells, "Libelle operation");
    // Identical operations the same day (two coffees) get an occurrence number, stable across exports.
    const base = [at(cells, "Date de comptabilisation"), fullLabel, amount, at(cells, "Reference")].join("|");
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    operations.push({
      importId: `ce:${createHash("sha256").update(`${base}|${occurrence}`).digest("hex").slice(0, 24)}`,
      date,
      bookedDate,
      label: at(cells, "Libelle simplifie") || fullLabel,
      detail: [fullLabel, at(cells, "Informations complementaires")].filter(Boolean).join(" · "),
      amount,
      type: at(cells, "Type operation"),
      bankCategory: at(cells, "Categorie"),
      bankSubcategory: at(cells, "Sous categorie"),
    });
  }
  if (!operations.length) throw new BankFileError("Aucune opération lisible dans ce fichier.");
  return operations;
}
