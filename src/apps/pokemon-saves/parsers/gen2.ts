import maps from "../data/maps.json";
import { popcount, readGbList } from "./gb";
import { countBits, gbText } from "./text";
import type { Box, Mon, ParsedSave } from "./types";

// Offsets for international Gold/Silver and Crystal (32 KB .sav).
const OFFSETS = {
  gs: {
    playHours: 0x2053, money: 0x23db, badges: 0x23e4, currentBoxNumber: 0x2724,
    map: 0x2868, party: 0x288a, dexOwned: 0x2a4c, dexSeen: 0x2a6c, currentBox: 0x2d6c, maps: maps.gold,
  },
  crystal: {
    playHours: 0x2052, money: 0x23dc, badges: 0x23e5, currentBoxNumber: 0x2700,
    map: 0x2843, party: 0x2865, dexOwned: 0x2a27, dexSeen: 0x2a47, currentBox: 0x2d10, maps: maps.crystal,
  },
};
const TRAINER_ID = 0x2009;
const PLAYER_NAME = 0x200b;
const RIVAL_NAME = 0x2021;
const BOX_SIZE = 0x450;
const EGG = 0xfd;

function isShiny(bytes: Uint8Array, dvs: number): boolean {
  const attack = bytes[dvs] >> 4;
  return (
    (bytes[dvs] & 0xf) === 10 && bytes[dvs + 1] === 0xaa && [2, 3, 6, 7, 10, 11, 14, 15].includes(attack)
  );
}

export function parseGen2(bytes: Uint8Array, version: keyof typeof OFFSETS): ParsedSave {
  if (bytes.length < 0x8000) throw new Error("Fichier trop petit pour une save Game Boy (32 Ko attendus).");
  const o = OFFSETS[version];
  const warnings: string[] = [];

  const readMon = (struct: number, speciesByte: number): Omit<Mon, "nickname"> => ({
    dex: bytes[struct],
    level: bytes[struct + 0x1f],
    shiny: isShiny(bytes, struct + 0x15),
    egg: speciesByte === EGG,
  });

  const party = readGbList(bytes, o.party, 6, 48, readMon);
  if (!party) warnings.push("Équipe illisible : vérifie que le jeu choisi correspond à la save.");

  const currentBox = bytes[o.currentBoxNumber] & 0x0f;
  const boxes: Box[] = [];
  for (let i = 0; i < 14; i++) {
    const base = i === currentBox ? o.currentBox : (i < 7 ? 0x4000 : 0x6000) + (i % 7) * BOX_SIZE;
    boxes.push({ name: `Boîte ${i + 1}`, mons: readGbList(bytes, base, 20, 32, readMon) ?? [] });
  }

  const group = bytes[o.map];
  const number = bytes[o.map + 1];
  return {
    trainer: gbText(bytes, PLAYER_NAME, 11),
    trainerId: (bytes[TRAINER_ID] << 8) | bytes[TRAINER_ID + 1],
    rival: gbText(bytes, RIVAL_NAME, 11),
    money: (bytes[o.money] << 16) | (bytes[o.money + 1] << 8) | bytes[o.money + 2],
    location: o.maps[group]?.[number] ?? `Carte ${group}:${number}`,
    playTime: {
      hours: (bytes[o.playHours] << 8) | bytes[o.playHours + 1],
      minutes: bytes[o.playHours + 2],
      seconds: bytes[o.playHours + 3],
    },
    badges: popcount(bytes[o.badges]) + popcount(bytes[o.badges + 1]),
    pokedex: { owned: countBits(bytes, o.dexOwned, 251), seen: countBits(bytes, o.dexSeen, 251) },
    party: party ?? [],
    boxes,
    warnings,
  };
}
