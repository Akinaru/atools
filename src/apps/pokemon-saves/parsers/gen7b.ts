import { decryptPkm, PK6, pkmChecksum, utf16 } from "./pkm";
import type { Box, Mon, ParsedSave } from "./types";

// Pokémon Let's Go Pikachu / Let's Go Eevee (PKHeX SAV7b). The savedata.bin is 1 MB but only the
// first 0xB8800 bytes are used; blocks live at fixed offsets (PKHeX SaveBlockAccessor7b).
const FILE_SIZE = 0x100000;
const USED_SIZE = 0xb8800;
const BLOCK_INFO = USED_SIZE - 0x200; // BEEF footer with the block table
const BEEF_MAGIC = 0x42454546;

const MY_STATUS = 0x01000; // TID16 @ 0, SID16 @ 2, OT name @ 0x38 (13 UTF-16 chars)
const MISC = 0x04c00; // money (u32) @ 4, rival name @ 0x200
const POKE_LIST_HEADER = 0x05a00; // u16 party slot indexes * 6, u16 starter index, u16 list count
const POKE_LIST = 0x05c00; // 1000 Pokémon slots, stored in party format (PB7, 0x104 bytes)
const PLAY_TIME = 0x45400; // u16 hours, u8 minutes, u8 seconds

const SLOT_COUNT = 1000;
const SLOT_SIZE = 0x104;
const SLOT_EMPTY = 1001;
const BOX_SIZE = 25;

/** Decodes one PB7 slot; null when empty or corrupted. */
function readMon(bytes: Uint8Array, at: number, warnings: string[], label: string): Mon | null {
  const raw = bytes.subarray(at, at + SLOT_SIZE);
  const rawView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  if (rawView.getUint32(0, true) === 0 && rawView.getUint16(6, true) === 0) return null;

  const data = decryptPkm(raw, PK6);
  const view = new DataView(data.buffer);
  const dex = view.getUint16(0x08, true);
  if (!dex) return null;
  if (pkmChecksum(data, PK6) !== view.getUint16(0x06, true)) {
    warnings.push(`Checksum invalide pour le Pokémon ${label} (ignoré).`);
    return null;
  }

  const tid = view.getUint16(0x0c, true);
  const sid = view.getUint16(0x0e, true);
  const pid = view.getUint32(0x18, true);
  const shinyXor = tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff);
  return {
    dex,
    nickname: utf16(data, 0x40, 13),
    otName: utf16(data, 0xb0, 13),
    level: data[0xec],
    shiny: shinyXor < 16,
    egg: ((view.getUint32(0x74, true) >>> 30) & 1) === 1,
  };
}

export function parseLetsGo(bytes: Uint8Array): ParsedSave {
  if (bytes.length !== FILE_SIZE) {
    throw new Error("Taille de fichier invalide pour une save Let's Go Pikachu / Évoli (1 Mo attendu).");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(USED_SIZE - 0x1f0, true) !== BEEF_MAGIC || view.getUint16(BLOCK_INFO + 0xb0, true) !== 0x13) {
    throw new Error("Ce fichier ne ressemble pas à une save Let's Go Pikachu / Évoli.");
  }
  const warnings: string[] = [];

  // The party is a list of indexes into the 1000-slot storage list.
  const partySlots: number[] = [];
  for (let i = 0; i < 6; i++) {
    const index = view.getUint16(POKE_LIST_HEADER + i * 2, true);
    if (index < SLOT_COUNT) partySlots.push(index);
    else if (index !== SLOT_EMPTY) warnings.push(`Index d'équipe invalide (${index}).`);
  }
  const party: Mon[] = [];
  for (const [i, index] of partySlots.entries()) {
    const mon = readMon(bytes, POKE_LIST + index * SLOT_SIZE, warnings, `de l'équipe n°${i + 1}`);
    if (mon) party.push(mon);
  }

  // PKHeX shows the storage list as 40 boxes of 25 slots.
  const boxes: Box[] = [];
  for (let b = 0; b < SLOT_COUNT / BOX_SIZE; b++) {
    const mons: Mon[] = [];
    for (let s = 0; s < BOX_SIZE; s++) {
      const index = b * BOX_SIZE + s;
      if (partySlots.includes(index)) continue;
      const mon = readMon(bytes, POKE_LIST + index * SLOT_SIZE, warnings, `de l'emplacement ${index + 1}`);
      if (mon) mons.push(mon);
    }
    boxes.push({ name: `Boîte ${b + 1}`, mons });
  }
  while (boxes.length && !boxes[boxes.length - 1].mons.length) boxes.pop();

  return {
    trainer: utf16(bytes, MY_STATUS + 0x38, 13),
    trainerId: view.getUint16(MY_STATUS, true),
    rival: utf16(bytes, MISC + 0x200, 13) || undefined,
    money: view.getUint32(MISC + 4, true),
    playTime: {
      hours: view.getUint16(PLAY_TIME, true),
      minutes: bytes[PLAY_TIME + 2],
      seconds: bytes[PLAY_TIME + 3],
    },
    party,
    boxes,
    warnings,
  };
}
