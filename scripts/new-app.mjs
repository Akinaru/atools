#!/usr/bin/env node
// Usage: npm run new-app -- <slug> ["Display name"]
// Creates src/apps/<slug>/ (page + API) and registers it in src/apps/registry.ts.
import fs from "node:fs";
import path from "node:path";

const [slug, name] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new-app -- <slug-en-kebab-case> ["Nom affiché"]');
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "src/apps", slug);
if (fs.existsSync(dir)) {
  console.error(`src/apps/${slug} existe déjà.`);
  process.exit(1);
}

const ident = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const title = name ?? slug.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "index.tsx"),
  `import type { App } from "../types";
import { api } from "./api";

function Page({ path }: { path: string[] }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-6">
      <h1 className="text-3xl font-black">${title}</h1>
      <p className="mt-2 text-zinc-500">Sous-page : /{path.join("/")}</p>
    </main>
  );
}

const app: App = {
  slug: "${slug}",
  name: "${title}",
  description: "Décris ton app ici.",
  icon: "🧰",
  accent: "linear-gradient(135deg, #a78bfa, #6d28d9)",
  Page,
  api,
};

export default app;
`,
);
fs.writeFileSync(
  path.join(dir, "api.ts"),
  `import { json, type ApiRoute } from "@/lib/api";

// API of the app, served at /api/${slug}/... and protected by the API key.
export const api: ApiRoute[] = [
  {
    method: "GET",
    path: "hello",
    description: "Exemple de route.",
    handler: () => json({ hello: "${title}" }),
  },
];
`,
);

const registryPath = path.join(root, "src/apps/registry.ts");
const registry = fs
  .readFileSync(registryPath, "utf8")
  .replace("// new-app:import", `import ${ident} from "./${slug}";\n// new-app:import`)
  .replace("// new-app:entry", `${ident},\n  // new-app:entry`);
fs.writeFileSync(registryPath, registry);

console.log(`✔ App créée : src/apps/${slug}/ → /apps/${slug} (UI) et /api/${slug}/hello (API)`);
