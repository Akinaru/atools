import type { ReactNode } from "react";
import type { ApiRoute } from "@/lib/api";

export type AppPageProps = {
  /** URL segments after /apps/<slug>, e.g. /apps/foo/a/b -> ["a", "b"]. */
  path: string[];
};

/** An app of the dashboard: one folder in src/apps/<slug>/, registered in src/apps/registry.ts. */
export type App = {
  /** Id used everywhere: UI at /apps/<slug>, API at /api/<slug>/..., files in <data>/<slug>/. */
  slug: string;
  name: string;
  description: string;
  /** Emoji shown on the home tile when there is no cover. */
  icon: string;
  /** Any CSS color or gradient. */
  accent: string;
  /** Optional square image for the home screen tile (path in public/). */
  cover?: string;
  /** Title of the browser tab for a sub-page (`path` as in Page), e.g. "Octobre 2026 · Monnaie". Default: `name`. */
  title?: (path: string[]) => string | Promise<string>;
  /** Server component rendering the app. Use `path` for sub-pages. */
  Page?: (props: AppPageProps) => ReactNode | Promise<ReactNode>;
  /** External app: the home tile opens this URL in a new tab instead of a page. */
  url?: string;
  /** Optional API routes, served at /api/<slug>/<route path> and protected by the API key. */
  api?: ApiRoute[];
  /**
   * Installable on its own (PWA): its pages link this web app manifest and icon. Both live in public/ (under
   * /assets/, which the login wall lets through, so the browser can fetch them).
   */
  pwa?: { manifest: string; appleIcon: string };
};
