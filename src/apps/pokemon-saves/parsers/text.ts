// Character tables for international (English/European) releases.

const GB_CHARS: Record<number, string> = {
  0x7f: " ", 0x9a: "(", 0x9b: ")", 0x9c: ":", 0x9d: ";", 0x9e: "[", 0x9f: "]",
  0xba: "é", 0xe0: "'", 0xe1: "PK", 0xe2: "MN", 0xe3: "-", 0xe6: "?", 0xe7: "!",
  0xe8: ".", 0xef: "♂", 0xf1: "×", 0xf2: ".", 0xf3: "/", 0xf4: ",", 0xf5: "♀",
};
for (let i = 0; i < 26; i++) {
  GB_CHARS[0x80 + i] = String.fromCharCode(65 + i);
  GB_CHARS[0xa0 + i] = String.fromCharCode(97 + i);
}
for (let i = 0; i < 10; i++) GB_CHARS[0xf6 + i] = String(i);

/** Game Boy (gen 1 & 2) string, terminated by 0x50. */
export function gbText(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === 0x50) break;
    out += GB_CHARS[b] ?? "?";
  }
  return out;
}

const GBA_CHARS: Record<number, string> = {
  0x00: " ", 0xab: "!", 0xac: "?", 0xad: ".", 0xae: "-", 0xb0: "…", 0xb1: "“", 0xb2: "”",
  0xb3: "‘", 0xb4: "'", 0xb5: "♂", 0xb6: "♀", 0xb8: ",", 0xba: "/",
};
"ÀÁÂÇÈÉÊËÌ ÎÏÒÓÔŒÙÚÛÑßàá çèéêëì îïòóôœùúûñ".split("").forEach((c, i) => {
  if (c !== " ") GBA_CHARS[0x01 + i] = c;
});
for (let i = 0; i < 26; i++) {
  GBA_CHARS[0xbb + i] = String.fromCharCode(65 + i);
  GBA_CHARS[0xd5 + i] = String.fromCharCode(97 + i);
}
for (let i = 0; i < 10; i++) GBA_CHARS[0xa1 + i] = String(i);

/** Game Boy Advance (gen 3) string, terminated by 0xFF. */
export function gbaText(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === 0xff) break;
    out += GBA_CHARS[b] ?? "?";
  }
  return out.trim();
}

export function countBits(bytes: Uint8Array, offset: number, bitCount: number): number {
  let n = 0;
  for (let i = 0; i < bitCount; i++) n += (bytes[offset + (i >> 3)] >> (i & 7)) & 1;
  return n;
}
