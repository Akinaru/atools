"use client";

import { useEffect, useTransition } from "react";
import { isTyping, playSound } from "@/components/console/sound";
import { buttonClass, squareClass } from "./kit";
import { useBusy } from "./motion";

/**
 * ◀ ▶ and "Aujourd'hui" for the month or the year shown, without touching the URL: each one calls a server action
 * that remembers the period and re-renders the page in place. ← / → (or the d-pad) do the same.
 */
export function ViewNav({
  prev,
  next,
  today,
  isToday,
  prevLabel,
  nextLabel,
}: {
  prev: () => Promise<void>;
  next: () => Promise<void>;
  today: () => Promise<void>;
  isToday: boolean;
  prevLabel: string;
  nextLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  useBusy(pending);
  const go = (action: () => Promise<void>) => {
    playSound("tab");
    startTransition(action);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      go(event.key === "ArrowLeft" ? prev : next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`flex items-center gap-2 ${pending ? "mn-pending" : ""}`} aria-busy={pending}>
      <button type="button" onClick={() => go(prev)} className={squareClass()} aria-label={prevLabel} title={prevLabel}>
        ◀
      </button>
      <button type="button" onClick={() => go(next)} className={squareClass()} aria-label={nextLabel} title={nextLabel}>
        ▶
      </button>
      <button type="button" onClick={() => go(today)} disabled={isToday} className={`${buttonClass("dark", "sm")} ml-2`}>
        <span>Aujourd&apos;hui</span>
      </button>
    </div>
  );
}
