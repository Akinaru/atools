import path from "node:path";

// Mount this folder as a persistent volume in production (see Dockerfile).
const DATA_ROOT = path.resolve(process.env.ATOOLS_DATA_DIR ?? path.join(process.cwd(), "data"));

/** Private on-disk folder of an app: <data>/<slug>/<...segments>. */
export function appDataDir(slug: string, ...segments: string[]): string {
  const root = path.join(DATA_ROOT, slug);
  const dir = path.join(root, ...segments);
  if (dir !== root && !dir.startsWith(root + path.sep)) throw new Error("Invalid data path");
  return dir;
}
