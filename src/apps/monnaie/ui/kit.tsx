import Link from "next/link";
import { Barlow, Lilita_One } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { LinkPending, RouteTransition, TopBar } from "./motion";
import "./monnaie.css";

const punch = Lilita_One({ variable: "--font-punch", weight: "400", subsets: ["latin", "latin-ext"] });
const barlow = Barlow({ variable: "--font-barlow", weight: ["500", "600", "700"], subsets: ["latin", "latin-ext"] });

export const BASE = "/apps/monnaie";

const NAV = [
  { key: "mois", label: "Ce mois", href: BASE },
  { key: "annee", label: "L'année", href: `${BASE}/annee` },
  { key: "lignes", label: "Lignes", href: `${BASE}/lignes` },
  { key: "objectifs", label: "Objectifs", href: `${BASE}/objectifs` },
  { key: "reglages", label: "Réglages", href: `${BASE}/reglages` },
] as const;

export type Section = (typeof NAV)[number]["key"];

const tilt = (deg: number) => ({ "--mn-tilt": `${deg}deg` }) as CSSProperties;

/** Four white dashes, the aim of the reference site. */
export function Crosshair({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <g fill="currentColor">
        <rect x="18" y="0" width="4" height="10" transform="rotate(-3 20 5)" />
        <rect x="18" y="30" width="4" height="10" transform="rotate(4 20 35)" />
        <rect x="0" y="18" width="10" height="4" transform="rotate(3 5 20)" />
        <rect x="30" y="18" width="10" height="4" transform="rotate(-2 35 20)" />
      </g>
    </svg>
  );
}

/** "[Ce mois]" style label. */
export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-sm font-semibold tracking-wide text-[var(--mn-muted)] ${className}`}>[{children}]</span>;
}

/** Headline on a boiling accent slab. */
export function Slab({ children, tilt: deg = -2, className = "" }: { children: ReactNode; tilt?: number; className?: string }) {
  return (
    <span className={`mn-shape mn-slab mn-boil mn-punch mn-drop inline-block px-4 pb-1 pt-2 ${className}`} style={tilt(deg)}>
      {children}
    </span>
  );
}

/** White paper sheet with a hard shadow. It stays still: only accents (buttons, slabs) boil. */
export function Paper({ children, tilt: deg = 0, className = "" }: { children: ReactNode; tilt?: number; className?: string }) {
  return (
    <div className="mn-drop" style={tilt(deg)}>
      <div className={`mn-shape mn-paper p-6 sm:p-8 ${className}`}>{children}</div>
    </div>
  );
}

/** Calmer dark panel, cut like the paper but still. */
export function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`mn-shape p-6 sm:p-8 ${className}`} style={{ "--mn-shape": "var(--mn-panel)" } as CSSProperties}>
      {children}
    </section>
  );
}

export function PanelTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-3">
      <h2 className="mn-punch text-2xl sm:text-3xl">{children}</h2>
      {aside}
    </div>
  );
}

/** ◆ bullet line, as on the reference card. */
export function Diamond({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <li className={`flex items-center gap-3 ${className}`}>
      <span className="h-2.5 w-2.5 shrink-0 rotate-45 bg-current" aria-hidden />
      {children}
    </li>
  );
}

/** Rubber stamp slammed on a paper card. */
export function Stamp({ children, tone = "red", tilt: deg = -9, className = "" }: { children: ReactNode; tone?: "red" | "ink"; tilt?: number; className?: string }) {
  return (
    <span
      className={`mn-stamp mn-slam pointer-events-none absolute ${tone === "red" ? "text-[var(--mn-red)]" : "text-[var(--mn-ink)]"} ${className}`}
      style={tilt(deg)}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Classes of the big layered button; its label must be wrapped in an element (it tilts on hover). */
export const buttonClass = (variant: "accent" | "dark" = "accent", size: "md" | "sm" = "md") =>
  `mn-btn mn-punch ${size === "sm" ? "mn-btn--sm text-base" : "text-xl"} ${variant === "dark" ? "mn-btn--dark" : ""}`;

/** Square icon button (arrows, ✕). */
export const squareClass = (light = false) => `mn-square ${light ? "mn-square--light" : ""}`;

/** Frame of every screen: aim, section number, outlined title, nav words and the corner labels. */
export function Screen({
  section,
  title,
  subtitle,
  actions,
  hints = [],
  children,
}: {
  section: Section;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Keyboard hints shown in the bottom corner. */
  hints?: string[];
  children: ReactNode;
}) {
  const index = NAV.findIndex((n) => n.key === section);
  return (
    <main className={`${punch.variable} ${barlow.variable} mn relative min-h-screen flex-1 overflow-hidden px-5 pb-10 pt-6 sm:px-10`}>
      <TopBar />
      <header className="flex items-start justify-between gap-6">
        <Link href={BASE} className="group flex items-center gap-4">
          <Crosshair className="h-11 w-11 text-white transition-transform duration-300 group-hover:rotate-45" />
          <span className="leading-tight">
            <Tag>{String(index + 1).padStart(2, "0")}</Tag>
            <span className="mn-punch block text-xl text-white">Monnaie</span>
          </span>
        </Link>
        <nav className="hidden flex-wrap items-center justify-end gap-x-7 gap-y-1 md:flex" aria-label="Sections">
          {NAV.map((item, i) =>
            item.key === section ? (
              <Slab key={item.key} tilt={i % 2 ? 2.5 : -2.5} className="text-3xl">
                {item.label}
              </Slab>
            ) : (
              <Link key={item.key} href={item.href} className="mn-punch mn-ghost relative inline-block pt-2 text-3xl">
                {item.label}
                <LinkPending />
              </Link>
            ),
          )}
        </nav>
      </header>
      <nav className="mt-5 flex gap-3 overflow-x-auto pb-2 md:hidden" aria-label="Sections">
        {NAV.map((item) =>
          item.key === section ? (
            <Slab key={item.key} className="shrink-0 text-xl">
              {item.label}
            </Slab>
          ) : (
            <Link key={item.key} href={item.href} className="mn-punch mn-ghost relative shrink-0 pt-2 text-xl">
              {item.label}
              <LinkPending />
            </Link>
          ),
        )}
      </nav>

      <RouteTransition>
        <div className="mt-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="mn-punch mn-title mn-drop text-6xl sm:text-8xl" style={tilt(-1.5)}>
              {title}
            </h1>
            {subtitle && <div className="mt-4 text-base text-[var(--mn-muted)]">{subtitle}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
        </div>
        <div className="mt-12">{children}</div>
      </RouteTransition>

      <footer className="mt-14 flex flex-wrap justify-between gap-3">
        <Tag>Monnaie, {NAV[index].label.toLowerCase()}</Tag>
        {hints.length > 0 && <Tag>{hints.join(" · ")}</Tag>}
      </footer>
    </main>
  );
}
