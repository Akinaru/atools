import { apps } from "@/apps/registry";
import { isApiAuthorized } from "@/lib/auth";
import { apiError, json } from "@/lib/api";

/** GET /api: index of the general API, with each app's routes. */
export async function GET(request: Request) {
  if (!(await isApiAuthorized(request))) return apiError(401, "Clé API manquante ou invalide.");
  return json({
    name: "atools",
    apps: apps
      .filter((app) => app.api)
      .map((app) => ({
        app: app.slug,
        name: app.name,
        routes: app.api!.map(({ method, path, description }) => ({ method, path: `/api/${app.slug}/${path}`, description })),
      })),
  });
}
