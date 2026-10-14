import species from "../data/species.json";
import type { Mon } from "../parsers";

const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const ITEMS = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items";

/** In-game item icon (poke-ball, amulet-coin, town-map…). */
export function ItemIcon({ name, size = 28 }: { name: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${ITEMS}/${name}.png`} alt="" className="pixelated inline-block object-contain" style={{ width: size, height: size }} />
  );
}

export function speciesName(dex: number): string {
  return species.fr[dex] || "???";
}

/** Sprite matching the game's era: pixel art up to gen 5 (animated for gen 5), HOME renders after. */
function spriteUrl(mon: Mon, gen: number): string {
  const shiny = mon.shiny ? "shiny/" : "";
  if (gen === 1) return `${SPRITES}/versions/generation-i/yellow/transparent/${mon.dex}.png`;
  if (gen === 2) return `${SPRITES}/versions/generation-ii/crystal/transparent/${shiny}${mon.dex}.png`;
  if (gen === 3) return `${SPRITES}/versions/generation-iii/emerald/${shiny}${mon.dex}.png`;
  if (gen <= 5 && mon.dex <= 649) return `${SPRITES}/versions/generation-v/black-white/animated/${shiny}${mon.dex}.gif`;
  return `${SPRITES}/other/home/${shiny}${mon.dex}.png`;
}

export function Sprite({ mon, gen, size = 64 }: { mon: Mon; gen: number; size?: number }) {
  if (!mon.egg && !mon.dex) return <ItemIcon name="poke-ball" size={size * 0.6} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mon.egg ? `${SPRITES}/egg.png` : spriteUrl(mon, gen)}
      alt={mon.egg ? "Œuf" : speciesName(mon.dex)}
      loading="lazy"
      className={`object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)] ${gen <= 5 || mon.egg ? "pixelated" : ""}`}
      style={{ width: size, height: size }}
    />
  );
}

/** "Nickname" (or species) + "Species · Nv. X" for labels. */
export function monText(mon: Mon): { title: string; subtitle: string } {
  const name = mon.egg ? "Œuf" : speciesName(mon.dex);
  const nickname = !mon.egg && mon.nickname && mon.nickname.toLowerCase() !== name.toLowerCase() ? mon.nickname : null;
  const parts = [nickname ? name : null, mon.level ? `Nv. ${mon.level}` : null, mon.shiny ? "✦ Shiny" : null];
  return { title: nickname ?? name, subtitle: parts.filter(Boolean).join(" · ") };
}
