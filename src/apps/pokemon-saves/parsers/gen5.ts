import { levelFromExp } from "./growth";
import { decryptPkm, PK5, pkmChecksum, utf16 } from "./pkm";
import { countBits } from "./text";
import type { Box, Mon, ParsedSave } from "./types";

// Black/White (512 KB .sav), block offsets from PKHeX's SaveBlockAccessor5BW.
const SAVE_SIZE = 0x80000;
const BOX_LAYOUT = 0x0; // current box, box names
const BOXES = 0x400;
const PARTY = 0x18e00;
const PLAYER = 0x19400; // name, TID/SID, play time
const MISC = 0x21200; // money, badges
const POKEDEX = 0x21600;

const BOX_COUNT = 24;
const BOX_STRIDE = 30 * PK5.storedSize + 0x10;
const PARTY_SIZE = 220;
const SPECIES_COUNT = 649;

function readMon(bytes: Uint8Array, at: number, size: number): Mon | null {
  const raw = bytes.subarray(at, at + size);
  if (raw.every((b) => b === 0)) return null;
  const data = decryptPkm(raw, PK5);
  const view = new DataView(data.buffer);
  if (pkmChecksum(data, PK5) !== view.getUint16(6, true)) return null;
  const dex = view.getUint16(0x08, true);
  if (!dex || dex > SPECIES_COUNT) return null;

  const pid = view.getUint32(0x00, true);
  const tid = view.getUint16(0x0c, true);
  const sid = view.getUint16(0x0e, true);
  const iv32 = view.getUint32(0x38, true);
  return {
    dex,
    nickname: utf16(data, 0x48, 11, 0xffff),
    otName: utf16(data, 0x68, 8, 0xffff),
    level: size > PK5.storedSize ? data[0x8c] : levelFromExp(dex, view.getUint32(0x10, true)),
    shiny: (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 8,
    egg: ((iv32 >>> 30) & 1) === 1,
  };
}

export function parseGen5(bytes: Uint8Array): ParsedSave {
  if (bytes.length < SAVE_SIZE) throw new Error("Fichier trop petit pour une save Noir/Blanc (512 Ko attendus).");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const warnings: string[] = [];

  const party: Mon[] = [];
  const partyCount = Math.min(bytes[PARTY + 4], 6);
  for (let i = 0; i < partyCount; i++) {
    const mon = readMon(bytes, PARTY + 8 + i * PARTY_SIZE, PARTY_SIZE);
    if (mon) party.push(mon);
  }
  if (partyCount && !party.length) warnings.push("Équipe illisible : vérifie que la save est bien une save Noir/Blanc.");

  const boxes: Box[] = [];
  for (let b = 0; b < BOX_COUNT; b++) {
    const mons: Mon[] = [];
    for (let i = 0; i < 30; i++) {
      const mon = readMon(bytes, BOXES + b * BOX_STRIDE + i * PK5.storedSize, PK5.storedSize);
      if (mon) mons.push(mon);
    }
    boxes.push({ name: utf16(bytes, BOX_LAYOUT + 4 + b * 0x28, 10, 0xffff) || `Boîte ${b + 1}`, mons });
  }

  // Seen flags are split in 4 regions (gender × shiny): a species is seen if any is set.
  let seen = 0;
  for (let i = 0; i < SPECIES_COUNT; i++) {
    const [byte, bit] = [i >> 3, i & 7];
    if ([0, 1, 2, 3].some((r) => (bytes[POKEDEX + 0x5c + r * 0x54 + byte] >> bit) & 1)) seen++;
  }

  return {
    trainer: utf16(bytes, PLAYER + 4, 8, 0xffff),
    trainerId: view.getUint16(PLAYER + 0x14, true),
    money: view.getUint32(MISC, true),
    playTime: { hours: view.getUint16(PLAYER + 0x24, true), minutes: bytes[PLAYER + 0x26], seconds: bytes[PLAYER + 0x27] },
    badges: countBits(bytes, MISC + 4, 8),
    pokedex: { owned: countBits(bytes, POKEDEX + 0x8, SPECIES_COUNT), seen },
    party,
    boxes,
    warnings,
  };
}
