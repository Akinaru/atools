import { notFound } from "next/navigation";
import { NavGrid } from "@/components/console/NavGrid";
import { getGame, gradient } from "../games";
import { getSaveView, listSaves } from "../server/store";
import { BASE, Cover, formatDate, formatPlayTime, SaveTileArt } from "./shared";
import { UploadDialog } from "./UploadDialog";

export async function GameView({ gameId }: { gameId: string }) {
  const game = getGame(gameId);
  if (!game) notFound();
  const saves = await Promise.all((await listSaves()).filter((s) => s.gameId === game.id).map(getSaveView));

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-6 md:grid-cols-[300px_1fr]">
      <aside className="pop-in">
        <div className="relative">
          <div className="absolute -inset-4 rounded-[2rem] opacity-50 blur-2xl" style={{ background: gradient(game) }} />
          <Cover game={game} className="relative w-full rounded-3xl shadow-2xl ring-4 ring-white" />
        </div>
        <div className="mt-6 rounded-3xl bg-white/85 p-5 shadow-sm backdrop-blur">
          <h1 className="text-2xl font-black leading-tight">Pokémon {game.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <Chip>Gen {game.gen}</Chip>
            <Chip>{game.platform}</Chip>
            <Chip>{game.year}</Chip>
            {game.format && <Chip accent>Lecture auto</Chip>}
          </div>
          {!game.format && <p className="mt-3 text-xs text-zinc-500">La save est stockée ; les infos se complètent à la main.</p>}
        </div>
      </aside>

      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-black">
            Saves <span className="text-zinc-400">({saves.length})</span>
          </h2>
          <UploadDialog defaultGameId={game.id} />
        </div>
        {saves.length ? (
          <NavGrid
            columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            items={saves.map((save) => ({
              key: save.id,
              href: `${BASE}/save/${save.id}`,
              label: save.label,
              sublabel: `${save.info.trainer ?? "?"} · ${formatPlayTime(save.info.hours, save.info.minutes)} · ${formatDate(save.fileDate)}`,
              tile: <SaveTileArt save={save} />,
            }))}
          />
        ) : (
          <p className="rounded-3xl bg-white/60 py-16 text-center text-zinc-400">Aucune save pour ce jeu. Appuie sur X pour en ajouter une.</p>
        )}
      </section>
    </main>
  );
}

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return <span className={`rounded-full px-3 py-1 ${accent ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-600"}`}>{children}</span>;
}
