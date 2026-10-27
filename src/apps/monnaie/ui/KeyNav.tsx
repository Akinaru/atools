"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isTyping, playSound } from "@/components/console/sound";

/** ← / → (or the d-pad) go to the previous / next page, e.g. month or year. */
export function KeyNav({ prev, next }: { prev: string; next: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      playSound("tab");
      router.push(event.key === "ArrowLeft" ? prev : next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prev, next]);
  return null;
}
