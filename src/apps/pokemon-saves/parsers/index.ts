import type { SaveFormat } from "../games";
import { parseGen1 } from "./gen1";
import { parseGen2 } from "./gen2";
import { parseGen3 } from "./gen3";
import { parseGen5 } from "./gen5";
import { parseGen6 } from "./gen6";
import { parseLetsGo } from "./gen7b";
import { parseLegendsArceus, parseSwordShield } from "./gen8";
import type { ParsedSave } from "./types";
import { isZip, readZip } from "./zip";

export type { Box, Mon, ParsedSave } from "./types";

export function parseSave(format: SaveFormat, bytes: Uint8Array): ParsedSave {
  switch (format) {
    case "gen1": return parseGen1(bytes);
    case "gen2-gs": return parseGen2(bytes, "gs");
    case "gen2-c": return parseGen2(bytes, "crystal");
    case "gen3-rs": return parseGen3(bytes, "rs");
    case "gen3-e": return parseGen3(bytes, "emerald");
    case "gen3-frlg": return parseGen3(bytes, "frlg");
    case "gen5-bw": return parseGen5(bytes);
    case "gen6-xy": return parseGen6(bytes, "xy");
    case "gen6-oras": return parseGen6(bytes, "oras");
    case "gen7b": return parseLetsGo(bytes);
    case "gen8-swsh": return parseSwordShield(bytes);
    case "gen8-la": return parseLegendsArceus(bytes);
  }
}

// Name of the main save file inside a zipped save folder (Switch games store a folder).
const MAIN_FILE: Partial<Record<SaveFormat, string>> = {
  gen7b: "savedata.bin",
  "gen8-swsh": "main",
  "gen8-la": "main",
};

/**
 * Parses a stored save: either the raw save file or a ZIP of the save folder. In a ZIP, the
 * format's main file is used, or the biggest file when the name is unknown.
 */
export function parseSaveFile(format: SaveFormat, bytes: Uint8Array): ParsedSave {
  if (!isZip(bytes)) return parseSave(format, bytes);
  const entries = readZip(bytes);
  const wanted = MAIN_FILE[format];
  const entry =
    entries.find((e) => wanted && e.name.split("/").pop() === wanted) ??
    [...entries].sort((a, b) => b.size - a.size)[0];
  if (!entry) throw new Error("Archive ZIP vide.");
  return parseSave(format, entry.read());
}
