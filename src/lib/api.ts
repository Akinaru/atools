// Small router used by the apps' APIs, mounted at /api/<app>/<path>.

export type ApiContext = { request: Request; params: Record<string, string>; url: URL };

export type ApiRoute = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path inside the app, with ":name" parameters, e.g. "saves/:id/file". */
  path: string;
  /** One line shown by GET /api (self-documentation). */
  description: string;
  /** Served without the API key (e.g. device pairing). */
  public?: boolean;
  handler: (context: ApiContext) => Response | Promise<Response>;
};

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** Finds the route matching the method and path segments, with its parameters. */
export function matchRoute(routes: ApiRoute[], method: string, segments: string[]) {
  let pathMatched = false;
  for (const route of routes) {
    const parts = route.path.split("/").filter(Boolean);
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const ok = parts.every((part, i) => {
      if (part.startsWith(":")) {
        params[part.slice(1)] = segments[i];
        return true;
      }
      return part === segments[i];
    });
    if (!ok) continue;
    pathMatched = true;
    if (route.method === method) return { route, params };
  }
  return pathMatched ? "method-not-allowed" : null;
}
