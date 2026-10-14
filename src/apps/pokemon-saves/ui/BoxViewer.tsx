"use client";

import { useState } from "react";
import { NavGrid } from "@/components/console/NavGrid";
import { playSound } from "@/components/console/sound";
import type { Box } from "../parsers";
import { ItemIcon, monText, Sprite, speciesName } from "./sprites";


const SLOTS = 30;

/** PC box like in the games: 6×5 slots, moving past the left/right edge switches box. */
export function BoxViewer({ boxes, gen, accent, accentDark }: { boxes: Box[]; gen: number; accent: string; accentDark: string }) {
  const [boxIndex, setBoxIndex] = useState(0);
  const [slot, setSlot] = useState(0);
  const box = boxes[boxIndex];
  const mon = box.mons[slot];

  const switchBox = (delta: number) => {
    const next = (boxIndex + delta + boxes.length) % boxes.length;
    if (next === boxIndex) return;
    playSound("tab");
    setBoxIndex(next);
    setSlot(0);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      {/* PC box wallpaper in the game's colors, with soft stripes and a big faded Poké Ball. */}
      <div
        className="relative overflow-hidden rounded-3xl p-4 shadow-md ring-4 ring-white sm:p-5"
        style={{
          background: `repeating-linear-gradient(135deg, rgba(255,255,255,0.07) 0 14px, transparent 14px 28px), linear-gradient(160deg, ${accent}, ${accentDark})`,
        }}
      >
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full border-[28px] border-white/10">
          <div className="absolute inset-x-0 top-1/2 h-7 -translate-y-1/2 bg-white/10" />
        </div>
        <div className="relative mb-4 flex items-center justify-between rounded-full bg-white px-2 py-1.5 shadow-sm">
          <button onClick={() => switchBox(-1)} className="h-9 w-9 rounded-full text-lg font-black text-zinc-500 hover:bg-zinc-100">◀</button>
          <span className="flex items-center gap-2 font-black">
            <ItemIcon name="poke-ball" size={22} />
            {box.name} <span className="text-sm font-semibold text-zinc-400">({box.mons.length}/{SLOTS})</span>
          </span>
          <button onClick={() => switchBox(1)} className="h-9 w-9 rounded-full text-lg font-black text-zinc-500 hover:bg-zinc-100">▶</button>
        </div>
        <NavGrid
          key={boxIndex}
          variant="slot"
          columnsClassName="grid-cols-6"
          showLabel={false}
          onSelect={setSlot}
          onEdge={(direction) => switchBox(direction === "left" ? -1 : 1)}
          items={Array.from({ length: SLOTS }, (_, i) => {
            const m = box.mons[i];
            return {
              key: String(i),
              label: m ? monText(m).title : "Vide",
              tile: m ? (
                <div className={`flex h-full w-full items-center justify-center ${m.shiny ? "bg-yellow-100/80" : "bg-white/70"}`}>
                  <Sprite mon={m} gen={gen} size={72} />
                </div>
              ) : (
                <div className="h-full w-full" />
              ),
            };
          })}
        />
        <p className="mt-4 text-center text-xs font-semibold text-white drop-shadow">
          Boîte {boxIndex + 1} / {boxes.length} · sors de la grille à gauche / droite pour changer de boîte
        </p>
      </div>

      <aside className="flex flex-col items-center rounded-3xl bg-white/85 p-6 text-center shadow-sm">
        {mon ? (
          <>
            <div className="flex h-40 w-40 items-center justify-center rounded-full" style={{ background: `radial-gradient(circle, ${mon.shiny ? "#fde68a" : `${accent}40`}, transparent 70%)` }}>
              <Sprite mon={mon} gen={gen} size={128} />
            </div>
            <h3 className="mt-3 text-xl font-black">
              {monText(mon).title}
              {mon.shiny && <span className="ml-1 text-yellow-500">✦</span>}
            </h3>
            <p className="text-sm text-zinc-500">
              {mon.egg ? "Œuf" : [`N° ${String(mon.dex).padStart(4, "0")}`, monText(mon).title !== speciesName(mon.dex) && speciesName(mon.dex)].filter(Boolean).join(" · ")}
            </p>
            <dl className="mt-5 grid w-full grid-cols-2 gap-3 text-left text-sm">
              <div className="rounded-2xl bg-zinc-50 p-3"><dt className="text-[11px] font-bold uppercase text-zinc-400">Niveau</dt><dd className="font-bold">{mon.level ?? "—"}</dd></div>
              <div className="rounded-2xl bg-zinc-50 p-3"><dt className="text-[11px] font-bold uppercase text-zinc-400">Dresseur</dt><dd className="truncate font-bold">{mon.otName || "—"}</dd></div>
            </dl>
          </>
        ) : (
          <p className="my-auto text-zinc-400">Emplacement vide</p>
        )}
      </aside>
    </div>
  );
}
