// Helpers shared by the bank export parsers.

import { createHash } from "node:crypto";

export class BankFileError extends Error {}

/** Bytes of the uploaded file to text: UTF-8 when valid, Windows-1252 / Latin-1 (French banks) otherwise. */
export function decodeBankFile(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Non-empty lines, without the byte order mark. */
export const linesOf = (text: string) =>
  text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());

/** Splits a CSV line on `separator`, honoring double quotes. */
export function splitLine(line: string, separator: string): string[] {
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
    } else if (c === separator && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

/** "26/10/2026" -> "2026-10-26". */
export function frenchDate(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : undefined;
}

/** "-1 234,56", "+14,75" or "12.50" -> cents. */
export function toCents(value: string): number | undefined {
  const cleaned = value.replace(/[\s\u00a0+]/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const number = Number(cleaned);
  return Number.isFinite(number) ? Math.round(number * 100) : undefined;
}

/**
 * Stable id of an operation: identical operations (two coffees the same day) get an occurrence number, so the id
 * is the same in every export that contains them. `length` hex characters of a SHA-256.
 */
export function operationIds(prefix: string, keys: string[], length: number): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return `${prefix}:${createHash("sha256").update(`${key}|${occurrence}`).digest("hex").slice(0, length)}`;
  });
}
