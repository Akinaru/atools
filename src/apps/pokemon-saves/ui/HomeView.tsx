import Link from "next/link";
import { ConsoleTabs } from "@/components/console/ConsoleTabs";
import { NavGrid, type NavItem } from "@/components/console/NavGrid";
import { GAMES, type Game } from "../games";
import { getSaveView, listSaves, type SaveView } from "../server/store";
import { BASE, formatPlayTime, GameTileArt, PageTitle } from "./shared";
import { UploadDialog } from "./UploadDialog";

const GRID = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6";

export async function HomeView() {
  // listSaves is sorted newest first, so the first save of each game is its latest.
  const saves = await Promise.all((await listSaves()).map(getSaveView));
  const savesByGame = new Map<string, SaveView[]>();
  for (const save of saves) savesByGame.set(save.gameId, [...(savesByGame.get(save.gameId) ?? []), save]);
  const owned = GAMES.filter((game) => savesByGame.has(game.id));

  const gameItem = (game: Game): NavItem => {
    const gameSaves = savesByGame.get(game.id) ?? [];
    const latest = gameSaves[0];
    const details = latest
      ? [
          `${gameSaves.length} save${gameSaves.length > 1 ? "s" : ""}`,
          latest.info.trainer,
          latest.info.hours !== undefined ? formatPlayTime(latest.info.hours, latest.info.minutes) : null,
          latest.info.party.length ? `${latest.info.party.length} Pokémon dans l'équipe` : null,
        ]
      : [game.platform, String(game.year), "aucune save", game.format ? "lecture auto" : null];
    return {
      key: game.id,
      href: `${BASE}/game/${game.id}`,
      label: `Pokémon ${game.name}`,
      sublabel: details.filter(Boolean).join(" · "),
      tile: <GameTileArt game={game} count={gameSaves.length} />,
    };
  };

  const tabs = [
    {
      label: "Tous les jeux",
      // The cursor starts on the first game with a save.
      content: <NavGrid columnsClassName={GRID} items={GAMES.map(gameItem)} initialIndex={Math.max(0, GAMES.findIndex((g) => savesByGame.has(g.id)))} />,
    },
    {
      label: "Mes jeux",
      content: owned.length ? (
        <NavGrid columnsClassName={GRID} items={owned.map(gameItem)} />
      ) : (
        <p className="py-16 text-center text-zinc-400">Aucune save pour l&apos;instant. Appuie sur X pour en ajouter une.</p>
      ),
    },
    ...[...new Set(GAMES.map((g) => g.gen))].map((gen) => ({
      label: `Gen ${gen}`,
      content: <NavGrid columnsClassName={GRID} items={GAMES.filter((g) => g.gen === gen).map(gameItem)} />,
    })),
  ];

  const pokemonCount = saves.reduce((n, s) => n + s.info.party.length + (s.parsed?.boxes.reduce((m, b) => m + b.mons.length, 0) ?? 0), 0);
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-6">
      <PageTitle
        title="Saves Pokémon"
        subtitle={`${saves.length} save${saves.length > 1 ? "s" : ""} · ${owned.length} jeu${owned.length > 1 ? "x" : ""} · ${pokemonCount} Pokémon`}
      >
        <Link href={`${BASE}/pair`} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-700 shadow-sm transition hover:scale-105">
          Appareils
        </Link>
        <UploadDialog />
      </PageTitle>
      <ConsoleTabs tabs={tabs} />
    </main>
  );
}
