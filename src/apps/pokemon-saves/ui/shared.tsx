import type { ReactNode } from "react";
import { badgeImages, boxart, getGame, gradient, type Game } from "../games";
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

/** "il y a 3 heures" style date. Reads the current time: callers must `await io()` first (Cache Components). */
export function formatRelative(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const format = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return "à l'instant";
}

/** Card of a save: trainer header in the game's colors, team slots, key stats. */
export function SaveCardArt({ save }: { save: SaveView }) {
  const game = getGame(save.gameId)!;
  const team = save.info.party.slice(0, 6);
  const badgeCount = badgeImages(game).length;
  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="relative flex items-center gap-3 overflow-hidden px-4 py-3 text-white" style={{ background: gradient(game) }}>
        <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full border-[14px] border-white/15" />
        <Cover game={game} className="h-12 w-12 shrink-0 rounded-xl shadow-md ring-2 ring-white/70" />
        <div className="relative min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider opacity-85">{save.label}</p>
          <p className="truncate text-xl font-black leading-tight drop-shadow">{save.info.trainer ?? "Dresseur inconnu"}</p>
        </div>
        {save.slot && (
          <span className="relative shrink-0 rounded-full bg-black/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide" title="Mise à jour automatique par la backup">
            ⟳ {save.slot}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center gap-1 px-3" style={{ background: `radial-gradient(ellipse at center, ${game.colors[0]}1f, transparent 70%)` }}>
        {Array.from({ length: 6 }, (_, i) =>
          team[i] ? (
            <span key={i} className={`flex h-12 w-12 items-center justify-center rounded-full ${team[i].shiny ? "bg-yellow-100" : ""}`}>
              <Sprite mon={team[i]} gen={game.gen} size={46} />
            </span>
          ) : (
            <span key={i} className="h-9 w-9 rounded-full border-2 border-dashed border-zinc-200" />
          ),
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 px-3 pb-2 text-center">
        <CardStat label="Temps" value={formatPlayTime(save.info.hours, save.info.minutes)} />
        <CardStat label="Argent" value={save.info.money === undefined ? "—" : `${save.info.money.toLocaleString("fr-FR")} ₽`} />
        <CardStat label="Badges" value={save.parsed?.badges !== undefined && badgeCount ? `${save.parsed.badges}/${badgeCount}` : "—"} />
      </div>
      <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
        <span>Sauvegardée {formatRelative(save.fileDate)}</span>
        {save.parseError ? <span className="font-bold text-amber-500">⚠ illisible</span> : save.versions.length > 0 && <span>{save.versions.length} version{save.versions.length > 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-1 py-1.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="truncate text-xs font-black">{value}</p>
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
      <dd className="truncate text-base font-extrabold">{value}</dd>
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
