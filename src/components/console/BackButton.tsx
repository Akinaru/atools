"use client";

import { usePathname, useRouter } from "next/navigation";
import { KeyCap } from "./KeyCap";
import { playSound } from "./sound";

/** Back button of the status bar (same as B / Échap). Hidden on the home and login screens. */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/login") return null;
  return (
    <button
      onClick={() => {
        playSound("back");
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      className="flex h-14 items-center gap-2 rounded-2xl bg-white/80 px-4 font-bold shadow-sm backdrop-blur transition hover:scale-105"
    >
      <KeyCap>B</KeyCap> Retour
    </button>
  );
}
