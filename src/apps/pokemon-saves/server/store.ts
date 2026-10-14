import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { appDataDir } from "@/lib/storage";
import { getGame, getGameBySwitchTitleId } from "../games";
import { parseSave, type Mon, type ParsedSave } from "../parsers";
import species from "../data/species.json";

export const SLUG = "pokemon-saves";
const ID_PATTERN = /^[0-9a-f-]{36}$/;

/** Info typed by hand: fills the gaps for games without a parser, or overrides parsed values. */
export type ManualInfo = {
  trainer?: string;
  location?: string;
  money?: number;
  hours?: number;
  /** One Pokémon per line or comma: "Pikachu 45, Dracaufeu 50". */
  team?: string;
};

export type SaveMeta = {
  id: string;
  gameId: string;
  label: string;
  notes: string;
  fileName: string;
  size: number;
  /** Last modification date of the save file on the source device (ISO). */
  fileDate: string;
  uploadedAt: string;
  manual: ManualInfo;
};

export type SaveView = SaveMeta & {
  parsed?: ParsedSave;
  parseError?: string;
  /** Parsed values merged with the manual ones (manual wins). */
  info: {
    trainer?: string;
    location?: string;
    money?: number;
    hours?: number;
    minutes?: number;
    party: Mon[];
  };
};

const saveDir = (id: string) => {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid save id");
  return appDataDir(SLUG, id);
};

export const MAX_SAVE_SIZE = 64 * 1024 * 1024;

/** Invalid input for an import; its message is safe to show to the user / API client. */
export class SaveImportError extends Error {}

export type SaveImport = {
  /** Game id from games.ts, or… */
  gameId?: string;
  /** …a Nintendo Switch title ID (lets a Switch homebrew send saves without knowing our ids). */
  titleId?: string;
  fileName: string;
  bytes: Uint8Array;
  label?: string;
  /** Last modification date of the file on the source device. */
  fileDate?: Date;
};

/** Validates and stores a new save. Used by the upload form and the API. */
export async function importSave(input: SaveImport): Promise<SaveMeta> {
  const game = input.gameId ? getGame(input.gameId) : input.titleId ? getGameBySwitchTitleId(input.titleId) : undefined;
  if (!game) throw new SaveImportError(input.titleId && !input.gameId ? `Aucun jeu connu pour le title ID ${input.titleId}.` : "Jeu inconnu.");
  if (input.bytes.length === 0) throw new SaveImportError("Fichier de save vide.");
  if (input.bytes.length > MAX_SAVE_SIZE) throw new SaveImportError("Fichier de save trop gros (64 Mo max).");

  const fileName = path.basename(input.fileName || "save.bin").slice(0, 200) || "save.bin";
  const fileDate = input.fileDate && !Number.isNaN(input.fileDate.getTime()) ? input.fileDate : new Date();
  const meta: SaveMeta = {
    id: randomUUID(),
    gameId: game.id,
    label: input.label?.trim().slice(0, 200) || fileName,
    notes: "",
    fileName,
    size: input.bytes.length,
    fileDate: fileDate.toISOString(),
    uploadedAt: new Date().toISOString(),
    manual: {},
  };
  const dir = saveDir(meta.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/save.bin`, input.bytes);
  await fs.writeFile(`${dir}/meta.json`, JSON.stringify(meta, null, 2));
  return meta;
}

export async function updateSave(id: string, patch: Partial<Pick<SaveMeta, "label" | "notes" | "manual">>) {
  const meta = await getSaveMeta(id);
  if (!meta) throw new Error("Save introuvable");
  await fs.writeFile(`${saveDir(id)}/meta.json`, JSON.stringify({ ...meta, ...patch }, null, 2));
}

export async function deleteSave(id: string) {
  await fs.rm(saveDir(id), { recursive: true, force: true });
}

export async function getSaveMeta(id: string): Promise<SaveMeta | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    return JSON.parse(await fs.readFile(`${saveDir(id)}/meta.json`, "utf8"));
  } catch {
    return null;
  }
}

export async function readSaveFile(id: string): Promise<Buffer> {
  return fs.readFile(`${saveDir(id)}/save.bin`);
}

export async function listSaves(): Promise<SaveMeta[]> {
  const ids = await fs.readdir(appDataDir(SLUG)).catch(() => []);
  const metas = await Promise.all(ids.map(getSaveMeta));
  return metas
    .filter((meta): meta is SaveMeta => meta !== null)
    .sort((a, b) => b.fileDate.localeCompare(a.fileDate));
}

/** Loads a save and parses it when its game has a parser. Parsing is cheap, so it is done on every read. */
export async function getSaveView(meta: SaveMeta): Promise<SaveView> {
  const format = getGame(meta.gameId)?.format;
  let parsed: ParsedSave | undefined;
  let parseError: string | undefined;
  if (format) {
    try {
      parsed = parseSave(format, new Uint8Array(await readSaveFile(meta.id)));
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }
  }
  const manualTeam = parseManualTeam(meta.manual.team);
  return {
    ...meta,
    parsed,
    parseError,
    info: {
      trainer: meta.manual.trainer || parsed?.trainer,
      location: meta.manual.location || parsed?.location,
      money: meta.manual.money ?? parsed?.money,
      hours: meta.manual.hours ?? parsed?.playTime.hours,
      minutes: meta.manual.hours === undefined ? parsed?.playTime.minutes : undefined,
      party: manualTeam.length ? manualTeam : (parsed?.party ?? []),
    },
  };
}

const normalize = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const DEX_BY_NAME = new Map<string, number>();
for (const names of [species.en, species.fr]) names.forEach((name, dex) => dex && DEX_BY_NAME.set(normalize(name), dex));

function parseManualTeam(team?: string): Mon[] {
  if (!team) return [];
  return team
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^(.+?)(?:\s+(?:nv|niv|lv|lvl)?\.?\s*(\d{1,3}))?$/i);
      const name = match?.[1] ?? entry;
      return { dex: DEX_BY_NAME.get(normalize(name)) ?? 0, nickname: name, level: match?.[2] ? Number(match[2]) : undefined };
    });
}
