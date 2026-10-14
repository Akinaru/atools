"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex h-14 min-w-36 flex-col items-center justify-center rounded-2xl bg-white/80 px-5 shadow-sm backdrop-blur">
      <span className="text-xl font-bold tabular-nums leading-none">
        {now ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
      </span>
      <span className="mt-1 text-[11px] text-zinc-500">{now ? now.toLocaleDateString("fr-FR") : " "}</span>
    </div>
  );
}

type BatteryManager = { level: number; charging: boolean; addEventListener: (type: string, fn: () => void) => void };

export function Battery() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    nav.getBattery?.().then((manager) => {
      const update = () => setBattery({ level: manager.level, charging: manager.charging });
      update();
      manager.addEventListener("levelchange", update);
      manager.addEventListener("chargingchange", update);
    });
  }, []);
  if (!battery) return null;
  const percent = Math.round(battery.level * 100);
  return (
    <div className="flex h-14 min-w-28 flex-col items-center justify-center rounded-2xl bg-white/80 px-5 shadow-sm backdrop-blur">
      <span className="relative h-4 w-9 rounded-[4px] border-2 border-zinc-400 p-[2px] after:absolute after:-right-[5px] after:top-1 after:h-1.5 after:w-[3px] after:rounded-r after:bg-zinc-400">
        <span className={`block h-full rounded-[2px] ${percent > 20 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="mt-1 text-[11px] font-extrabold text-zinc-600">
        {battery.charging ? "⚡ " : ""}
        {percent}%
      </span>
    </div>
  );
}
