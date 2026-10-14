// Access control, configured with environment variables:
// - ATOOLS_PASSWORD: password of the web UI, typed on /login. The browser then keeps a session cookie.
// - ATOOLS_API_KEY: key for API clients, sent as "Authorization: Bearer <key>" or "X-API-Key: <key>".
//   Paired devices get their own keys, sent the same way (see devices.ts and pairing.ts).
// In development, with neither set, everything is open. In production, a missing secret locks the
// matching surface instead of exposing it.

import { createHmac } from "node:crypto";
import { isDeviceKey } from "./devices";

export const SESSION_COOKIE = "atools_session";
/** Session length, in seconds. */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/** Constant-time string comparison (works in every runtime). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const isProduction = () => process.env.NODE_ENV === "production";

/** True when the UI needs no login (development without ATOOLS_PASSWORD). */
export const isUiOpen = () => !process.env.ATOOLS_PASSWORD && !isProduction();

export function checkPassword(given: string): boolean {
  const password = process.env.ATOOLS_PASSWORD;
  return !!password && safeEqual(given, password);
}

// A session token is "<expiry ms>.<HMAC of the expiry>", signed with a key derived from the
// password: no server-side state, and changing the password logs every browser out.
const sign = (expires: string) => createHmac("sha256", `atools-session:${process.env.ATOOLS_PASSWORD}`).update(expires).digest("base64url");

export function createSessionToken(): string {
  const expires = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expires}.${sign(expires)}`;
}

function isValidSession(token: string): boolean {
  const [expires, signature] = token.split(".");
  return !!process.env.ATOOLS_PASSWORD && !!signature && Number(expires) > Date.now() && safeEqual(signature, sign(expires));
}

function cookieValue(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
}

/** Web UI: session cookie set by /login. */
export function isUiAuthorized(request: Request): boolean {
  if (isUiOpen()) return true;
  const token = cookieValue(request, SESSION_COOKIE);
  return !!token && isValidSession(token);
}

/**
 * API: API key, a paired device key (see devices.ts), or the UI session (so the browser can call the
 * API, e.g. downloads).
 */
export async function isApiAuthorized(request: Request): Promise<boolean> {
  const apiKey = process.env.ATOOLS_API_KEY;
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-api-key") ?? "");
  if (key && apiKey && safeEqual(key, apiKey)) return true;
  if (key && (await isDeviceKey(key))) return true;
  if (!apiKey && !process.env.ATOOLS_PASSWORD) return !isProduction();
  return isUiAuthorized(request);
}
