"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isTyping, playSound } from "@/components/console/sound";
import { buttonClass, squareClass } from "./kit";
import { useBusy } from "./motion";

/**
 * ◀ ▶ and "Aujourd'hui" for the month or the year shown, without touching the URL: each one calls a server action
 * that remembers the period and re-renders the page in place. ← / → (or the d-pad) do the same. Once scrolled out of
 * view, the same controls follow in a bar at the top of the screen, with the period's `title` and `summary`.
 */
export function ViewNav({
  prev,
  next,
  today,
  isToday,
  prevLabel,
  nextLabel,
  todayLabel = "Aujourd'hui",
  title,
  summary,
}: {
  prev: () => Promise<void>;
  next: () => Promise<void>;
  today: () => Promise<void>;
  isToday: boolean;
  prevLabel: string;
  nextLabel: string;
  todayLabel?: string;
  /** Shown in the floating bar: the period ("2026") and a few figures. */
  title?: ReactNode;
  summary?: ReactNode;
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

  // The bar shows up when these controls leave the screen; it is fixed, so it lives on <main> (the page body is
  // animated with transforms, which would pin it to the page instead of the screen).
  const anchor = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    setHost(element.closest("main"));
    const observer = new IntersectionObserver(([e]) => setAway(!e.isIntersecting && e.boundingClientRect.top < 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const controls = (small: boolean) => (
    <div className={`flex items-center gap-2 ${pending ? "mn-pending" : ""}`} aria-busy={pending}>
      <button type="button" onClick={() => go(prev)} className={squareClass()} aria-label={prevLabel} title={prevLabel}>
        ◀
      </button>
      <button type="button" onClick={() => go(next)} className={squareClass()} aria-label={nextLabel} title={nextLabel}>
        ▶
      </button>
      <button type="button" onClick={() => go(today)} disabled={isToday} className={`${buttonClass("dark", "sm")} ${small ? "ml-1" : "ml-2"}`}>
        <span>{todayLabel}</span>
      </button>
    </div>
  );

  return (
    <>
      <div ref={anchor}>{controls(false)}</div>
      {host &&
        title !== undefined &&
        createPortal(
          <div
            inert={!away}
            className={`fixed inset-x-0 top-0 z-40 border-b-[3px] border-[var(--mn-ink)] bg-[color-mix(in_srgb,var(--mn-panel)_92%,transparent)] shadow-[0_6px_0_rgba(0,0,0,0.35)] backdrop-blur transition duration-300 ease-out ${away ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"}`}
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-2.5 sm:px-10">
              <span className="mn-punch mn-title text-3xl sm:text-4xl">{title}</span>
              {summary && <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-1 text-sm md:flex">{summary}</div>}
              <div className="ml-auto">{controls(true)}</div>
            </div>
          </div>,
          host,
        )}
    </>
  );
}

/** One figure of the floating bar's summary: "[Gardé] +241,44 €". */
export function BarFigure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--mn-muted)]">{label}</span>
      <b className="mn-punch text-lg" style={tone ? { color: tone } : undefined}>
        {value}
      </b>
    </span>
  );
}
