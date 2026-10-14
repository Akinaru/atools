import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { appDataDir } from "@/lib/storage";
import { getGame, resolveGame, type Game } from "../games";
import { parseSaveFile, type Mon, type ParsedSave } from "../parsers";
import species from "../data/species.json";

export const SLUG = "pokemon-saves";
const ID_PATTERN = /^[0-9a-f-]{36}$/;
const SLOT_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const VERSION_PATTERN = /^[0-9TZ-]{15,30}$/;
export const MAX_SAVE_SIZE = 64 * 1024 * 1024;
/** Previous files kept when a save is overwritten. */
const MAX_VERSIONS = 10;

/** Info typed by hand: fills the gaps for games without a parser, or overrides parsed values. */
export type ManualInfo = {
  trainer?: string;
  location?: string;
  money?: number;
  hours?: number;
  /** One Pokémon per line or comma: "Pikachu 45, Dracaufeu 50". */
  team?: string;
};

/** A previous file of a save, kept in <save>/versions/<id>.bin. */
export type SaveVersion = { id: string; fileName: string; size: number; sha256: string; fileDate: string; replacedAt: string };

export type SaveMeta = {
  id: string;
  gameId: string;
  label: string;
  notes: string;
  fileName: string;
  size: number;
  /** SHA-256 of the current file (lets backup clients skip unchanged saves). */
  sha256: string;
  /** Last modification date of the save file on the source device (ISO). */
  fileDate: string;
  uploadedAt: string;
  /** Last time the file was replaced. */
  updatedAt: string;
  /** Backup slot name: a save with a slot is updated in place by PUT /backups/<game>/<slot>. */
  slot?: string;
  source: "web" | "api";
  manual: ManualInfo;
  versions: SaveVersion[];
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

/** Invalid input for an import; its message is safe to show to the user / API client. */
export class SaveImportError extends Error {}

/** A save file as received (form or API). */
export type SaveFile = {
  fileName: string;
  bytes: Uint8Array;
  /** Last modification date of the file on the source device. */
  fileDate?: Date;
};

export type WriteResult = { status: "created" | "updated" | "unchanged"; meta: SaveMeta };

const saveDir = (id: string) => {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid save id");
  return appDataDir(SLUG, id);
};

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function checkFile(file: SaveFile) {
  if (file.bytes.length === 0) throw new SaveImportError("Fichier de save vide.");
  if (file.bytes.length > MAX_SAVE_SIZE) throw new SaveImportError("Fichier de save trop gros (64 Mo max).");
  return {
    fileName: path.basename(file.fileName || "save.bin").slice(0, 200) || "save.bin",
    size: file.bytes.length,
    sha256: sha256(file.bytes),
    fileDate: (file.fileDate && !Number.isNaN(file.fileDate.getTime()) ? file.fileDate : new Date()).toISOString(),
  };
}

export function findGame(ref: string | undefined): Game {
  const game = ref ? resolveGame(ref) : undefined;
  if (!game) throw new SaveImportError(ref ? `Jeu inconnu : « ${ref} » (id du catalogue ou title ID Switch attendu).` : "Jeu manquant.");
  return game;
}

async function writeMeta(meta: SaveMeta) {
  await fs.writeFile(`${saveDir(meta.id)}/meta.json`, JSON.stringify(meta, null, 2));
}

// Writes to one save (or one backup slot) run one after the other, so two uploads can't interleave.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  locks.set(key, run);
  run.finally(() => locks.get(key) === run && locks.delete(key)).catch(() => {});
  return run;
}

/** Stores a new save. */
export async function createSave(
  game: Game,
  file: SaveFile,
  options: { label?: string; slot?: string; source: SaveMeta["source"] },
): Promise<SaveMeta> {
  const checked = checkFile(file);
  if (options.slot !== undefined && !SLOT_PATTERN.test(options.slot)) {
    throw new SaveImportError("Nom de slot invalide (lettres, chiffres, . _ -, 64 max).");
  }
  const now = new Date().toISOString();
  const meta: SaveMeta = {
    id: randomUUID(),
    gameId: game.id,
    label: options.label?.trim().slice(0, 200) || (options.slot ? `${options.slot}` : checked.fileName),
    notes: "",
    ...checked,
    uploadedAt: now,
    updatedAt: now,
    slot: options.slot,
    source: options.source,
    manual: {},
    versions: [],
  };
  await fs.mkdir(saveDir(meta.id), { recursive: true });
  await fs.writeFile(`${saveDir(meta.id)}/save.bin`, file.bytes);
  await writeMeta(meta);
  return meta;
}

/**
 * Replaces the file of a save. The previous file is kept as a version (the last MAX_VERSIONS),
 * so a bad backup never destroys a good save. Sending the same file again changes nothing.
 */
export function replaceSaveFile(id: string, file: SaveFile, source: SaveMeta["source"]): Promise<WriteResult> {
  return withLock(id, async () => {
    const meta = await getSaveMeta(id);
    if (!meta) throw new SaveImportError("Save introuvable.");
    const checked = checkFile(file);
    if (checked.sha256 === meta.sha256) return { status: "unchanged", meta };

    const dir = saveDir(id);
    const version: SaveVersion = {
      id: new Date().toISOString().replace(/[:.]/g, "-"),
      fileName: meta.fileName,
      size: meta.size,
      sha256: meta.sha256,
      fileDate: meta.fileDate,
      replacedAt: new Date().toISOString(),
    };
    await fs.mkdir(`${dir}/versions`, { recursive: true });
    await fs.rename(`${dir}/save.bin`, `${dir}/versions/${version.id}.bin`);
    await fs.writeFile(`${dir}/save.bin`, file.bytes);

    const versions = [version, ...meta.versions];
    for (const old of versions.splice(MAX_VERSIONS)) await fs.rm(`${dir}/versions/${old.id}.bin`, { force: true });
    const updated: SaveMeta = { ...meta, ...checked, source, versions, updatedAt: new Date().toISOString() };
    await writeMeta(updated);
    return { status: "updated", meta: updated };
  });
}

/** Creates or updates the save of a backup slot (one per game and slot name). */
export function upsertSlot(game: Game, slot: string, file: SaveFile, label?: string): Promise<WriteResult> {
  return withLock(`slot:${game.id}:${slot}`, async () => {
    const existing = (await listSaves()).find((meta) => meta.gameId === game.id && meta.slot === slot);
    if (existing) return replaceSaveFile(existing.id, file, "api");
    return { status: "created", meta: await createSave(game, file, { label, slot, source: "api" }) };
  });
}

export async function updateSave(id: string, patch: Partial<Pick<SaveMeta, "label" | "notes" | "manual">>) {
  await withLock(id, async () => {
    const meta = await getSaveMeta(id);
    if (!meta) throw new Error("Save introuvable");
    await writeMeta({ ...meta, ...patch });
  });
}

export async function deleteSave(id: string) {
  await withLock(id, () => fs.rm(saveDir(id), { recursive: true, force: true }));
}

/** Reads meta.json, filling fields added after the first version of the app. */
export async function getSaveMeta(id: string): Promise<SaveMeta | null> {
  if (!ID_PATTERN.test(id)) return null;
  let meta: Partial<SaveMeta> & Pick<SaveMeta, "id" | "uploadedAt">;
  try {
    meta = JSON.parse(await fs.readFile(`${saveDir(id)}/meta.json`, "utf8"));
  } catch {
    return null;
  }
  const full = { source: "web", versions: [], updatedAt: meta.uploadedAt, ...meta } as SaveMeta;
  if (!full.sha256) {
    // Saves from before hashes existed: compute once and store it.
    full.sha256 = sha256(await readSaveFile(id));
    await writeMeta(full).catch(() => {});
  }
  return full;
}

export async function readSaveFile(id: string): Promise<Buffer> {
  return fs.readFile(`${saveDir(id)}/save.bin`);
}

export async function readVersionFile(id: string, versionId: string): Promise<Buffer | null> {
  if (!VERSION_PATTERN.test(versionId)) return null;
  return fs.readFile(`${saveDir(id)}/versions/${versionId}.bin`).catch(() => null);
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
      parsed = parseSaveFile(format, new Uint8Array(await readSaveFile(meta.id)));
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
