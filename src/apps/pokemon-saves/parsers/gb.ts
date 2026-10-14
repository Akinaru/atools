import { gbText } from "./text";
import type { Mon } from "./types";

const NAME_LENGTH = 11;

/**
 * Reads a gen 1/2 Pokémon list: count, species list (capacity + 0xFF),
 * then structs, OT names and nicknames, each laid out for the full capacity.
 * Returns null when the bytes do not look like a valid list (e.g. uninitialized box).
 */
export function readGbList(
  bytes: Uint8Array,
  base: number,
  capacity: number,
  structSize: number,
  readMon: (struct: number, speciesByte: number) => Pick<Mon, "dex" | "level" | "shiny" | "egg">,
): Mon[] | null {
  const count = bytes[base];
  if (count > capacity || bytes[base + 1 + count] !== 0xff) return null;
  const structs = base + 2 + capacity;
  const otNames = structs + capacity * structSize;
  const nicknames = otNames + capacity * NAME_LENGTH;
  const mons: Mon[] = [];
  for (let i = 0; i < count; i++) {
    mons.push({
      ...readMon(structs + i * structSize, bytes[base + 1 + i]),
      otName: gbText(bytes, otNames + i * NAME_LENGTH, NAME_LENGTH),
      nickname: gbText(bytes, nicknames + i * NAME_LENGTH, NAME_LENGTH),
    });
  }
  return mons;
}

/** 3-byte big-endian binary-coded decimal (gen 1 money). */
export function bcd(bytes: Uint8Array, offset: number, length: number): number {
  let n = 0;
  for (let i = 0; i < length; i++) n = n * 100 + (bytes[offset + i] >> 4) * 10 + (bytes[offset + i] & 0xf);
  return n;
}

export function popcount(byte: number): number {
  let n = 0;
  for (; byte; byte >>= 1) n += byte & 1;
  return n;
}
