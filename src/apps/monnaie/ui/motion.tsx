"use client";

import { usePathname } from "next/navigation";
import { useLinkStatus } from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { formatMoney, formatSigned } from "../money";

// Motion helpers of the app: what makes it feel instant (pending feedback, optimistic rows live in EntryList)
// and alive (page transitions, numbers that roll to their new value). All of it stops with prefers-reduced-motion.

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Turns the top progress bar on while something is pending (several sources can overlap). */
let busyCount = 0;
function setBusy(on: boolean) {
  busyCount = Math.max(0, busyCount + (on ? 1 : -1));
  document.documentElement.classList.toggle("mn-busy", busyCount > 0);
}

export function useBusy(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    setBusy(true);
    return () => setBusy(false);
  }, [pending]);
}

/** Put inside a <Link>: lights the top bar and makes the link wobble while its page loads. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  useBusy(pending);
  return <span aria-hidden className={`mn-link-pending ${pending ? "is-pending" : ""}`} />;
}

/** Thin accent bar at the top of the app, visible while a page or an action is on its way. */
export function TopBar() {
  return <div aria-hidden className="mn-topbar" />;
}

/** Content of a page: slides in when the URL changes (month, section), instead of being swapped at once. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="mn-route">
      {children}
    </div>
  );
}

/** Submit button of a one-click action form: wobbles while the server works, and lights the top bar. */
export function PendingButton({ children, className = "", label, title }: { children: ReactNode; className?: string; label?: string; title?: string }) {
  const { pending } = useFormStatus();
  useBusy(pending);
  return (
    <button disabled={pending} aria-label={label} title={title} className={`${className} ${pending ? "mn-pending" : ""}`}>
      {children}
    </button>
  );
}

/** One-click server action (delete, add…) with its pending feedback. */
export function ActionButton({ action, children, className, label, title }: { action: () => Promise<void>; children: ReactNode; className?: string; label?: string; title?: string }) {
  return (
    <form action={action}>
      <PendingButton className={className} label={label} title={title}>
        {children}
      </PendingButton>
    </form>
  );
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Amount that rolls from its previous value to the new one when it changes (another month, an edit).
 * While it rolls, an invisible copy of the widest of the two amounts (digits as "0", the widest figure) holds the
 * room, so the text around never reflows. The final text is always the exact amount, to the cent.
 */
export function AnimatedMoney({ value, signed = false, duration = 700 }: { value: number; signed?: boolean; duration?: number }) {
  const format = signed ? formatSigned : formatMoney;
  const [shown, setShown] = useState(value);
  const [range, setRange] = useState<[number, number] | null>(null);
  // The server already printed the exact amount: only changes roll.
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    let frame = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = reducedMotion() ? 1 : Math.min(1, (now - t0) / duration);
      setShown(t < 1 ? Math.round(start + (value - start) * easeOut(t)) : value);
      setRange(t < 1 ? [start, value] : null);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  const holder = range ? [format(range[0]), format(range[1])].reduce((a, b) => (b.length > a.length ? b : a)).replace(/\d/g, "0") : format(shown);
  return (
    <span className="inline-grid whitespace-nowrap tabular-nums">
      <span aria-hidden className="invisible [grid-area:1/1]">
        {holder}
      </span>
      <span className="[grid-area:1/1]">{format(shown)}</span>
    </span>
  );
}
