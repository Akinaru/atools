import type { ReactNode } from "react";
import { boxart, getGame, gradient, type Game } from "../games";
import type { SaveView } from "../server/store";
import { Sprite } from "./sprites";

export const BASE = "/apps/pokemon-saves";

export const formatMoney = (money?: number) => (money === undefined ? "—" : `${money.toLocaleString("fr-FR")} ₽`);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

export function formatPlayTime(hours?: number, minutes?: number) {
  if (hours === undefined) return "—";
  return minutes === undefined ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, "0")}`;
}

/** Box art of a game; `className` sizes it. */
export function Cover({ game, className = "" }: { game: Game; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={boxart(game)} alt={`Pokémon ${game.name}`} loading="lazy" className={`object-cover ${className}`} />
  );
}

/**
 * Square tile art: the whole cover on the game's colors. Black and white until the game has a save;
 * hovering or selecting the tile brings the colors back.
 */
export function GameTileArt({ game, count }: { game: Game; count: number }) {
  return (
    <div
      className={`h-full w-full transition-[filter] duration-300 ${count ? "" : "grayscale group-hover:grayscale-0 group-[.tile-selected]:grayscale-0"}`}
      style={{ background: gradient(game) }}
    >
      <Cover game={game} className="h-full w-full !object-contain p-2 drop-shadow-lg" />
      {count > 0 && (
        <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#e60012] px-2 text-xs font-black text-white shadow-md ring-2 ring-white">
          {count}
        </span>
      )}
    </div>
  );
}

/** Square tile for a save: cover background, trainer name and team. */
export function SaveTileArt({ save }: { save: SaveView }) {
  const game = getGame(save.gameId)!;
  const team = save.info.party.slice(0, 6);
  return (
    <div className="flex h-full w-full flex-col" style={{ background: gradient(game) }}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
      <div className="relative flex flex-1 flex-wrap content-center items-center justify-center gap-0.5 p-2">
        {team.map((mon, i) => (
          <Sprite key={i} mon={mon} gen={game.gen} size={team.length > 3 ? 44 : 60} />
        ))}
        {!team.length && <Cover game={game} className="h-24 rounded-lg shadow-lg" />}
      </div>
      <div className="relative px-3 pb-2.5 text-white">
        <p className="truncate text-sm font-black drop-shadow">{save.info.trainer ?? save.label}</p>
        <p className="truncate text-[11px] opacity-85">Pokémon {game.name}</p>
      </div>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white/85 p-6 shadow-[0_2px_14px_rgba(0,0,0,0.06)] backdrop-blur ${className}`}>{children}</section>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd className="truncate text-base font-semibold">{value}</dd>
    </div>
  );
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}
