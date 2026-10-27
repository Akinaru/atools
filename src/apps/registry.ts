import type { App } from "./types";
import aarchive from "./aarchive";
import pokemonSaves from "./pokemon-saves";
import monnaie from "./monnaie";
// new-app:import

export const apps: App[] = [
  pokemonSaves,
  aarchive,
  monnaie,
  // new-app:entry
];

export function getApp(slug: string): App | undefined {
  return apps.find((app) => app.slug === slug);
}
