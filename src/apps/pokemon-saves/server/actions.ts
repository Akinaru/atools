"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { deleteSave, getSaveMeta, importSave, SaveImportError, updateSave, type ManualInfo } from "./store";

export type UploadState = { error?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optionalNumber = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return value === "" || Number.isNaN(Number(value)) ? undefined : Number(value);
};

export async function uploadSave(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis un fichier de save." };
  let id: string;
  try {
    ({ id } = await importSave({
      gameId: text(formData, "gameId") || undefined,
      fileName: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      label: text(formData, "label"),
      fileDate: new Date(Number(text(formData, "fileDate")) || Date.now()),
    }));
  } catch (error) {
    if (error instanceof SaveImportError) return { error: error.message };
    throw error;
  }
  redirect(`/apps/pokemon-saves/save/${id}`);
}

export async function editSave(id: string, formData: FormData) {
  const manual: ManualInfo = {
    trainer: text(formData, "trainer") || undefined,
    location: text(formData, "location") || undefined,
    money: optionalNumber(formData, "money"),
    hours: optionalNumber(formData, "hours"),
    team: text(formData, "team") || undefined,
  };
  await updateSave(id, { label: text(formData, "label"), notes: text(formData, "notes"), manual });
  refresh();
}

export async function removeSave(id: string) {
  const meta = await getSaveMeta(id);
  await deleteSave(id);
  redirect(meta ? `/apps/pokemon-saves/game/${meta.gameId}` : "/apps/pokemon-saves");
}
