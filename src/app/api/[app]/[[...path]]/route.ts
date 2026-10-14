import { getApp } from "@/apps/registry";
import { apiError, json, matchRoute } from "@/lib/api";
import { isApiAuthorized } from "@/lib/auth";

/** Entry point of every app API: /api/<app>/<path>. */
async function handle(request: Request, ctx: RouteContext<"/api/[app]/[[...path]]">) {
  const { app: slug, path = [] } = await ctx.params;
  const app = getApp(slug);
  if (!app?.api) return apiError(404, `Aucune API pour « ${slug} ».`);
  if (!isApiAuthorized(request)) return apiError(401, "Clé API manquante ou invalide.");

  // GET /api/<app> lists the app's routes.
  if (!path.length && request.method === "GET") {
    return json({ app: app.slug, routes: app.api.map(({ method, path, description }) => ({ method, path: `/api/${app.slug}/${path}`, description })) });
  }

  const match = matchRoute(app.api, request.method, path.map(decodeURIComponent));
  if (match === null) return apiError(404, "Route inconnue.");
  if (match === "method-not-allowed") return apiError(405, "Méthode non autorisée.");
  try {
    return await match.route.handler({ request, params: match.params, url: new URL(request.url) });
  } catch (error) {
    console.error(`[api/${slug}]`, error);
    return apiError(500, "Erreur interne.");
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
