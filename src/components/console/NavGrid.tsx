"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isTyping, playSound } from "./sound";

export type NavItem = {
  key: string;
  label: string;
  sublabel?: string;
  href?: string;
  /** Square tile content (image, sprite…). */
  tile: ReactNode;
};

type Props = {
  items: NavItem[];
  /** Tailwind classes for the grid columns, e.g. "grid-cols-5". */
  columnsClassName?: string;
  /** Empty decorative slots after the items, like an unfilled console home screen. */
  placeholders?: number;
  /** Show the selected item's name above the grid. */
  showLabel?: boolean;
  /** Listen to the keyboard / gamepad (only one grid per screen should). */
  keyboard?: boolean;
  initialIndex?: number;
  onSelect?: (index: number) => void;
  /** Called when the cursor tries to leave the grid sideways (e.g. to switch PC boxes). */
  onEdge?: (direction: "left" | "right") => void;
  /** "tile": white console tile; "slot": translucent slot letting the background show (PC box). */
  variant?: "tile" | "slot";
};

const VARIANTS = {
  tile: { outer: "rounded-[22px] bg-white p-[5px] shadow-[0_2px_10px_rgba(0,0,0,0.08)]", inner: "rounded-[17px] bg-zinc-100" },
  slot: { outer: "rounded-2xl bg-white/35 p-[3px] backdrop-blur-[2px]", inner: "rounded-[13px]" },
};

/** Grid of console tiles with a cursor driven by arrows / d-pad, A to open. */
export function NavGrid({
  items,
  columnsClassName = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5",
  placeholders = 0,
  showLabel = true,
  keyboard = true,
  initialIndex = 0,
  onSelect,
  onEdge,
  variant = "tile",
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(Math.min(initialIndex, Math.max(items.length - 1, 0)));
  const refs = useRef<(HTMLElement | null)[]>([]);
  const current = items[selected];

  /** Keyboard / gamepad moves play a sound and scroll; mouse hover stays silent and never scrolls. */
  const select = (index: number, fromKeyboard = true) => {
    if (index === selected || index < 0 || index >= items.length) return;
    setSelected(index);
    onSelect?.(index);
    if (!fromKeyboard) return;
    playSound("move");
    refs.current[index]?.scrollIntoView({ block: "nearest" });
  };

  useEffect(() => {
    if (!keyboard) return;
    const columns = () => {
      const top = refs.current[0]?.offsetTop;
      return Math.max(1, refs.current.filter((el) => el?.offsetTop === top).length);
    };
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || !items.length) return;
      const cols = columns();
      const col = selected % cols;
      switch (event.key) {
        case "ArrowLeft":
          if (col === 0) onEdge?.("left");
          else select(selected - 1);
          break;
        case "ArrowRight":
          if (col === cols - 1 || selected === items.length - 1) onEdge?.("right");
          else select(selected + 1);
          break;
        case "ArrowUp":
          select(selected - cols);
          break;
        case "ArrowDown":
          select(Math.min(selected + cols, items.length - 1));
          break;
        case "Enter":
          if ((event.target as HTMLElement)?.closest?.("a, button")) return;
          if (current?.href) {
            playSound("select");
            router.push(current.href);
          }
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div>
      {showLabel && (
        <div className="mb-5 min-h-14">
          <p className="truncate text-2xl font-black leading-tight">{current?.label}</p>
          {current?.sublabel && <p className="truncate text-sm text-zinc-500">{current.sublabel}</p>}
        </div>
      )}
      <div className={`grid w-full gap-4 sm:gap-5 ${columnsClassName}`}>
        {items.map((item, i) => {
          const className = `tile group block aspect-square cursor-pointer transition duration-150 ${VARIANTS[variant].outer} ${i === selected ? "tile-selected scale-[1.04]" : "hover:scale-[1.02]"}`;
          const inner = <div className={`relative h-full w-full overflow-hidden ${VARIANTS[variant].inner}`}>{item.tile}</div>;
          return item.href ? (
            <a
              key={item.key}
              ref={(el) => { refs.current[i] = el; }}
              href={item.href}
              onMouseEnter={() => select(i, false)}
              onClick={(event) => {
                event.preventDefault();
                playSound("select");
                router.push(item.href!);
              }}
              aria-label={item.label}
              className={className}
            >
              {inner}
            </a>
          ) : (
            <div key={item.key} ref={(el) => { refs.current[i] = el; }} onMouseEnter={() => select(i, false)} onClick={() => select(i, false)} className={className}>
              {inner}
            </div>
          );
        })}
        {Array.from({ length: placeholders }, (_, i) => (
          <div key={`placeholder-${i}`} className="aspect-square rounded-[22px] bg-white/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]" />
        ))}
      </div>
    </div>
  );
}
