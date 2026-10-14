"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isTyping, playSound } from "./sound";

// Standard gamepad mapping -> keyboard keys, so every screen only handles the keyboard.
const BUTTON_KEYS: Record<number, string> = {
  0: "Enter", // A (bottom face button)
  1: "Escape", // B
  2: "x", // X
  4: "q", // L
  5: "e", // R
  12: "ArrowUp",
  13: "ArrowDown",
  14: "ArrowLeft",
  15: "ArrowRight",
};
const REPEAT_DELAY = 380;
const REPEAT_RATE = 110;

/** Global console controls: gamepad support and "B / Échap" to go back. */
export function Controls() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || window.location.pathname === "/") return;
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        playSound("back");
        if (window.history.length > 1) router.back();
        else router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    const held = new Map<string, number>();
    let frame = 0;
    const press = (key: string) =>
      (document.activeElement ?? window).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

    const poll = () => {
      const now = performance.now();
      const down = new Set<string>();
      for (const pad of navigator.getGamepads?.() ?? []) {
        if (!pad) continue;
        pad.buttons.forEach((button, i) => button.pressed && BUTTON_KEYS[i] && down.add(BUTTON_KEYS[i]));
        const [x = 0, y = 0] = pad.axes;
        if (x < -0.5) down.add("ArrowLeft");
        if (x > 0.5) down.add("ArrowRight");
        if (y < -0.5) down.add("ArrowUp");
        if (y > 0.5) down.add("ArrowDown");
      }
      for (const key of down) {
        const since = held.get(key);
        if (since === undefined) {
          press(key);
          held.set(key, now);
        } else if (key.startsWith("Arrow") && now - since > REPEAT_DELAY) {
          press(key);
          held.set(key, now - REPEAT_DELAY + REPEAT_RATE);
        }
      }
      for (const key of held.keys()) if (!down.has(key)) held.delete(key);
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
