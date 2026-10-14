import { randomBytes, randomInt } from "node:crypto";
import { createDevice } from "./devices";

// Device pairing by short code:
// 1. The device calls startPairing() and shows the code.
// 2. The user types the code in the web UI: approvePairing() creates a device key.
// 3. The device polls pollPairing(), which returns the key once, then forgets the pairing.
// Pairings live in memory only (10 minutes), so the plain key is never written to disk.

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const TTL = 10 * 60_000;
export const POLL_INTERVAL = 5;
const MAX_PENDING = 1000;
const MAX_DEVICE_NAME = 64;

type Pairing = { id: string; code: string; device: string; expiresAt: number; approved: boolean; apiKey?: string };

// On globalThis: route handlers and Server Actions may load separate copies of this module.
type PairingState = { pairings: Map<string, Pairing>; hits: Map<string, number[]> };
const state: PairingState = ((globalThis as { __atoolsPairing?: PairingState }).__atoolsPairing ??= {
  pairings: new Map(),
  hits: new Map(),
});

/** Sliding-window limiter: false once `max` hits were recorded for `key` in the last `windowMs`. */
function underLimit(key: string, max: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const recent = (state.hits.get(key) ?? []).filter((time) => now - time < windowMs);
  state.hits.set(key, recent);
  return recent.length < max;
}

function hit(key: string) {
  state.hits.set(key, [...(state.hits.get(key) ?? []), Date.now()]);
}

function purgeExpired() {
  const now = Date.now();
  for (const [id, pairing] of state.pairings) if (pairing.expiresAt <= now) state.pairings.delete(id);
  for (const [key, times] of state.hits) if (times.every((time) => now - time >= 60_000)) state.hits.delete(key);
}

/** Client IP behind the reverse proxy (Coolify/Traefik), for rate limits. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}

/** "k7m-2qx" → "K7M2QX". */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");

export class PairingError extends Error {
  constructor(public status: 400 | 429, message: string) {
    super(message);
  }
}

export function startPairing(deviceName: unknown, ip: string) {
  purgeExpired();
  if (deviceName !== undefined && typeof deviceName !== "string") throw new PairingError(400, "« device » doit être une chaîne.");
  const device = (deviceName ?? "").trim() || "Appareil";
  if (device.length > MAX_DEVICE_NAME) throw new PairingError(400, `« device » : ${MAX_DEVICE_NAME} caractères maximum.`);
  if (!underLimit(`start:${ip}`, 10)) throw new PairingError(429, "Trop de demandes d'appairage, réessaie dans une minute.");
  if (state.pairings.size >= MAX_PENDING) throw new PairingError(429, "Trop d'appairages en attente, réessaie plus tard.");
  hit(`start:${ip}`);

  const pending = new Set([...state.pairings.values()].map((p) => p.code));
  let code: string;
  do code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  while (pending.has(code));

  const pairing: Pairing = { id: randomBytes(32).toString("base64url"), code, device, expiresAt: Date.now() + TTL, approved: false };
  state.pairings.set(pairing.id, pairing);
  return { pairingId: pairing.id, code, expiresAt: new Date(pairing.expiresAt).toISOString(), interval: POLL_INTERVAL };
}

/** null: unknown, expired or already consumed. The key is returned once, then the pairing is gone. */
export function pollPairing(id: string): { status: "pending" } | { status: "approved"; apiKey: string } | null {
  purgeExpired();
  const pairing = state.pairings.get(id);
  if (!pairing) return null;
  if (!pairing.apiKey) return { status: "pending" };
  state.pairings.delete(id);
  return { status: "approved", apiKey: pairing.apiKey };
}

/** Approves the pairing showing `rawCode`. `limitKey` identifies the user (5 wrong codes per minute). */
export async function approvePairing(rawCode: string, limitKey: string): Promise<{ device: string }> {
  purgeExpired();
  const key = `approve:${limitKey}`;
  if (!underLimit(key, 5)) throw new PairingError(429, "Trop de codes faux, réessaie dans une minute.");
  const code = normalizeCode(rawCode);
  const pairing = [...state.pairings.values()].find((p) => p.code === code && !p.approved);
  if (!pairing) {
    hit(key);
    throw new PairingError(400, "Code inconnu ou expiré.");
  }
  pairing.approved = true; // Set before the await: a second approval of the same code fails.
  try {
    pairing.apiKey = (await createDevice(pairing.device)).apiKey;
  } catch (error) {
    pairing.approved = false;
    throw error;
  }
  return { device: pairing.device };
}
