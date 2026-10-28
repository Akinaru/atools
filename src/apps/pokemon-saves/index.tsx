import { notFound } from "next/navigation";
import type { App } from "../types";
import { api } from "./api";
import { GAMES } from "./games";
import { getSaveMeta } from "./server/store";
import { GameView } from "./ui/GameView";
import { HomeView } from "./ui/HomeView";
import { PairView } from "./ui/PairView";
import { SaveDetail } from "./ui/SaveDetail";

function Page({ path }: { path: string[] }) {
  const [section, id] = path;
  if (!section) return <HomeView />;
  if (section === "pair" && !id) return <PairView />;
  if (section === "game" && id) return <GameView gameId={id} />;
  if (section === "save" && id) return <SaveDetail id={id} />;
  notFound();
}

/** "Émeraude · Saves Pokémon", "Appairer un appareil · Saves Pokémon"… */
async function title(path: string[]): Promise<string> {
  const [section, id] = path;
  const name = (part: string) => `${part} · Saves Pokémon`;
  if (section === "pair") return name("Appairer un appareil");
  if (section === "game") return name(GAMES.find((g) => g.id === id)?.name ?? "Jeu");
  if (section === "save" && id) {
    const save = await getSaveMeta(id);
    const game = save && GAMES.find((g) => g.id === save.gameId);
    return name(save ? [save.label, game?.name].filter(Boolean).join(" · ") || "Save" : "Save");
  }
  return "Saves Pokémon";
}

const app: App = {
  slug: "pokemon-saves",
  name: "Saves Pokémon",
  description: "Toutes mes saves Pokémon, sauvegardées et lisibles : dresseur, argent, lieu, équipe, boîtes.",
  icon: "🎮",
  accent: "linear-gradient(90deg, #e3350d, #f8d030, #3b6fd9)",
  cover: "/assets/pokemon-saves/tile.jpg",
  Page,
  title,
  api,
};

export default app;
