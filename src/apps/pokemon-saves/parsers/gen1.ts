import maps from "../data/maps.json";
import { bcd, popcount, readGbList } from "./gb";
import { countBits, gbText } from "./text";
import type { Box, ParsedSave } from "./types";

// Offsets for international Red/Blue/Yellow (32 KB .sav).
const PLAYER_NAME = 0x2598;
const DEX_OWNED = 0x25a3;
const DEX_SEEN = 0x25b6;
const MONEY = 0x25f3;
const RIVAL_NAME = 0x25f6;
const BADGES = 0x2602;
const TRAINER_ID = 0x2605;
const CURRENT_MAP = 0x260a;
const CURRENT_BOX_NUMBER = 0x284c;
const PLAY_HOURS = 0x2ced;
const PARTY = 0x2f2c;
const CURRENT_BOX = 0x30c0;
const CHECKSUM = 0x3523;
const BOX_SIZE = 0x462;

// Gen 1 internal species index -> National Pokédex number (0 = MissingNo.).
// prettier-ignore
const INDEX_TO_DEX = [0,
  112,115,32,35,21,100,34,80,2,103,108,102,88,94,29,31,104,111,131,59,151,130,90,72,92,123,120,9,127,114,0,0,
  58,95,22,16,79,64,75,113,67,122,106,107,24,47,54,96,76,0,126,0,125,82,109,0,56,86,50,128,0,0,0,83,48,149,
  0,0,0,84,60,124,146,144,145,132,52,98,0,0,0,37,38,25,26,0,0,147,148,140,141,116,117,0,0,27,28,138,139,39,
  40,133,136,135,134,66,41,23,46,61,62,13,14,15,0,85,57,51,49,87,0,0,10,11,12,68,0,55,97,42,150,143,129,0,0,
  89,0,99,91,0,101,36,110,53,105,0,93,63,65,17,18,121,1,3,73,0,118,119,0,0,0,0,77,78,19,20,33,30,74,137,142,
  0,81,0,0,4,7,5,8,6,0,0,0,0,43,44,45,69,70,71,
];

export function speciesFromGen1Index(index: number): number {
  return INDEX_TO_DEX[index] ?? 0;
}

export function parseGen1(bytes: Uint8Array): ParsedSave {
  const warnings: string[] = [];
  if (bytes.length < 0x8000) throw new Error("Fichier trop petit pour une save Game Boy (32 Ko attendus).");

  let sum = 0;
  for (let i = PLAYER_NAME; i < CHECKSUM; i++) sum += bytes[i];
  if ((~sum & 0xff) !== bytes[CHECKSUM]) warnings.push("Checksum invalide : la save est peut-être corrompue ou d'une version japonaise.");

  const readParty = (struct: number) => ({ dex: speciesFromGen1Index(bytes[struct]), level: bytes[struct + 0x21] });
  const readBoxed = (struct: number) => ({ dex: speciesFromGen1Index(bytes[struct]), level: bytes[struct + 3] });

  const party = readGbList(bytes, PARTY, 6, 44, readParty);
  if (!party) warnings.push("Équipe illisible.");

  const currentBox = bytes[CURRENT_BOX_NUMBER] & 0x7f;
  const boxes: Box[] = [];
  for (let i = 0; i < 12; i++) {
    const base = i === currentBox ? CURRENT_BOX : (i < 6 ? 0x4000 : 0x6000) + (i % 6) * BOX_SIZE;
    boxes.push({ name: `Boîte ${i + 1}`, mons: readGbList(bytes, base, 20, 33, readBoxed) ?? [] });
  }

  const mapId = bytes[CURRENT_MAP];
  return {
    trainer: gbText(bytes, PLAYER_NAME, 11),
    trainerId: (bytes[TRAINER_ID] << 8) | bytes[TRAINER_ID + 1],
    rival: gbText(bytes, RIVAL_NAME, 11),
    money: bcd(bytes, MONEY, 3),
    location: maps.gen1[mapId] ?? `Carte #${mapId}`,
    playTime: { hours: bytes[PLAY_HOURS], minutes: bytes[PLAY_HOURS + 2], seconds: bytes[PLAY_HOURS + 3] },
    badges: popcount(bytes[BADGES]),
    pokedex: { owned: countBits(bytes, DEX_OWNED, 151), seen: countBits(bytes, DEX_SEEN, 151) },
    party: party ?? [],
    boxes,
    warnings,
  };
}
