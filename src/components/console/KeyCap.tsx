import type { ReactNode } from "react";

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-zinc-700 px-1.5 text-[11px] font-bold text-white">
      {children}
    </span>
  );
}
