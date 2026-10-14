import fs from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { appDataDir } from "./storage";

// Device keys: per-device API keys created by pairing (see pairing.ts). Only their SHA-256 is
// stored; the plain key is shown once, to the device. They have the same rights as ATOOLS_API_KEY.

export type Device = {
  id: string;
  name: string;
  /** SHA-256 (hex) of the key. */
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const FILE = appDataDir("atools", "devices.json");
/** lastUsedAt is written at most once per minute per device. */
const TOUCH_INTERVAL = 60_000;

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

async function readDevices(): Promise<Device[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Device[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

// Writes are serialized (read-modify-write) and atomic (temp file + rename).
let queue: Promise<unknown> = Promise.resolve();
function updateDevices<T>(change: (devices: Device[]) => T): Promise<T> {
  const run = queue.catch(() => {}).then(async () => {
    const devices = await readDevices();
    const result = change(devices);
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(devices, null, 2));
    await fs.rename(tmp, FILE);
    return result;
  });
  queue = run;
  return run;
}

/** Newest first. */
export async function listDevices(): Promise<Device[]> {
  return (await readDevices()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Creates a device and returns its plain key (the only time it exists in clear). */
export async function createDevice(name: string): Promise<{ device: Device; apiKey: string }> {
  const apiKey = randomBytes(32).toString("base64url");
  const device: Device = { id: randomUUID(), name, keyHash: hashKey(apiKey), createdAt: new Date().toISOString(), lastUsedAt: null };
  await updateDevices((devices) => devices.push(device));
  return { device, apiKey };
}

export async function revokeDevice(id: string): Promise<void> {
  await updateDevices((devices) => {
    const index = devices.findIndex((device) => device.id === id);
    if (index >= 0) devices.splice(index, 1);
  });
}

/** True if `key` belongs to a paired device; records the use. */
export async function isDeviceKey(key: string): Promise<boolean> {
  const hash = hashKey(key);
  const device = (await readDevices()).find((d) => d.keyHash === hash);
  if (!device) return false;
  if (!device.lastUsedAt || Date.now() - Date.parse(device.lastUsedAt) > TOUCH_INTERVAL) {
    await updateDevices((devices) => {
      const current = devices.find((d) => d.id === device.id);
      if (current) current.lastUsedAt = new Date().toISOString();
    });
  }
  return true;
}
