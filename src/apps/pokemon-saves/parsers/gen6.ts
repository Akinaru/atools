import { levelFromExp } from "./growth";
import { decryptPkm, PK6, pkmChecksum, utf16 } from "./pkm";
import type { Mon, ParsedSave } from "./types";

// Gen 6 (3DS) save layout, ported from PKHeX's SAV6XY / SAV6AO and SaveBlockAccessor6XY / 6AO.
// Both games share the same block offsets up to the party; the PC storage block moves.
const SIZE_XY = 0x65600;
const SIZE_ORAS = 0x76000;
const FOOTER_MAGIC = 0x42454546; // "BEEF", read at length - 0x1F0

const PLAY_TIME = 0x1800; // PlayTime6: u16 hours, u8 minutes, u8 seconds
const MISC = 0x4200; // Misc6XY / Misc6AO: u32 money @0x8, badge bitfield @0xC
const BOX_LAYOUT = 0x4400; // BoxLayout6: 31 box names of 0x22 bytes
const MY_STATUS = 0x14000; // MyStatus6: TID16 @0x0, OT name @0x48
const PARTY = 0x14200; // 6 x party PK6, then party count byte
const ZUKAN = 0x15000; // Zukan6: caught bits @0x8, 4 seen regions @0x68 (0x60 bytes each)

const VERSIONS = {
  xy: { size: SIZE_XY, box: 0x22600 },
  oras: { size: SIZE_ORAS, box: 0x33000 },
};

const SIZE_PARTY = 0x104;
const SIZE_STORED = PK6.storedSize;
const BOX_COUNT = 31;
const BOX_SLOTS = 30;
const BOX_NAME_BYTES = 0x22;
const MAX_SPECIES = 721;
const DEX_BITS_BYTES = 0x60;

/** Decrypts and decodes one PK6 (stored or party). Returns null for empty slots, "bad" on checksum mismatch. */
function readMon(raw: Uint8Array, isParty: boolean): Mon | null | "bad" {
  const data = decryptPkm(raw, PK6);
  const view = new DataView(data.buffer);
  if (pkmChecksum(data, PK6) !== view.getUint16(0x06, true)) return raw.every((b) => b === 0) ? null : "bad";

  const dex = view.getUint16(0x08, true);
  if (dex === 0) return null;
  if (dex > MAX_SPECIES) return "bad";

  const tid = view.getUint16(0x0c, true);
  const sid = view.getUint16(0x0e, true);
  const pid = view.getUint32(0x18, true);
  const iv32 = view.getUint32(0x74, true);
  // Gen 6+ shiny rule: (TID ^ SID ^ PID.hi ^ PID.lo) < 16.
  const shinyXor = tid ^ sid ^ (pid >>> 16) ^ (pid & 0xffff);
  return {
    dex,
    nickname: utf16(data, 0x40, 12),
    otName: utf16(data, 0xb0, 12),
    level: isParty ? data[0xec] : levelFromExp(dex, view.getUint32(0x10, true)),
    shiny: shinyXor < 16,
    egg: ((iv32 >>> 30) & 1) === 1,
  };
}

function countBits(bytes: Uint8Array, offset: number, bits: number, extra: number[] = []): number {
  let count = 0;
  for (let i = 0; i < bits; i++) {
    const at = offset + (i >> 3);
    const mask = 1 << (i & 7);
    if (bytes[at] & mask || extra.some((o) => bytes[o + (i >> 3)] & mask)) count++;
  }
  return count;
}

export function parseGen6(bytes: Uint8Array, version: "xy" | "oras"): ParsedSave {
  const v = VERSIONS[version];
  if (bytes.length !== v.size) {
    const label = version === "xy" ? "Pokémon X/Y" : "Pokémon Rubis Oméga/Saphir Alpha";
    throw new Error(
      `Taille de fichier invalide pour ${label} : ${bytes.length} octets (0x${v.size.toString(16).toUpperCase()} attendus).`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const warnings: string[] = [];
  if (view.getUint32(bytes.length - 0x1f0, true) !== FOOTER_MAGIC) {
    warnings.push("Signature de fin de fichier absente : la sauvegarde est peut-être chiffrée ou corrompue.");
  }

  let badSlots = 0;
  const take = (mon: Mon | null | "bad", out: Mon[]) => {
    if (mon === "bad") badSlots++;
    else if (mon) out.push(mon);
  };

  const party: Mon[] = [];
  const partyCount = Math.min(bytes[PARTY + 6 * SIZE_PARTY], 6);
  for (let i = 0; i < partyCount; i++) {
    const at = PARTY + i * SIZE_PARTY;
    take(readMon(bytes.subarray(at, at + SIZE_PARTY), true), party);
  }

  const boxes = Array.from({ length: BOX_COUNT }, (_, b) => {
    const mons: Mon[] = [];
    for (let i = 0; i < BOX_SLOTS; i++) {
      const at = v.box + (b * BOX_SLOTS + i) * SIZE_STORED;
      take(readMon(bytes.subarray(at, at + SIZE_STORED), false), mons);
    }
    const name = utf16(bytes, BOX_LAYOUT + b * BOX_NAME_BYTES, BOX_NAME_BYTES / 2);
    return { name: name || `Boîte ${b + 1}`, mons };
  });
  if (badSlots) warnings.push(`${badSlots} Pokémon ignoré(s) : checksum invalide.`);

  let badges = 0;
  for (let i = 0; i < 8; i++) badges += (bytes[MISC + 0xc] >> i) & 1;

  const seenRegions = [1, 2, 3].map((r) => ZUKAN + 0x68 + r * DEX_BITS_BYTES);
  return {
    trainer: utf16(bytes, MY_STATUS + 0x48, 13),
    trainerId: view.getUint16(MY_STATUS, true),
    money: view.getUint32(MISC + 0x8, true),
    playTime: {
      hours: view.getUint16(PLAY_TIME, true),
      minutes: bytes[PLAY_TIME + 2],
      seconds: bytes[PLAY_TIME + 3],
    },
    badges,
    pokedex: {
      owned: countBits(bytes, ZUKAN + 0x8, MAX_SPECIES),
      seen: countBits(bytes, ZUKAN + 0x68, MAX_SPECIES, seenRegions),
    },
    party,
    boxes,
    warnings,
  };
}
