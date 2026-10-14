"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isTyping, playSound } from "./sound";

/** Tabs switched with L / R (Q / E on keyboard, shoulder buttons on a gamepad). */
export function ConsoleTabs({ tabs, initial = 0 }: { tabs: { label: string; content: ReactNode }[]; initial?: number }) {
  const [active, setActive] = useState(initial);

  const go = (index: number) => {
    if (index < 0 || index >= tabs.length || index === active) return;
    playSound("tab");
    setActive(index);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.key === "q" || event.key === "Q") go(active - 1);
      if (event.key === "e" || event.key === "E") go(active + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      <nav className="mb-8 flex items-center justify-center gap-3">
        <button onClick={() => go(active - 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-lg font-black text-zinc-500 shadow-sm hover:text-zinc-800" aria-label="Onglet précédent">
          ‹
        </button>
        <div className="flex gap-1 rounded-full bg-white/70 p-1 shadow-sm backdrop-blur">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              onClick={() => go(i)}
              className={`rounded-full px-5 py-2 text-sm font-bold transition ${i === active ? "bg-[var(--accent)] text-white shadow" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button onClick={() => go(active + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-lg font-black text-zinc-500 shadow-sm hover:text-zinc-800" aria-label="Onglet suivant">
          ›
        </button>
      </nav>
      {/* Only the active tab is mounted, so only its grid listens to the keyboard. */}
      <div key={active}>{tabs[active].content}</div>
    </div>
  );
}
