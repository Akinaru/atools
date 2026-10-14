import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BackButton } from "./BackButton";
import { Controls } from "./Controls";
import { LogoutButton } from "./LogoutButton";
import { Battery, Clock } from "./StatusBar";

/** Switch-like frame around every page: status bar on top, controls help at the bottom. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  return (
    <div className="console-bg flex min-h-screen flex-col">
      <header className="flex items-start justify-between px-6 pt-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            title="Accueil"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-2xl font-black text-[var(--accent)] shadow-sm backdrop-blur transition hover:scale-105"
          >
            a
          </Link>
          <Clock />
          {/* Reads the URL, so it renders at request time. */}
          <Suspense fallback={null}>
            <BackButton />
          </Suspense>
        </div>
        <div className="flex items-center gap-3">
          {/* Reads the URL, so it renders at request time. */}
          <Suspense fallback={null}>
            <LogoutButton />
          </Suspense>
          <Battery />
        </div>
      </header>
      <div className="flex flex-1 flex-col pb-10">{children}</div>
      <Controls />
    </div>
  );
}
