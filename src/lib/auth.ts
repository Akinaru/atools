// Access control, configured with environment variables:
// - ATOOLS_PASSWORD: password for the web UI (HTTP Basic auth, any user name).
// - ATOOLS_API_KEY: key for API clients, sent as "Authorization: Bearer <key>" or "X-API-Key: <key>".
// In development, with neither set, everything is open. In production, a missing secret locks the
// matching surface instead of exposing it.

/** Constant-time string comparison (works in every runtime). */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function basicPassword(header: string): string | null {
  if (!header.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return null;
  }
}

const isProduction = () => process.env.NODE_ENV === "production";

/** Web UI: Basic auth with ATOOLS_PASSWORD. */
export function isUiAuthorized(request: Request): boolean {
  const password = process.env.ATOOLS_PASSWORD;
  if (!password) return !isProduction();
  const given = basicPassword(request.headers.get("authorization") ?? "");
  return given !== null && safeEqual(given, password);
}

/** API: API key, or the UI password (so the browser can call the API, e.g. downloads). */
export function isApiAuthorized(request: Request): boolean {
  const apiKey = process.env.ATOOLS_API_KEY;
  if (!apiKey && !process.env.ATOOLS_PASSWORD) return !isProduction();
  if (apiKey) {
    const header = request.headers.get("authorization") ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7) : (request.headers.get("x-api-key") ?? "");
    if (key && safeEqual(key, apiKey)) return true;
  }
  return isUiAuthorized(request);
}
