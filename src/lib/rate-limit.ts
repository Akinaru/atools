// In-memory sliding-window rate limits (one server process), and the client IP to key them by.

// On globalThis: route handlers, Server Actions and the proxy may load separate copies of this module.
const hits: Map<string, number[]> = ((globalThis as { __atoolsRateLimit?: Map<string, number[]> }).__atoolsRateLimit ??= new Map());
const WINDOW = 60_000;

function recent(key: string): number[] {
  const now = Date.now();
  const times = (hits.get(key) ?? []).filter((time) => now - time < WINDOW);
  if (times.length) hits.set(key, times);
  else hits.delete(key);
  return times;
}

/** False once `max` hits were recorded for `key` in the last minute. */
export const underLimit = (key: string, max: number) => recent(key).length < max;

export function hit(key: string) {
  hits.set(key, [...recent(key), Date.now()]);
}

/** Client IP behind the reverse proxy (Coolify/Traefik). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "unknown";
}
