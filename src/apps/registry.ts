import type { App } from "./types";
import pokemonSaves from "./pokemon-saves";
// new-app:import

export const apps: App[] = [
  pokemonSaves,
  // new-app:entry
];

export function getApp(slug: string): App | undefined {
  return apps.find((app) => app.slug === slug);
}
