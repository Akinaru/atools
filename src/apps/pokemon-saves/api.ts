import { apiError, json, type ApiContext, type ApiRoute } from "@/lib/api";
import { PairingError, pollPairing, startPairing } from "@/lib/pairing";
import { clientIp } from "@/lib/rate-limit";
import { GAMES, getGame } from "./games";
import type { Mon } from "./parsers";
import {
  createSave,
  deleteSave,
  findGame,
  getSaveMeta,
  getSaveView,
  listSaves,
  readSaveFile,
  readVersionFile,
  replaceSaveFile,
  SaveImportError,
  upsertSlot,
  type SaveFile,
  type SaveMeta,
  type SaveView,
  type WriteResult,
} from "./server/store";
import species from "./data/species.json";

// API of the app, served at /api/pokemon-saves/... (see src/app/api/[app]).
// Uploads accept either a raw body (query: filename, modified, label) or multipart/form-data
// (fields: file, label, fileDate). A Switch save folder can be sent as a .zip.

const monJson = (mon: Mon) => ({ ...mon, species: species.fr[mon.dex] ?? null });

function summary(save: SaveView) {
  const game = getGame(save.gameId);
  return {
    id: save.id,
    game: { id: save.gameId, name: game ? `Pokémon ${game.name}` : save.gameId },
    label: save.label,
    slot: save.slot ?? null,
    fileName: save.fileName,
    size: save.size,
    sha256: save.sha256,
    fileDate: save.fileDate,
    uploadedAt: save.uploadedAt,
    updatedAt: save.updatedAt,
    versions: save.versions.length,
    trainer: save.info.trainer ?? null,
    money: save.info.money ?? null,
    playTime: save.info.hours === undefined ? null : { hours: save.info.hours, minutes: save.info.minutes ?? null },
    location: save.info.location ?? null,
    badges: save.parsed?.badges ?? null,
    party: save.info.party.map(monJson),
    url: `/apps/pokemon-saves/save/${save.id}`,
  };
}

/** "1712345678901" (ms) or an ISO date. */
function parseDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  return new Date(/^\d+$/.test(value) ? Number(value) : value);
}

/** Reads the uploaded file and the extra fields, from a multipart form or a raw body. */
async function readUpload({ request, url }: ApiContext): Promise<{ file: SaveFile; field: (key: string) => string | undefined }> {
  const query = url.searchParams;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new SaveImportError("Champ « file » manquant.");
    const field = (key: string) => (typeof form.get(key) === "string" ? (form.get(key) as string) : undefined) || query.get(key) || undefined;
    return {
      file: { fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()), fileDate: parseDate(field("fileDate") ?? field("modified")) ?? new Date(file.lastModified) },
      field,
    };
  }
  const field = (key: string) => query.get(key) || undefined;
  return {
    file: { fileName: field("filename") ?? "save.bin", bytes: new Uint8Array(await request.arrayBuffer()), fileDate: parseDate(field("modified") ?? field("fileDate")) },
    field,
  };
}

async function writeResponse(result: WriteResult) {
  return json(
    { status: result.status, save: summary(await getSaveView(result.meta)) },
    { status: result.status === "created" ? 201 : 200 },
  );
}

/** Turns import errors into 400 responses. */
function guarded(handler: ApiRoute["handler"]): ApiRoute["handler"] {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      if (error instanceof SaveImportError) return apiError(error.message === "Save introuvable." ? 404 : 400, error.message);
      throw error;
    }
  };
}

const backupEntry = (meta: SaveMeta) => ({
  id: meta.id,
  game: meta.gameId,
  slot: meta.slot,
  sha256: meta.sha256,
  size: meta.size,
  fileDate: meta.fileDate,
  updatedAt: meta.updatedAt,
  versions: meta.versions.length,
});

export const api: ApiRoute[] = [
  {
    method: "GET",
    path: "games",
    description: "Catalogue des jeux (id, génération, lecture auto, title ID Switch).",
    handler: () =>
      json(GAMES.map(({ id, name, gen, platform, year, format, switchTitleId, ndsGameCodes }) => ({ id, name: `Pokémon ${name}`, gen, platform, year, autoRead: !!format, switchTitleId: switchTitleId ?? null, ndsGameCodes: ndsGameCodes ?? [] }))),
  },

  // --- Device pairing (public): the device shows a code, the user approves it on /apps/pokemon-saves/pair ---
  {
    method: "POST",
    path: "pair",
    public: true,
    description: "Démarre un appairage : renvoie un code à saisir sur le site et un pairingId à interroger (sans clé API).",
    handler: async ({ request }) => {
      let body: unknown = {};
      const text = await request.text();
      if (text.trim()) {
        try {
          body = JSON.parse(text);
        } catch {
          return apiError(400, "Corps JSON invalide.");
        }
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return apiError(400, "Corps JSON invalide.");
      try {
        return json(startPairing((body as { device?: unknown }).device, clientIp(request.headers)), { status: 201 });
      } catch (error) {
        if (error instanceof PairingError) return apiError(error.status, error.message);
        throw error;
      }
    },
  },
  {
    method: "GET",
    path: "pair/:pairingId",
    public: true,
    description: "État d'un appairage : pending, puis approved avec la clé API (une seule fois) (sans clé API).",
    handler: ({ params }) => {
      const result = pollPairing(params.pairingId);
      return result ? json(result) : apiError(404, "Appairage inconnu, expiré ou déjà utilisé.");
    },
  },

  // --- Backup (for the Switch app): one save per game and slot, updated in place ---
  {
    method: "GET",
    path: "backups",
    description: "Saves de backup (jeu, slot, sha256…) : compare les sha256 pour n'envoyer que ce qui a changé.",
    handler: async () => json((await listSaves()).filter((meta) => meta.slot).map(backupEntry)),
  },
  {
    method: "PUT",
    path: "backups/:game/:slot",
    description:
      "Ajoute ou met à jour la save du slot (jeu = id ou title ID Switch). Réponse status: created | updated | unchanged. L'ancienne version est conservée.",
    handler: guarded(async (context) => {
      const game = findGame(context.params.game);
      const { file, field } = await readUpload(context);
      return writeResponse(await upsertSlot(game, context.params.slot, file, field("label")));
    }),
  },

  // --- Saves one by one ---
  {
    method: "GET",
    path: "saves",
    description: "Liste des saves avec leur résumé (filtres : ?game=, ?slot=).",
    handler: async ({ url }) => {
      const game = url.searchParams.get("game");
      const slot = url.searchParams.get("slot");
      const metas = (await listSaves()).filter((m) => (!game || m.gameId === game) && (!slot || m.slot === slot));
      return json((await Promise.all(metas.map(getSaveView))).map(summary));
    },
  },
  {
    method: "POST",
    path: "saves",
    description: "Ajoute une nouvelle save (game ou titleId, + label et slot optionnels).",
    handler: guarded(async (context) => {
      const { file, field } = await readUpload(context);
      const game = findGame(field("game") ?? field("gameId") ?? field("titleId"));
      return writeResponse({ status: "created", meta: await createSave(game, file, { label: field("label"), slot: field("slot"), source: "api" }) });
    }),
  },
  {
    method: "GET",
    path: "saves/:id",
    description: "Détail complet d'une save (équipe, boîtes, badges, Pokédex, versions).",
    handler: async ({ params }) => {
      const meta = await getSaveMeta(params.id);
      if (!meta) return apiError(404, "Save introuvable.");
      const save = await getSaveView(meta);
      const parsed = save.parsed;
      return json({
        ...summary(save),
        notes: save.notes,
        trainerId: parsed?.trainerId ?? null,
        rival: parsed?.rival ?? null,
        pokedex: parsed?.pokedex ?? null,
        boxes: parsed?.boxes.map((box) => ({ name: box.name, mons: box.mons.map(monJson) })) ?? [],
        versions: save.versions,
        warnings: parsed?.warnings ?? [],
        parseError: save.parseError ?? null,
      });
    },
  },
  {
    method: "PUT",
    path: "saves/:id",
    description: "Écrase le fichier d'une save (l'ancien est gardé en version). status: updated | unchanged.",
    handler: guarded(async (context) => {
      const { file } = await readUpload(context);
      return writeResponse(await replaceSaveFile(context.params.id, file, "api"));
    }),
  },
  {
    method: "DELETE",
    path: "saves/:id",
    description: "Supprime une save et ses versions.",
    handler: async ({ params }) => {
      if (!(await getSaveMeta(params.id))) return apiError(404, "Save introuvable.");
      await deleteSave(params.id);
      return new Response(null, { status: 204 });
    },
  },
  {
    method: "GET",
    path: "saves/:id/file",
    description: "Télécharge le fichier de save actuel.",
    handler: async ({ params }) => {
      const meta = await getSaveMeta(params.id);
      if (!meta) return apiError(404, "Save introuvable.");
      return download(await readSaveFile(meta.id), meta.fileName);
    },
  },
  {
    method: "GET",
    path: "saves/:id/versions/:version/file",
    description: "Télécharge une version précédente (id dans la liste « versions »).",
    handler: async ({ params }) => {
      const meta = await getSaveMeta(params.id);
      const version = meta?.versions.find((v) => v.id === params.version);
      const bytes = version && (await readVersionFile(params.id, version.id));
      if (!version || !bytes) return apiError(404, "Version introuvable.");
      return download(bytes, version.fileName);
    },
  },
];

function download(bytes: Uint8Array, fileName: string) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
