import { inflateRawSync } from "node:zlib";

// Minimal ZIP reader: Switch saves are folders, so backup clients may send them zipped.
// Supports stored and deflated entries (no ZIP64, no encryption), which is what zip tools produce for saves.

export type ZipEntry = { name: string; size: number; read: () => Uint8Array };

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_DIRECTORY) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Archive ZIP invalide.");

  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== CENTRAL_FILE_HEADER) throw new Error("Archive ZIP invalide.");
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const localHeader = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith("/")) continue;
    if (compressedSize === 0xffffffff) throw new Error("Archive ZIP64 non supportée.");

    entries.push({
      name,
      size,
      read: () => {
        if (view.getUint32(localHeader, true) !== LOCAL_FILE_HEADER) throw new Error("Archive ZIP invalide.");
        const start = localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data;
        if (method === 8) return new Uint8Array(inflateRawSync(data));
        throw new Error(`Compression ZIP non supportée (${method}).`);
      },
    });
  }
  return entries;
}
