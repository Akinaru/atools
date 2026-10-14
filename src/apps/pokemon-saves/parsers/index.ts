import type { SaveFormat } from "../games";
import { parseGen1 } from "./gen1";
import { parseGen2 } from "./gen2";
import { parseGen3 } from "./gen3";
import { parseGen5 } from "./gen5";
import { parseGen6 } from "./gen6";
import { parseLetsGo } from "./gen7b";
import { parseLegendsArceus, parseSwordShield } from "./gen8";
import type { ParsedSave } from "./types";

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
