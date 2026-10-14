import { apiError, json, type ApiRoute } from "@/lib/api";
import { GAMES, getGame } from "./games";
import type { Mon } from "./parsers";
import { deleteSave, getSaveMeta, getSaveView, importSave, listSaves, readSaveFile, SaveImportError, type SaveView } from "./server/store";
import species from "./data/species.json";

// API of the app, served at /api/pokemon-saves/... (see src/app/api/[app]).

const monJson = (mon: Mon) => ({ ...mon, species: species.fr[mon.dex] ?? null });

function summary(save: SaveView) {
  const game = getGame(save.gameId);
  return {
    id: save.id,
    game: { id: save.gameId, name: game ? `Pokémon ${game.name}` : save.gameId },
    label: save.label,
    fileName: save.fileName,
    size: save.size,
    fileDate: save.fileDate,
    uploadedAt: save.uploadedAt,
    trainer: save.info.trainer ?? null,
    money: save.info.money ?? null,
    playTime: save.info.hours === undefined ? null : { hours: save.info.hours, minutes: save.info.minutes ?? null },
    location: save.info.location ?? null,
    party: save.info.party.map(monJson),
  };
}

/** "1712345678901" (ms) or an ISO date. */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  return new Date(/^\d+$/.test(value) ? Number(value) : value);
}

export const api: ApiRoute[] = [
  {
    method: "GET",
    path: "games",
    description: "Catalogue des jeux (id, génération, lecture auto, title ID Switch).",
    handler: () =>
      json(GAMES.map(({ id, name, gen, platform, year, format, switchTitleId }) => ({ id, name: `Pokémon ${name}`, gen, platform, year, autoRead: !!format, switchTitleId: switchTitleId ?? null }))),
  },
  {
    method: "GET",
    path: "saves",
    description: "Liste des saves avec leur résumé (dresseur, argent, temps, équipe).",
    handler: async ({ url }) => {
      const game = url.searchParams.get("game");
      const metas = (await listSaves()).filter((meta) => !game || meta.gameId === game);
      return json((await Promise.all(metas.map(getSaveView))).map(summary));
    },
  },
  {
    method: "POST",
    path: "saves",
    description:
      "Envoie une save. Multipart (file, game ou titleId, label, fileDate) ou corps binaire brut avec ?game= ou ?titleId=, &filename=, &label=, &modified=.",
    handler: async ({ request, url }) => {
      const query = url.searchParams;
      try {
        let meta;
        if (request.headers.get("content-type")?.includes("multipart/form-data")) {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) return apiError(400, "Champ « file » manquant.");
          const field = (key: string) => (form.get(key) as string | null) || query.get(key) || undefined;
          meta = await importSave({
            gameId: field("game") ?? field("gameId"),
            titleId: field("titleId"),
            fileName: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
            label: field("label"),
            fileDate: parseDate(field("fileDate") ?? null) ?? new Date(file.lastModified),
          });
        } else {
          meta = await importSave({
            gameId: query.get("game") ?? undefined,
            titleId: query.get("titleId") ?? undefined,
            fileName: query.get("filename") ?? "save.bin",
            bytes: new Uint8Array(await request.arrayBuffer()),
            label: query.get("label") ?? undefined,
            fileDate: parseDate(query.get("modified")),
          });
        }
        return json({ ...summary(await getSaveView(meta)), url: `/apps/pokemon-saves/save/${meta.id}` }, { status: 201 });
      } catch (error) {
        if (error instanceof SaveImportError) return apiError(400, error.message);
        throw error;
      }
    },
  },
  {
    method: "GET",
    path: "saves/:id",
    description: "Détail complet d'une save (équipe, boîtes, badges, Pokédex…).",
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
        badges: parsed?.badges ?? null,
        pokedex: parsed?.pokedex ?? null,
        boxes: parsed?.boxes.map((box) => ({ name: box.name, mons: box.mons.map(monJson) })) ?? [],
        warnings: parsed?.warnings ?? [],
        parseError: save.parseError ?? null,
      });
    },
  },
  {
    method: "GET",
    path: "saves/:id/file",
    description: "Télécharge le fichier de save original.",
    handler: async ({ params }) => {
      const meta = await getSaveMeta(params.id);
      if (!meta) return apiError(404, "Save introuvable.");
      return new Response(new Uint8Array(await readSaveFile(meta.id)), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.fileName)}`,
        },
      });
    },
  },
  {
    method: "DELETE",
    path: "saves/:id",
    description: "Supprime une save.",
    handler: async ({ params }) => {
      if (!(await getSaveMeta(params.id))) return apiError(404, "Save introuvable.");
      await deleteSave(params.id);
      return new Response(null, { status: 204 });
    },
  },
];
