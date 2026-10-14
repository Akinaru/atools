"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revokeDevice } from "@/lib/devices";
import { approvePairing, PairingError } from "@/lib/pairing";
import { clientIp } from "@/lib/rate-limit";
import { createSave, deleteSave, findGame, getSaveMeta, replaceSaveFile, SaveImportError, updateSave, type ManualInfo, type SaveFile } from "./store";

export type UploadState = { error?: string; message?: string };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const optionalNumber = (formData: FormData, key: string) => {
  const value = text(formData, key);
  return value === "" || Number.isNaN(Number(value)) ? undefined : Number(value);
};

async function fileFromForm(formData: FormData): Promise<SaveFile | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return {
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    fileDate: new Date(Number(text(formData, "fileDate")) || Date.now()),
  };
}

export async function uploadSave(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const file = await fileFromForm(formData);
  if (!file) return { error: "Choisis un fichier de save." };
  let id: string;
  try {
    ({ id } = await createSave(findGame(text(formData, "gameId") || undefined), file, { label: text(formData, "label"), source: "web" }));
  } catch (error) {
    if (error instanceof SaveImportError) return { error: error.message };
    throw error;
  }
  redirect(`/apps/pokemon-saves/save/${id}`);
}

/** Replaces the file of a save from the web UI; the previous file is kept as a version. */
export async function replaceSave(id: string, _prev: UploadState, formData: FormData): Promise<UploadState> {
  const file = await fileFromForm(formData);
  if (!file) return { error: "Choisis un fichier de save." };
  try {
    const { status } = await replaceSaveFile(id, file, "web");
    refresh();
    return { message: status === "unchanged" ? "Fichier identique à la version actuelle : rien à changer." : "Save remplacée." };
  } catch (error) {
    if (error instanceof SaveImportError) return { error: error.message };
    throw error;
  }
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

/** Approves a device pairing from the code it shows. */
export async function approveDevice(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const code = text(formData, "code");
  if (!code) return { error: "Saisis le code affiché par l'appareil." };
  try {
    // The UI has a single shared password: the user is identified by their IP for the rate limit.
    const { device } = await approvePairing(code, clientIp(await headers()));
    refresh();
    return { message: `« ${device} » est appairé. L'appareil va recevoir sa clé.` };
  } catch (error) {
    if (error instanceof PairingError) return { error: error.message };
    throw error;
  }
}

export async function removeDevice(id: string) {
  await revokeDevice(id);
  refresh();
}
