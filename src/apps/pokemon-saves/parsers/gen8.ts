// Sword/Shield (SAV8SWSH, PK8) and Legends: Arceus (SAV8LA, PA8) saves, ported from PKHeX
// (SaveBlockAccessor8SWSH.cs, SaveBlockAccessor8LA.cs, MyStatus8(a).cs, Misc8.cs, PlayTime7b/8b.cs,
// BoxLayout8(a).cs, G8PKM.cs, PA8.cs). Both games store their data in a SwishCrypto block container.
import { levelFromExp } from "./growth";
import { decryptPkm, PA8, PK8, pkmChecksum, utf16, type PkmLayout } from "./pkm";
import { decryptSwish, type SwishSave } from "./swish";
import type { Box, Mon, ParsedSave } from "./types";

const BOX_COUNT = 32;
const BOX_SLOTS = 30;
const BOX_NAME_SIZE = 0x22; // bytes per box name (UTF-16, 17 chars incl. terminator)
const TRAINER_NAME_CHARS = 13; // 0x1A bytes
const MON_STRING_CHARS = 13; // nickname / OT trash, 0x1A bytes

// Block keys shared by both games.
const K_BOX_LAYOUT = 0x19722c89; // box names
const K_PARTY = 0x2985fe5d;
const K_MY_STATUS = 0xf25c070e;

const SWSH = {
  box: 0x0d66012c,
  misc: 0x1b882b09, // badges (u8 bitflags @0), money (u32 @4)
  playTime: 0x8cbbfd90,
  // MyStatus8
  tid: 0xa0,
  ot: 0xb0,
  // PK8 slots are party-sized everywhere (boxes included).
  partySize: 0x158,
  boxSlotSize: 0x158,
  layout: PK8,
  mon: { nickname: 0x58, ot: 0xf8, iv32: 0x8c, level: 0x148 },
};

const LA = {
  box: 0x47e1ceab,
  money: 0x3279d927, // u32 value block
  playTime: 0xc4fa7c8c,
  // MyStatus8a
  tid: 0x10,
  ot: 0x20,
  partySize: 0x178,
  boxSlotSize: 0x168, // stored size: no party stats, level comes from EXP
  layout: PA8,
  mon: { nickname: 0x60, ot: 0x110, iv32: 0x94, level: 0x168 },
};

type MonOffsets = { nickname: number; ot: number; iv32: number; level: number };

/** Decrypts one slot; returns null when empty or when the checksum does not match. */
function readMon(slot: Uint8Array, layout: PkmLayout, o: MonOffsets): Mon | null {
  if (slot.every((b) => b === 0)) return null;
  const data = decryptPkm(slot, layout);
  const view = new DataView(data.buffer);
  const dex = view.getUint16(0x08, true);
  if (!dex) return null;
  if (pkmChecksum(data, layout) !== view.getUint16(0x06, true)) return null;

  const tid = view.getUint16(0x0c, true);
  const sid = view.getUint16(0x0e, true);
  const pid = view.getUint32(0x1c, true);
  const iv32 = view.getUint32(o.iv32, true);
  const mon: Mon = {
    dex,
    nickname: utf16(data, o.nickname, MON_STRING_CHARS),
    otName: utf16(data, o.ot, MON_STRING_CHARS),
    // Gen 6+ rule: shiny when TID ^ SID ^ PID.hi ^ PID.lo < 16.
    shiny: (tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff)) < 16,
    egg: ((iv32 >>> 30) & 1) === 1,
  };
  const level = data.length > o.level ? data[o.level] : 0;
  mon.level = level >= 1 && level <= 100 ? level : levelFromExp(dex, view.getUint32(0x10, true));
  return mon;
}

function readParty(save: SwishSave, size: number, layout: PkmLayout, o: MonOffsets, warnings: string[]): Mon[] {
  const block = save.blocks.get(K_PARTY);
  if (!block || block.length < 6 * size + 1) {
    warnings.push("Bloc de l'équipe introuvable.");
    return [];
  }
  const count = Math.min(block[6 * size], 6);
  const party: Mon[] = [];
  for (let i = 0; i < count; i++) {
    const mon = readMon(block.subarray(i * size, (i + 1) * size), layout, o);
    if (mon) party.push(mon);
    else warnings.push(`Pokémon ${i + 1} de l'équipe illisible (checksum invalide).`);
  }
  return party;
}

function readBoxes(save: SwishSave, key: number, size: number, layout: PkmLayout, o: MonOffsets, warnings: string[]): Box[] {
  const block = save.blocks.get(key);
  if (!block || block.length < BOX_COUNT * BOX_SLOTS * size) {
    warnings.push("Bloc des boîtes PC introuvable.");
    return [];
  }
  const names = save.blocks.get(K_BOX_LAYOUT);
  const boxes: Box[] = [];
  for (let b = 0; b < BOX_COUNT; b++) {
    const name =
      (names && names.length >= (b + 1) * BOX_NAME_SIZE ? utf16(names, b * BOX_NAME_SIZE, BOX_NAME_SIZE / 2) : "") ||
      `Boîte ${b + 1}`;
    const mons: Mon[] = [];
    for (let s = 0; s < BOX_SLOTS; s++) {
      const at = (b * BOX_SLOTS + s) * size;
      const mon = readMon(block.subarray(at, at + size), layout, o);
      if (mon) mons.push(mon);
    }
    boxes.push({ name, mons });
  }
  return boxes;
}

function readPlayTime(save: SwishSave, key: number, warnings: string[]): ParsedSave["playTime"] {
  const block = save.blocks.get(key);
  if (!block || block.length < 4) {
    warnings.push("Temps de jeu introuvable.");
    return { hours: 0, minutes: 0, seconds: 0 };
  }
  return { hours: block[0] | (block[1] << 8), minutes: block[2], seconds: block[3] };
}

function readU32(block: Uint8Array | undefined, offset: number): number | undefined {
  if (!block || block.length < offset + 4) return undefined;
  return new DataView(block.buffer, block.byteOffset, block.byteLength).getUint32(offset, true);
}

function openSave(bytes: Uint8Array, game: string): { save: SwishSave; myStatus: Uint8Array; warnings: string[] } {
  const save = decryptSwish(bytes);
  const warnings: string[] = [];
  const myStatus = save.blocks.get(K_MY_STATUS);
  if (!myStatus) {
    throw new Error(
      save.hashValid
        ? `Bloc dresseur introuvable : ce n'est pas une sauvegarde ${game}.`
        : `Impossible de déchiffrer la sauvegarde ${game} (fichier « main » attendu).`,
    );
  }
  if (!save.hashValid) warnings.push("Hash SHA-256 de la sauvegarde invalide (fichier modifié ou corrompu ?).");
  return { save, myStatus, warnings };
}

export function parseSwordShield(bytes: Uint8Array): ParsedSave {
  const { save, myStatus, warnings } = openSave(bytes, "Épée/Bouclier");
  if (myStatus.length < SWSH.ot + 0x1a) throw new Error("Bloc dresseur trop court : sauvegarde Épée/Bouclier invalide.");
  const status = new DataView(myStatus.buffer, myStatus.byteOffset, myStatus.byteLength);

  const misc = save.blocks.get(SWSH.misc);
  const money = readU32(misc, 4);
  if (money === undefined) warnings.push("Argent introuvable.");
  let badges: number | undefined;
  if (misc && misc.length > 0) {
    badges = 0;
    for (let bits = misc[0]; bits; bits &= bits - 1) badges++;
  }

  return {
    trainer: utf16(myStatus, SWSH.ot, TRAINER_NAME_CHARS),
    trainerId: status.getUint16(SWSH.tid, true),
    money: money ?? 0,
    playTime: readPlayTime(save, SWSH.playTime, warnings),
    badges,
    party: readParty(save, SWSH.partySize, SWSH.layout, SWSH.mon, warnings),
    boxes: readBoxes(save, SWSH.box, SWSH.boxSlotSize, SWSH.layout, SWSH.mon, warnings),
    warnings,
  };
}

export function parseLegendsArceus(bytes: Uint8Array): ParsedSave {
  const { save, myStatus, warnings } = openSave(bytes, "Légendes Pokémon : Arceus");
  if (myStatus.length < LA.ot + 0x1a) throw new Error("Bloc dresseur trop court : sauvegarde Légendes Arceus invalide.");
  const status = new DataView(myStatus.buffer, myStatus.byteOffset, myStatus.byteLength);

  const money = readU32(save.blocks.get(LA.money), 0);
  if (money === undefined) warnings.push("Argent introuvable.");

  return {
    trainer: utf16(myStatus, LA.ot, TRAINER_NAME_CHARS),
    trainerId: status.getUint16(LA.tid, true),
    money: money ?? 0,
    playTime: readPlayTime(save, LA.playTime, warnings),
    party: readParty(save, LA.partySize, LA.layout, LA.mon, warnings),
    boxes: readBoxes(save, LA.box, LA.boxSlotSize, LA.layout, LA.mon, warnings),
    warnings,
  };
}
