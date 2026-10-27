"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isTyping, playSound } from "./sound";

/**
 * Status bar of the shell. On the home and login screens it sits on top of the page. Inside an app the app is
 * full screen: the bar is hidden and slides over the app from the top when the tab (bottom right edge, barely
 * visible until hovered) or the M key opens it.
 */
export function ShellMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const inApp = pathname !== "/" && pathname !== "/login";
  const [open, setOpen] = useState(false);

  const toggle = () => {
    playSound(open ? "back" : "select");
    setOpen(!open);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!inApp || isTyping(event) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "m" || event.key === "M") toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!inApp) return children;

  return (
    <>
      <div
        inert={!open}
        className={`fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-black/35 to-transparent pb-8 transition duration-300 ease-out ${open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0"}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Cacher le menu (M)" : "Afficher le menu (M)"}
        title={open ? "Cacher le menu (M)" : "Afficher le menu (M)"}
        className={`fixed bottom-8 right-0 z-50 flex items-center gap-2 rounded-l-2xl bg-white/90 px-2 py-4 text-sm font-black uppercase tracking-widest text-[var(--accent)] shadow-md backdrop-blur transition duration-300 ease-out [writing-mode:vertical-rl] hover:translate-x-0 hover:opacity-100 hover:shadow-lg focus-visible:translate-x-0 focus-visible:opacity-100 ${open ? "translate-x-0 opacity-100" : "translate-x-[70%] opacity-35"}`}
      >
        <span aria-hidden className={`inline-block transition-transform duration-300 ${open ? "rotate-180" : ""}`}>
          ▲
        </span>
        {open ? "Fermer" : "Menu"}
      </button>
    </>
  );
}
