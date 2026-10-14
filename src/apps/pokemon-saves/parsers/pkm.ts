// Shared helpers for Gen 4+ Pokémon structures (PK5, PK6, PB7, PK8, PA8...), ported from PKHeX's PokeCrypto.

// For each shuffle value, the encrypted block index that holds canonical block 0..3.
// prettier-ignore
const BLOCK_POSITION = [
  0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2,
  2,0,1,3, 3,0,1,2, 2,0,3,1, 3,0,2,1, 1,2,0,3, 1,3,0,2, 2,1,0,3, 3,1,0,2,
  2,3,0,1, 3,2,0,1, 1,2,3,0, 1,3,2,0, 2,1,3,0, 3,1,2,0, 2,3,1,0, 3,2,1,0,
  // duplicates of 0-7 so (pv >> 13) & 31 needs no modulus
  0,1,2,3, 0,1,3,2, 0,2,1,3, 0,3,1,2, 0,2,3,1, 0,3,2,1, 1,0,2,3, 1,0,3,2,
];

/** XORs 16-bit words of data[start, end) with the Gen 4+ LCRNG stream. */
function cryptArray(data: Uint8Array, start: number, end: number, seed: number) {
  for (let i = start; i + 1 < end; i += 2) {
    seed = (Math.imul(0x41c64e6d, seed) + 0x6073) >>> 0;
    data[i] ^= (seed >>> 16) & 0xff;
    data[i + 1] ^= seed >>> 24;
  }
}

export type PkmLayout = {
  /** Size of the stored (box) structure; bytes after it are party stats. */
  storedSize: number;
  /** Size of one of the 4 shuffled blocks. */
  blockSize: number;
  /** Gen 4/5 seed the block cipher with the checksum, Gen 6+ with the encryption constant. */
  seed: "checksum" | "pv";
};

export const PK5: PkmLayout = { storedSize: 136, blockSize: 32, seed: "checksum" };
export const PK6: PkmLayout = { storedSize: 0xe8, blockSize: 56, seed: "pv" };
export const PK8: PkmLayout = { storedSize: 0x148, blockSize: 80, seed: "pv" };
export const PA8: PkmLayout = { storedSize: 0x168, blockSize: 88, seed: "pv" };

/** Returns a decrypted, unshuffled copy of an encrypted Pokémon (stored or party size). */
export function decryptPkm(encrypted: Uint8Array, layout: PkmLayout): Uint8Array {
  const data = encrypted.slice();
  const view = new DataView(data.buffer);
  const pv = view.getUint32(0, true);
  const seed = layout.seed === "checksum" ? view.getUint16(6, true) : pv;
  cryptArray(data, 8, layout.storedSize, seed);
  if (data.length > layout.storedSize) cryptArray(data, layout.storedSize, data.length, pv);

  const sv = (pv >>> 13) & 31;
  const blocks = data.slice(8, layout.storedSize);
  for (let i = 0; i < 4; i++) {
    const from = BLOCK_POSITION[sv * 4 + i] * layout.blockSize;
    data.set(blocks.subarray(from, from + layout.blockSize), 8 + i * layout.blockSize);
  }
  return data;
}

/** Sum of the 16-bit words of data[8, storedSize), as stored at offset 6. */
export function pkmChecksum(data: Uint8Array, layout: PkmLayout): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let sum = 0;
  for (let i = 8; i < layout.storedSize; i += 2) sum += view.getUint16(i, true);
  return sum & 0xffff;
}

/** UTF-16LE string stopping at `terminator` (0x0000 for Gen 6+, 0xFFFF for Gen 4/5). */
export function utf16(bytes: Uint8Array, offset: number, maxChars: number, terminator = 0): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let out = "";
  for (let i = 0; i < maxChars; i++) {
    const code = view.getUint16(offset + i * 2, true);
    if (code === terminator || code === 0) break;
    out += String.fromCharCode(code);
  }
  return remapPrivateChars(out);
}

/** Game Freak stores ♂/♀ and a few symbols in the Unicode private use area. */
export function remapPrivateChars(text: string): string {
  return text.replace(/[⑩]/g, "♂").replace(/[⑪]/g, "♀").replace(//g, "…");
}
