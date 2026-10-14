import { notFound } from "next/navigation";
import type { App } from "../types";
import { api } from "./api";
import { GameView } from "./ui/GameView";
import { HomeView } from "./ui/HomeView";
import { SaveDetail } from "./ui/SaveDetail";

function Page({ path }: { path: string[] }) {
  const [section, id] = path;
  if (!section) return <HomeView />;
  if (section === "game" && id) return <GameView gameId={id} />;
  if (section === "save" && id) return <SaveDetail id={id} />;
  notFound();
}

const app: App = {
  slug: "pokemon-saves",
  name: "Saves Pokémon",
  description: "Toutes mes saves Pokémon, sauvegardées et lisibles : dresseur, argent, lieu, équipe, boîtes.",
  icon: "🎮",
  accent: "linear-gradient(90deg, #e3350d, #f8d030, #3b6fd9)",
  cover: "/assets/pokemon-saves/tile.jpg",
  Page,
  api,
};

export default app;
