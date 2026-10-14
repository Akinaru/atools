import { levelFromExp } from "./growth";
import maps from "../data/maps.json";
import { countBits, gbaText } from "./text";
import type { Mon, ParsedSave } from "./types";

// Layout of the 128 KB GBA save: two slots of 14 sections (4 KB each); the slot
// with the highest save counter is the current one.
const SECTION_SIZE = 0x1000;
const SECTION_DATA = 0xf80;
const SLOT_SIZE = 14 * SECTION_SIZE;
const SIGNATURE = 0x08012025;
const CHECKSUM_LENGTH = [3884, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 3968, 2000];

const VERSIONS = {
  rs: { securityKey: null, team: 0x234, money: 0x490, flags: 0x1220, badge1: 0x807, maps: maps.ruby },
  emerald: { securityKey: 0xac, team: 0x234, money: 0x490, flags: 0x1270, badge1: 0x867, maps: maps.emerald },
  frlg: { securityKey: 0xf20, team: 0x34, money: 0x290, flags: 0xee0, badge1: 0x820, maps: maps.firered },
};

// Gen 3 internal species 277..411 (Hoenn) -> National Pokédex number.
// prettier-ignore
const HOENN_INDEX_TO_DEX = [
  252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,290,291,
  292,276,277,285,286,327,278,279,283,284,320,321,300,301,352,343,344,299,324,302,339,340,370,341,342,349,
  350,318,319,328,329,330,296,297,309,310,322,323,363,364,365,331,332,361,362,337,338,298,325,326,311,312,
  303,307,308,333,334,360,355,356,315,287,288,289,316,317,357,293,294,295,366,367,368,359,353,354,336,335,
  369,304,305,306,351,313,314,345,346,347,348,280,281,282,371,372,373,374,375,376,377,378,379,382,383,384,
  380,381,385,386,358,
];

export function speciesFromGen3Index(index: number): number {
  if (index <= 251) return index;
  return HOENN_INDEX_TO_DEX[index - 277] ?? 0;
}

// Order of the Growth/Attacks/EVs/Misc substructures, indexed by personality % 24.
// prettier-ignore
const SUBSTRUCT_ORDERS = ["GAEM","GAME","GEAM","GEMA","GMAE","GMEA","AGEM","AGME","AEGM","AEMG","AMGE","AMEG",
  "EGAM","EGMA","EAGM","EAMG","EMGA","EMAG","MGAE","MGEA","MAGE","MAEG","MEGA","MEAG"];

/** Decodes an 80-byte BoxPokemon (party Pokémon add 20 bytes, level at +0x54). */
function readMon(bytes: Uint8Array, view: DataView, at: number, partyLevel?: number): Mon | null {
  const personality = view.getUint32(at, true);
  const otId = view.getUint32(at + 4, true);
  const key = personality ^ otId;
  const data = new DataView(new ArrayBuffer(48));
  let checksum = 0;
  for (let i = 0; i < 48; i += 4) {
    const word = (view.getUint32(at + 0x20 + i, true) ^ key) >>> 0;
    data.setUint32(i, word, true);
    checksum += (word & 0xffff) + (word >>> 16);
  }
  if ((checksum & 0xffff) !== view.getUint16(at + 0x1c, true)) return null;

  const order = SUBSTRUCT_ORDERS[personality % 24];
  const growthAt = order.indexOf("G") * 12;
  const miscAt = order.indexOf("M") * 12;
  const dex = speciesFromGen3Index(data.getUint16(growthAt, true));
  if (!dex) return null;

  const shinyValue = (otId & 0xffff) ^ (otId >>> 16) ^ (personality & 0xffff) ^ (personality >>> 16);
  return {
    dex,
    nickname: gbaText(bytes, at + 8, 10),
    otName: gbaText(bytes, at + 0x14, 7),
    level: partyLevel ?? levelFromExp(dex, data.getUint32(growthAt + 4, true)),
    shiny: shinyValue < 8,
    egg: ((data.getUint32(miscAt + 4, true) >>> 30) & 1) === 1,
  };
}

export function parseGen3(bytes: Uint8Array, version: keyof typeof VERSIONS): ParsedSave {
  if (bytes.length < 2 * SLOT_SIZE) throw new Error("Fichier trop petit pour une save GBA (128 Ko attendus).");
  const v = VERSIONS[version];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const warnings: string[] = [];

  // Pick the most recent valid slot and map section id -> offset.
  let best: { counter: number; sections: number[] } | null = null;
  for (const slot of [0, SLOT_SIZE]) {
    const sections: number[] = [];
    let counter = -1;
    for (let i = 0; i < 14; i++) {
      const at = slot + i * SECTION_SIZE;
      if (view.getUint32(at + 0xff8, true) !== SIGNATURE) break;
      sections[view.getUint16(at + 0xff4, true)] = at;
      counter = view.getUint32(at + 0xffc, true);
    }
    if (sections.filter((s) => s !== undefined).length === 14 && (!best || counter > best.counter)) {
      best = { counter, sections };
    }
  }
  if (!best) throw new Error("Aucun slot de sauvegarde valide trouvé dans ce fichier.");
  const sec = best.sections;

  sec.forEach((at, id) => {
    let sum = 0;
    for (let i = 0; i < CHECKSUM_LENGTH[id]; i += 4) sum = (sum + view.getUint32(at + i, true)) >>> 0;
    if ((((sum >>> 16) + sum) & 0xffff) !== view.getUint16(at + 0xff6, true)) {
      warnings.push(`Checksum invalide pour la section ${id}.`);
    }
  });

  // SaveBlock1 and PC storage are split across consecutive sections.
  const joined = (from: number, to: number) => {
    const out = new Uint8Array((to - from + 1) * SECTION_DATA);
    for (let id = from; id <= to; id++) out.set(bytes.subarray(sec[id], sec[id] + SECTION_DATA), (id - from) * SECTION_DATA);
    return out;
  };
  const block2 = sec[0];
  const block1 = joined(1, 4);
  const block1View = new DataView(block1.buffer);
  const storage = joined(5, 13);
  const storageView = new DataView(storage.buffer);

  const key = v.securityKey === null ? 0 : view.getUint32(block2 + v.securityKey, true);
  const teamSize = Math.min(block1[v.team], 6);
  const party: Mon[] = [];
  for (let i = 0; i < teamSize; i++) {
    const at = v.team + 4 + i * 100;
    const mon = readMon(block1, block1View, at, block1[at + 0x54]);
    if (mon) party.push(mon);
  }

  const boxes = Array.from({ length: 14 }, (_, b) => {
    const mons: Mon[] = [];
    for (let i = 0; i < 30; i++) {
      const at = 4 + (b * 30 + i) * 80;
      if (storageView.getUint32(at, true) === 0 && storageView.getUint32(at + 4, true) === 0) continue;
      const mon = readMon(storage, storageView, at);
      if (mon) mons.push(mon);
    }
    return { name: gbaText(storage, 4 + 14 * 30 * 80 + b * 9, 9) || `Boîte ${b + 1}`, mons };
  });

  let badges = 0;
  for (let i = 0; i < 8; i++) {
    const flag = v.badge1 + i;
    badges += (block1[v.flags + (flag >> 3)] >> (flag & 7)) & 1;
  }

  const group = block1[4];
  const number = block1[5];
  const hours = view.getUint16(block2 + 0x0e, true);
  return {
    trainer: gbaText(bytes, block2, 8),
    trainerId: view.getUint16(block2 + 0x0a, true),
    money: (block1View.getUint32(v.money, true) ^ key) >>> 0,
    location: v.maps[group]?.[number] ?? `Carte ${group}:${number}`,
    playTime: { hours, minutes: bytes[block2 + 0x10], seconds: bytes[block2 + 0x11] },
    badges,
    pokedex: { owned: countBits(bytes, block2 + 0x28, 386), seen: countBits(bytes, block2 + 0x5c, 386) },
    party,
    boxes,
    warnings,
  };
}
