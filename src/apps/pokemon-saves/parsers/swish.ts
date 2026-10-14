// "SwishCrypto" save container used by Sword/Shield, Legends: Arceus and Scarlet/Violet,
// ported from PKHeX's Saves/Encryption/SwishCrypto (SwishCrypto.cs, SCBlock.cs, SCXorShift32.cs).
// File layout: [blocks...][SHA-256 hash (0x20)], the block area being XORed with a static 0x7F-byte pad.
import { createHash } from "node:crypto";

const HASH_SIZE = 0x20;

// prettier-ignore
const INTRO_HASH_BYTES = new Uint8Array([
  0x9E,0xC9,0x9C,0xD7,0x0E,0xD3,0x3C,0x44,0xFB,0x93,0x03,0xDC,0xEB,0x39,0xB4,0x2A,
  0x19,0x47,0xE9,0x63,0x4B,0xA2,0x33,0x44,0x16,0xBF,0x82,0xA2,0xBA,0x63,0x55,0xB6,
  0x3D,0x9D,0xF2,0x4B,0x5F,0x7B,0x6A,0xB2,0x62,0x1D,0xC2,0x1B,0x68,0xE5,0xC8,0xB5,
  0x3A,0x05,0x90,0x00,0xE8,0xA8,0x10,0x3D,0xE2,0xEC,0xF0,0x0C,0xB2,0xED,0x4F,0x6D,
]);

// prettier-ignore
const OUTRO_HASH_BYTES = new Uint8Array([
  0xD6,0xC0,0x1C,0x59,0x8B,0xC8,0xB8,0xCB,0x46,0xE1,0x53,0xFC,0x82,0x8C,0x75,0x75,
  0x13,0xE0,0x45,0xDF,0x32,0x69,0x3C,0x75,0xF0,0x59,0xF8,0xD9,0xA2,0x5F,0xB2,0x17,
  0xE0,0x80,0x52,0xDB,0xEA,0x89,0x73,0x99,0x75,0x79,0xAF,0xCB,0x2E,0x80,0x07,0xE6,
  0xF1,0x26,0xE0,0x03,0x0A,0xE6,0x6F,0xF6,0x41,0xBF,0x7E,0x59,0xC2,0xAE,0x55,0xFD,
]);

// 0x7F-byte pad, applied cyclically (PKHeX pads it to 0x80 for vectorisation, the last byte being 0).
// prettier-ignore
const STATIC_XORPAD = new Uint8Array([
  0xA0,0x92,0xD1,0x06,0x07,0xDB,0x32,0xA1,0xAE,0x01,0xF5,0xC5,0x1E,0x84,0x4F,0xE3,
  0x53,0xCA,0x37,0xF4,0xA7,0xB0,0x4D,0xA0,0x18,0xB7,0xC2,0x97,0xDA,0x5F,0x53,0x2B,
  0x75,0xFA,0x48,0x16,0xF8,0xD4,0x8A,0x6F,0x61,0x05,0xF4,0xE2,0xFD,0x04,0xB5,0xA3,
  0x0F,0xFC,0x44,0x92,0xCB,0x32,0xE6,0x1B,0xB9,0xB1,0x2E,0x01,0xB0,0x56,0x53,0x36,
  0xD2,0xD1,0x50,0x3D,0xDE,0x5B,0x2E,0x0E,0x52,0xFD,0xDF,0x2F,0x7B,0xCA,0x63,0x50,
  0xA4,0x67,0x5D,0x23,0x17,0xC0,0x52,0xE1,0xA6,0x30,0x7C,0x2B,0xB6,0x70,0x36,0x5B,
  0x2A,0x27,0x69,0x33,0xF5,0x63,0x7B,0x36,0x3F,0x26,0x9B,0xA3,0xED,0x7A,0x53,0x00,
  0xA4,0x48,0xB3,0x50,0x9E,0x14,0xA0,0x52,0xDE,0x7E,0x10,0x2B,0x1B,0x77,0x6E,
]);

/** SCTypeCode: how a block's payload is stored. */
export const SCType = {
  Bool1: 1, // false
  Bool2: 2, // true
  Bool3: 3, // only seen as an array element type
  Object: 4,
  Array: 5,
  Byte: 8,
  UInt16: 9,
  UInt32: 10,
  UInt64: 11,
  SByte: 12,
  Int16: 13,
  Int32: 14,
  Int64: 15,
  Single: 16,
  Double: 17,
} as const;

const TYPE_SIZE: Record<number, number> = {
  [SCType.Bool3]: 1,
  [SCType.Byte]: 1,
  [SCType.UInt16]: 2,
  [SCType.UInt32]: 4,
  [SCType.UInt64]: 8,
  [SCType.SByte]: 1,
  [SCType.Int16]: 2,
  [SCType.Int32]: 4,
  [SCType.Int64]: 8,
  [SCType.Single]: 4,
  [SCType.Double]: 8,
};

export type SCBlock = {
  key: number;
  type: number;
  /** Element type for Array blocks. */
  subType?: number;
  /** Decrypted payload (empty for boolean blocks). */
  data: Uint8Array;
};

export type SwishSave = {
  /** Block key -> decrypted payload (Object, Array and scalar blocks). */
  blocks: Map<number, Uint8Array>;
  /** Block key -> value of boolean blocks (Bool1 = false, Bool2 = true). */
  bools: Map<number, boolean>;
  /** Block key -> full block (type information included). */
  raw: Map<number, SCBlock>;
  hashValid: boolean;
};

export function typeSize(type: number): number {
  const size = TYPE_SIZE[type];
  if (size === undefined) throw new Error(`Type de bloc inconnu (${type}).`);
  return size;
}

/** XORs data in place with the cyclic static pad (self-inverse). */
export function cryptStaticXorpad(data: Uint8Array) {
  const n = STATIC_XORPAD.length;
  for (let i = 0; i < data.length; i++) data[i] ^= STATIC_XORPAD[i % n];
}

/** SHA-256(intro || payload || outro), as stored in the last 0x20 bytes of the file. */
export function swishHash(payload: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(INTRO_HASH_BYTES).update(payload).update(OUTRO_HASH_BYTES).digest());
}

function xorshift(state: number): number {
  state ^= state << 2;
  state ^= state >>> 15;
  state ^= state << 13;
  return state >>> 0;
}

function popCount(value: number): number {
  let count = 0;
  for (let v = value >>> 0; v; v &= v - 1) count++;
  return count;
}

/** Per-block keystream (SCXorShift32): seeded with the block key, consumed byte by byte. */
export class SCXorShift32 {
  private state: number;
  private counter = 0;

  constructor(seed: number) {
    let state = seed >>> 0;
    const rounds = popCount(state);
    for (let i = 0; i < rounds; i++) state = xorshift(state);
    this.state = state;
  }

  next(): number {
    const result = (this.state >>> (this.counter * 8)) & 0xff;
    if (this.counter === 3) {
      this.state = xorshift(this.state);
      this.counter = 0;
    } else {
      this.counter++;
    }
    return result;
  }

  next32(): number {
    return (this.next() | (this.next() << 8) | (this.next() << 16) | (this.next() << 24)) >>> 0;
  }
}

function readBlock(data: Uint8Array, view: DataView, offset: number): { block: SCBlock; offset: number } {
  const key = view.getUint32(offset, true);
  offset += 4;
  const xk = new SCXorShift32(key);
  const type = data[offset++] ^ xk.next();

  let length: number;
  let subType: number | undefined;
  switch (type) {
    case SCType.Bool1:
    case SCType.Bool2:
    case SCType.Bool3:
      return { block: { key, type, data: new Uint8Array(0) }, offset };
    case SCType.Object:
      length = (view.getUint32(offset, true) ^ xk.next32()) >>> 0;
      offset += 4;
      break;
    case SCType.Array: {
      const count = (view.getUint32(offset, true) ^ xk.next32()) >>> 0;
      offset += 4;
      subType = data[offset++] ^ xk.next();
      length = count * typeSize(subType);
      break;
    }
    default:
      length = typeSize(type);
  }

  if (offset + length > data.length) throw new Error("Bloc tronqué dans la sauvegarde.");
  const payload = data.slice(offset, offset + length);
  for (let i = 0; i < payload.length; i++) payload[i] ^= xk.next();
  return { block: { key, type, subType, data: payload }, offset: offset + length };
}

/** Decrypts a SwishCrypto save and returns its blocks. Throws (in French) if the structure is invalid. */
export function decryptSwish(bytes: Uint8Array): SwishSave {
  if (bytes.length <= HASH_SIZE) throw new Error("Fichier trop petit pour une sauvegarde Switch.");
  const payload = bytes.slice(0, bytes.length - HASH_SIZE);
  const stored = bytes.subarray(bytes.length - HASH_SIZE);
  const computed = swishHash(payload);
  const hashValid = computed.every((b, i) => b === stored[i]);

  cryptStaticXorpad(payload);
  const view = new DataView(payload.buffer);
  const blocks = new Map<number, Uint8Array>();
  const bools = new Map<number, boolean>();
  const raw = new Map<number, SCBlock>();
  let offset = 0;
  try {
    while (offset < payload.length) {
      if (offset + 5 > payload.length) throw new Error("Bloc tronqué dans la sauvegarde.");
      const read = readBlock(payload, view, offset);
      offset = read.offset;
      const { block } = read;
      raw.set(block.key, block);
      if (block.type === SCType.Bool1 || block.type === SCType.Bool2) bools.set(block.key, block.type === SCType.Bool2);
      else blocks.set(block.key, block.data);
    }
  } catch (error) {
    const reason = error instanceof Error ? ` (${error.message.replace(/\.$/, "")})` : "";
    throw new Error(`Impossible de déchiffrer la sauvegarde : structure de blocs invalide${reason}.`);
  }
  return { blocks, bools, raw, hashValid };
}
