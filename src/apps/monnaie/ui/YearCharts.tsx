"use client";

import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import type { CategoryYear, DaySpending, LineDetail } from "../insights";
import { formatMoney, formatSigned, monthName, monthShortName, type AccountLevels, type Cents } from "../money";
import { openMonth } from "../server/actions";
import { useEditEntry } from "./EntryEditor";
import { useBusy } from "./motion";

// Interactive charts of the year page: hover to read, click to open a month or a category.

/** Totals of one month, as the year page needs them. */
export type YearMonth = { month: string; income: Cents; charges: Cents; spent: Cents; saved: Cents; kept: Cents; savingsBalance: Cents; hasData: boolean };

const SERIES = [
  { key: "income", label: "Encaissé", color: "#e8e8ee", kind: "bar" },
  { key: "charges", label: "Charges", color: "var(--mn-muted)", kind: "bar" },
  { key: "spent", label: "Plaisir", color: "var(--mn-accent)", kind: "bar" },
  { key: "saved", label: "Livret", color: "var(--mn-yellow)", kind: "bar" },
  { key: "kept", label: "Gardé", color: "#5ee08a", kind: "line" },
  { key: "savingsBalance", label: "Solde livret", color: "var(--mn-yellow)", kind: "line" },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

const short = (month: string) => monthShortName(month).replace(".", "");
/** "2026-10-27" as a local date (new Date("2026-10-27") would be UTC midnight). */
const localDate = (date: string) => new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8)));

const dayMonth = (date: string) => localDate(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/**
 * Hover card listing lines with their dates: the detail behind a bar or a day. Without labels (one label's
 * visits), the dates flow in three columns so that a frequent place still fits.
 */
function LinesCard({
  title,
  total,
  lines,
  max = 8,
  showLabel = true,
  showDate = true,
  className = "w-64",
  style,
  onClose,
  interactive = true,
}: {
  title: string;
  total: Cents;
  lines: LineDetail[];
  max?: number;
  showLabel?: boolean;
  showDate?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Pinned card: a ✕ to put it away. */
  onClose?: () => void;
  /** False for a card that follows the pointer and can't be reached: clicks go through it. */
  interactive?: boolean;
}) {
  // Each line opens in the edit dialog when the page offers it.
  const editor = useEditEntry();
  const edit = interactive ? editor : null;
  return (
    <div className={`${edit ? "" : "pointer-events-none"} absolute z-30 border-[3px] border-[var(--mn-ink)] bg-white p-3 text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)] ${className}`} style={style}>
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-zinc-200 pb-1.5">
        <span className="mn-punch truncate text-base capitalize">{title}</span>
        <span className="mn-punch shrink-0 text-base text-[var(--mn-accent)]">{formatMoney(total)}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Fermer" className="shrink-0 text-sm font-black hover:text-[var(--mn-accent)]">
            ✕
          </button>
        )}
      </div>
      {lines.length ? (
        <ul className={`mt-1.5 grid gap-x-4 gap-y-1 text-[13px] ${showLabel ? "" : "grid-cols-3"}`}>
          {lines.slice(0, max).map((l) => (
            <li
              key={l.id}
              className={`flex items-baseline gap-2 ${edit ? "-mx-1 cursor-pointer px-1 hover:bg-[var(--mn-accent)]" : ""}`}
              onClick={edit ? () => edit(l.id) : undefined}
              title={edit ? "Modifier" : undefined}
            >
              {showDate && <span className="w-12 shrink-0 font-bold text-zinc-500">{dayMonth(l.date)}</span>}
              {showLabel && (
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {l.emoji && <span className="mr-1">{l.emoji}</span>}
                  {l.label}
                </span>
              )}
              <span className={`shrink-0 font-bold ${showLabel ? "" : "ml-auto"}`}>{formatMoney(l.amount)}</span>
            </li>
          ))}
          {lines.length > max && <li className="col-span-full pt-0.5 text-xs font-semibold text-zinc-500">+ {lines.length - max} autre{lines.length - max > 1 ? "s" : ""}</li>}
        </ul>
      ) : (
        <p className="mt-1.5 text-[13px] font-semibold text-zinc-500">rien cramé 🙌</p>
      )}
    </div>
  );
}

/**
 * A set of ids kept in this browser's localStorage under `key` (the chart filters): the first render uses
 * `initial` (same as the server), the saved choice comes right after; unavailable storage just forgets.
 */
function useStoredSet<T extends string>(key: string, initial: T[]) {
  const [set, setSet] = useState<Set<T>>(() => new Set(initial));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      // Read once, after hydration: the server can't know what this browser saved.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSet(new Set(JSON.parse(saved) as T[]));
    } catch {}
    setLoaded(true);
  }, [key]);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch {}
  }, [key, set, loaded]);
  return [set, setSet] as const;
}

/** Toggle chip of a series, in the app's style. */
function Chip({ on, color, label, onClick, dashed = false }: { on: boolean; color: string; label: string; onClick: () => void; dashed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-2 border-2 px-3 pb-1 pt-1.5 text-sm font-bold transition ${on ? "-rotate-1 border-[var(--mn-ink)] bg-white text-[var(--mn-ink)] shadow-[3px_3px_0_var(--mn-ink)]" : "border-white/20 text-[var(--mn-muted)] hover:border-white/50 hover:text-white"}`}
    >
      <span
        aria-hidden
        className={dashed ? "h-0 w-4 border-t-[3px] border-dashed" : "h-3 w-3 border-2 border-[var(--mn-ink)]"}
        style={dashed ? { borderColor: color } : { background: color }}
      />
      {label}
    </button>
  );
}

/** 12 months: grouped bars and lines to pick, a card with every value on hover, a click opens the month. */
export function YearFlowChart({ months, current }: { months: YearMonth[]; current?: string }) {
  const [active, setActive] = useStoredSet<SeriesKey>("monnaie:year-series", ["income", "charges", "spent", "kept"]);
  const [hover, setHover] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  useBusy(pending);

  const bars = SERIES.filter((s) => s.kind === "bar" && active.has(s.key));
  const lines = SERIES.filter((s) => s.kind === "line" && active.has(s.key));
  const W = 960;
  const H = 320;
  const PAD = 84;
  const slot = (W - PAD - 12) / 12;
  const values = months.flatMap((m) => [...bars, ...lines].map((s) => m[s.key]));
  const top = Math.max(1, ...values);
  const bottom = Math.min(0, ...values);
  const y = (v: number) => 10 + (1 - (v - bottom) / (top - bottom)) * (H - 20);
  const barWidth = bars.length ? Math.min(22, (slot * 0.72) / bars.length) : 0;
  const lastData = months.findLastIndex((m) => m.hasData);

  const toggle = (key: SeriesKey) =>
    setActive((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size ? next : set;
    });
  const open = (i: number) => {
    if (!months[i].hasData) return;
    startTransition(() => openMonth(months[i].month));
  };

  return (
    <figure>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Séries affichées">
        {SERIES.map((s) => (
          <Chip key={s.key} on={active.has(s.key)} color={s.color} label={s.label} dashed={s.kind === "line"} onClick={() => toggle(s.key)} />
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + 30}`} className={`w-full overflow-visible ${pending ? "opacity-60" : ""}`} role="img" aria-label="Flux de l'année mois par mois" onPointerLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(bottom + (top - bottom) * f);
            return (
              <g key={f}>
                <line x1={PAD} x2={W - 12} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
                <text x={PAD - 10} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#7b7c86">
                  {formatMoney(v)}
                </text>
              </g>
            );
          })}
          {bottom < 0 && <line x1={PAD} x2={W - 12} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.3)" />}

          {months.map((m, i) => {
            const x0 = PAD + slot * i;
            const groupStart = x0 + (slot - barWidth * bars.length) / 2;
            return (
              <g key={m.month} onPointerEnter={() => setHover(i)} onClick={() => open(i)} className={m.hasData ? "cursor-pointer" : ""}>
                <rect x={x0} y={0} width={slot} height={H} fill={hover === i ? "rgba(255,255,255,0.06)" : m.month === current ? "rgba(255,122,47,0.06)" : "transparent"} />
                {bars.map((s, j) => {
                  const v = Math.max(m[s.key], 0);
                  return (
                    <rect
                      key={`${s.key}-${active.size}`}
                      x={groupStart + j * barWidth + 1}
                      y={y(v)}
                      width={barWidth - 2}
                      height={Math.max(0, y(0) - y(v))}
                      fill={s.color}
                      className="mn-bar"
                      style={{ animationDelay: `${i * 25}ms` } as CSSProperties}
                    />
                  );
                })}
                <text x={x0 + slot / 2} y={H + 22} textAnchor="middle" fontSize="14" fontWeight="700" fill={m.month === current ? "#fff" : m.hasData ? "#9a9cab" : "#4a4c5c"}>
                  {short(m.month)}
                </text>
              </g>
            );
          })}

          {lines.map((s) => {
            const points = months.slice(0, lastData + 1).map((m, i) => [PAD + slot * i + slot / 2, y(m[s.key])] as const);
            return (
              <g key={s.key} pointerEvents="none">
                <path
                  d={points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")}
                  pathLength={1}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="3"
                  strokeDasharray={s.key === "savingsBalance" ? "2 7" : undefined}
                  strokeLinecap="round"
                  className={s.key === "savingsBalance" ? "" : "mn-draw"}
                />
                {points.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r={hover === i ? 6 : 4} fill={s.color} stroke="var(--mn-ink)" strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-56 border-[3px] border-[var(--mn-ink)] bg-white px-3 py-2 text-sm text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)]"
            style={{ left: `${((PAD + slot * hover + slot / 2) / W) * 100}%`, transform: hover > 7 ? "translateX(calc(-100% - 16px)) rotate(-1deg)" : "translateX(16px) rotate(1deg)" }}
          >
            <p className="mn-punch mb-1 text-base capitalize">{monthName(months[hover].month)}</p>
            {months[hover].hasData ? (
              <>
                {SERIES.map((s) => (
                  <p key={s.key} className={`flex items-center justify-between gap-4 font-semibold ${active.has(s.key) ? "" : "opacity-45"}`}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 border border-[var(--mn-ink)]" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span>{s.key === "kept" || s.key === "saved" ? formatSigned(months[hover][s.key]) : formatMoney(months[hover][s.key])}</span>
                  </p>
                ))}
                <p className="mt-1.5 border-t-2 border-dashed border-zinc-200 pt-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">Clique pour ouvrir le mois</p>
              </>
            ) : (
              <p className="text-zinc-500">Pas encore de données.</p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

// Distinct hues (the orange accent is the total's): one per account, so no two curves look alike.
const ACCOUNT_COLORS = ["#e8e8ee", "#fec83e", "#5ee08a", "#4fa3ff", "#c58cff", "#ff6fae", "#3ee0d0", "#b8e04a"];

/**
 * Level of each account at the end of every month of the year, and their total. `months` starts with the
 * December before (the level at the start of the year); `levels` has one value per month of `months`.
 */
export function AccountLevelsChart({ months, levels }: { months: string[]; levels: AccountLevels[] }) {
  const [hidden, setHidden] = useStoredSet<string>("monnaie:accounts-hidden", []);
  const accounts = levels.map((l, i) => ({ ...l, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length], total: false }));
  const counted = accounts.filter((a) => !hidden.has(a.id));
  const series = [
    ...accounts,
    {
      id: "total",
      name: counted.length === accounts.length ? "Total" : "Total affiché",
      emoji: "Σ",
      type: "courant" as const,
      personal: true,
      color: "var(--mn-accent)",
      total: true,
      // The accounts shown only; unknown as soon as one of them is unknown.
      values: months.map((_, i) => (counted.every((l) => l.values[i] !== null) ? counted.reduce((n, l) => n + (l.values[i] ?? 0), 0) : null)),
    },
  ];
  // Savings: the livrets and the business accounts, where money is kept. Everyday: the cards you pay with.
  const isSavings = (a: (typeof accounts)[number]) => a.type === "livret" || !a.personal;
  const views = [
    { key: "all", label: "Tout", ids: accounts.map((a) => a.id) },
    // A closed account (empty for months) only shows in "Tout".
    { key: "savings", label: "Épargne", ids: accounts.filter((a) => !a.closed && isSavings(a)).map((a) => a.id) },
    { key: "everyday", label: "Quotidien", ids: accounts.filter((a) => !a.closed && !isSavings(a)).map((a) => a.id) },
  ];
  const view = views.find((v) => accounts.every((a) => v.ids.includes(a.id) !== hidden.has(a.id)))?.key;
  const showOnly = (ids: string[]) => setHidden(new Set(accounts.filter((a) => !ids.includes(a.id)).map((a) => a.id)));
  const [hover, setHover] = useState<number | null>(null);
  // The account pointed at (chip or card): its curve stands out, the others fade.
  const [focus, setFocus] = useState<string | null>(null);
  const shown = series.filter((s) => !hidden.has(s.id));
  const faded = (id: string) => focus !== null && focus !== id;
  const W = 960;
  const H = 300;
  const PAD = 84;
  const slot = (W - PAD - 12) / 12;
  const values = shown.flatMap((s) => s.values.slice(1).filter((v): v is number => v !== null));
  const top = Math.max(1, ...values);
  const bottom = Math.min(0, ...values);
  const y = (v: number) => 10 + (1 - (v - bottom) / (top - bottom || 1)) * (H - 20);
  const x = (i: number) => PAD + slot * i + slot / 2;
  const toggle = (id: string) =>
    setHidden((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return accounts.some((a) => !next.has(a.id)) ? next : set;
    });
  const last = (s: (typeof series)[number]) => s.values.findLastIndex((v) => v !== null);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border-2 border-[var(--mn-ink)] bg-white" role="group" aria-label="Quels comptes">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => showOnly(v.ids)}
              aria-pressed={view === v.key}
              title={v.key === "savings" ? "Livrets et comptes pro : là où l'argent dort" : v.key === "everyday" ? "Les comptes avec lesquels tu paies" : "Tous les comptes"}
              className={`mn-punch px-4 pb-1.5 pt-2.5 text-base transition ${view === v.key ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : "text-[var(--mn-ink)] hover:bg-zinc-100"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-[var(--mn-muted)]">
          {view === "savings" ? "Livrets et comptes pro : l'argent mis de côté." : view === "everyday" ? "Les comptes du quotidien, ceux avec lesquels tu paies." : "Ou choisis compte par compte ↓"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Comptes affichés">
        {series.map((s) => (
          <span key={s.id} onPointerEnter={() => setFocus(s.id)} onPointerLeave={() => setFocus(null)}>
            <Chip on={!hidden.has(s.id)} color={s.color} label={`${s.emoji} ${s.name}`} dashed={s.total} onClick={() => toggle(s.id)} />
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full overflow-visible" role="img" aria-label="Niveau des comptes à la fin de chaque mois" onPointerLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const v = Math.round(bottom + (top - bottom) * f);
            return (
              <g key={f}>
                <line x1={PAD} x2={W - 12} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.07)" />
                <text x={PAD - 10} y={y(v) + 4} textAnchor="end" fontSize="12" fill="#7b7c86">
                  {formatMoney(v)}
                </text>
              </g>
            );
          })}
          {bottom < 0 && <line x1={PAD} x2={W - 12} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.3)" />}
          {months.slice(1).map((m, i) => (
            <g key={m} onPointerEnter={() => setHover(i + 1)}>
              <rect x={PAD + slot * i} y={0} width={slot} height={H} fill={hover === i + 1 ? "rgba(255,255,255,0.06)" : "transparent"} />
              <text x={x(i)} y={H + 22} textAnchor="middle" fontSize="14" fontWeight="700" fill={series[0].values[i + 1] === null ? "#4a4c5c" : "#9a9cab"}>
                {short(m)}
              </text>
            </g>
          ))}
          {shown.map((s) => {
            const points = s.values.slice(1).flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as const]));
            return (
              <g key={`${s.id}-${hidden.size}`} pointerEvents="none" className="transition-opacity duration-200" opacity={faded(s.id) ? 0.12 : 1}>
                <path
                  d={points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")}
                  pathLength={1}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={focus === s.id ? 6 : s.total ? 3 : 3.5}
                  strokeDasharray={s.total ? "2 7" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={s.total ? "" : "mn-draw"}
                />
                {points.map(([px, py], i) => (
                  <circle key={i} cx={px} cy={py} r={hover === i + 1 ? 6 : 3.5} fill={s.color} stroke="var(--mn-ink)" strokeWidth="2" />
                ))}
              </g>
            );
          })}
        </svg>

        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-64 border-[3px] border-[var(--mn-ink)] bg-white px-3 py-2 text-sm text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)]"
            style={{ left: `${(x(hover - 1) / W) * 100}%`, transform: hover > 8 ? "translateX(calc(-100% - 16px)) rotate(-1deg)" : "translateX(16px) rotate(1deg)" }}
          >
            <p className="mn-punch mb-1 text-base">Fin {monthName(months[hover])}</p>
            {series.map((s) => {
              const v = s.values[hover];
              const before = s.values[hover - 1];
              return (
                <p key={s.id} className={`flex items-center justify-between gap-4 font-semibold ${hidden.has(s.id) ? "opacity-45" : ""} ${s.total ? "mt-1 border-t-2 border-dashed border-zinc-200 pt-1" : ""}`}>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 border border-[var(--mn-ink)]" style={{ background: s.color }} />
                    {s.name}
                  </span>
                  <span className="text-right">
                    {v === null ? "—" : formatMoney(v)}
                    {v !== null && before !== null && v !== before && (
                      <span className={`ml-2 text-xs ${v > before ? "text-emerald-600" : "text-[var(--mn-red)]"}`}>{formatSigned(v - before)}</span>
                    )}
                  </span>
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* The year of each account: from the start of the year to its last known month. */}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {series.map((s) => {
          const end = last(s);
          const start = s.values[0];
          const value = end >= 0 ? s.values[end] : null;
          return (
            <li
              key={s.id}
              onPointerEnter={() => setFocus(s.id)}
              onPointerLeave={() => setFocus(null)}
              onClick={() => toggle(s.id)}
              title={hidden.has(s.id) ? "Afficher la courbe" : "Masquer la courbe"}
              className={`mn-shape grid cursor-pointer gap-1 py-3 pl-6 pr-4 transition ${hidden.has(s.id) ? "opacity-40" : ""} ${focus === s.id ? "-translate-y-0.5" : ""}`}
              style={{ "--mn-shape": s.total ? "var(--mn-ink)" : "var(--mn-panel-2)" } as CSSProperties}
            >
              {/* The curve's color, as a thick band down the card. */}
              <span aria-hidden className="absolute bottom-2 left-1.5 top-2 w-2" style={{ background: s.total ? `repeating-linear-gradient(${s.color} 0 6px, transparent 6px 10px)` : s.color }} />
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: s.color }}>
                {s.emoji} {s.name}
              </span>
              <span className="flex items-end justify-between gap-3">
                <span className="mn-punch text-2xl">{value === null ? "—" : formatMoney(value)}</span>
                <Spark values={s.values.slice(1)} color={s.color} />
              </span>
              <span className="text-sm text-[var(--mn-muted)]">
                {value !== null && start !== null ? (
                  <>
                    <b className={value >= start ? "text-emerald-400" : "text-[var(--mn-red)]"}>{formatSigned(value - start)}</b> depuis janvier
                  </>
                ) : (
                  "pas de niveau connu en début d'année"
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Categories of the year: pick plaisir or charges, pick a category, read its 12 months and where it went. */
export function CategoryExplorer({ expense, charge, year }: { expense: CategoryYear[]; charge: CategoryYear[]; year: number }) {
  const [kind, setKind] = useState<"expense" | "charge">("expense");
  const list = kind === "expense" ? expense : charge;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = list.find((c) => c.category.id === selectedId) ?? list[0];
  const [hover, setHover] = useState<number | null>(null);
  const total = list.reduce((n, c) => n + c.total, 0) || 1;

  const stats = useMemo(() => {
    if (!selected) return null;
    const active = selected.months.filter((v) => v > 0);
    const max = Math.max(...selected.months);
    return {
      perMonth: active.length ? Math.round(selected.total / active.length) : 0,
      maxMonth: selected.months.indexOf(max),
      max,
      average: selected.count ? Math.round(selected.total / selected.count) : 0,
    };
  }, [selected]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex border-2 border-[var(--mn-ink)] bg-white" role="tablist" aria-label="Type">
          {(
            [
              ["expense", "Plaisir"],
              ["charge", "Charges"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={kind === key}
              onClick={() => (setKind(key), setSelectedId(null))}
              className={`mn-punch px-4 pb-1.5 pt-2.5 text-base transition ${kind === key ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : "text-[var(--mn-ink)] hover:bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-[var(--mn-muted)]">
          {list.length} catégories · <b className="text-white">{formatMoney(list.reduce((n, c) => n + c.total, 0))}</b> en {year}
        </span>
      </div>

      {list.length === 0 ? (
        <p className="py-6 text-[var(--mn-muted)]">Rien cette année.</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <ul className="grid gap-1.5">
            {list.map((c) => {
              const on = c.category.id === selected?.category.id;
              return (
                <li key={c.category.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.category.id)}
                    aria-pressed={on}
                    className={`grid w-full gap-1.5 px-3 py-2 text-left transition ${on ? "-rotate-[0.6deg] bg-white text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)]" : "hover:bg-white/5"}`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="mn-punch text-lg">
                        {c.category.emoji} {c.category.label}
                      </span>
                      <span className={`text-sm font-bold ${on ? "" : "text-zinc-300"}`}>
                        {formatMoney(c.total)} · {Math.round((c.total / total) * 100)} %
                      </span>
                    </span>
                    <span className={`h-2 ${on ? "bg-zinc-200" : "bg-black/30"}`}>
                      <span className="mn-grow block h-full" style={{ width: `${(c.total / list[0].total) * 100}%`, background: on ? "var(--mn-accent)" : "#6b6e85" }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && stats && (
            <div key={`${kind}-${selected.category.id}`} className="mn-shape mn-paper mn-drop grid gap-5 p-6" style={{ "--mn-tilt": "0.5deg" } as CSSProperties}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-zinc-500">[{kind === "expense" ? "Plaisir" : "Charge"}]</span>
                  <h3 className="mn-punch text-4xl">
                    {selected.category.emoji} {selected.category.label}
                  </h3>
                </div>
                <p className="mn-punch text-4xl">{formatMoney(selected.total)}</p>
              </div>
              <div className="grid grid-cols-3 gap-3 border-y-2 border-dashed border-zinc-200 py-3 text-sm">
                <Fact label="Par mois actif" value={formatMoney(stats.perMonth)} />
                <Fact label="Panier moyen" value={formatMoney(stats.average)} />
                <Fact label={`Pic : ${monthName(`${year}-${String(stats.maxMonth + 1).padStart(2, "0")}`)}`} value={formatMoney(stats.max)} />
              </div>

              {/* 12 bars, hover to read */}
              <div>
                <div className="flex h-28 items-end gap-1.5" onPointerLeave={() => setHover(null)}>
                  {selected.months.map((v, i) => (
                    <div key={i} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)}>
                      <div
                        className="mn-bar w-full"
                        style={{ height: `${(v / (stats.max || 1)) * 100}%`, background: hover === i ? "var(--mn-ink)" : "var(--mn-accent)", animationDelay: `${i * 30}ms` } as CSSProperties}
                      />
                      {hover === i && (
                        <LinesCard
                          title={monthName(`${year}-${String(i + 1).padStart(2, "0")}`)}
                          total={v}
                          lines={selected.lines.filter((l) => Number(l.date.slice(5, 7)) === i + 1)}
                          className={`bottom-full mb-2 w-64 ${i < 3 ? "left-0" : i > 8 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1.5 text-center text-[11px] font-bold uppercase text-zinc-500">
                  {selected.months.map((_, i) => (
                    <span key={i} className="flex-1">
                      {short(`${year}-${String(i + 1).padStart(2, "0")}`)}
                    </span>
                  ))}
                </div>
              </div>

              <WhereItGoes key={`${kind}-${selected.category.id}`} top={selected.top} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mn-punch text-xl">{value}</div>
    </div>
  );
}

/** Plaisir spent day by day over the year, GitHub style: the darker, the more; hover a day to read it. */
export function SpendingCalendar({ year, days, today }: { year: number; days: Record<string, DaySpending>; today: string }) {
  const [hover, setHover] = useState<{ date: string; x: number; y: number } | null>(null);
  // A click pins a day's card, so the pointer can reach its lines (to edit them).
  const [pinned, setPinned] = useState<{ date: string; x: number; y: number } | null>(null);
  const card = pinned ?? hover;
  const first = new Date(year, 0, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const total = new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
  const dates = Array.from({ length: total }, (_, i) => {
    const d = new Date(year, 0, 1 + i);
    return `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const amounts = Object.values(days).map((d) => d.amount).sort((a, b) => a - b);
  // Four levels from the spending quartiles.
  const q = [0.25, 0.5, 0.75].map((f) => amounts[Math.floor(f * (amounts.length - 1))] ?? 0);
  const level = (amount: number) => (amount <= 0 ? 0 : amount <= q[0] ? 1 : amount <= q[1] ? 2 : amount <= q[2] ? 3 : 4);
  const COLORS = ["rgba(255,255,255,0.06)", "color-mix(in srgb, var(--mn-accent) 30%, #262838)", "color-mix(in srgb, var(--mn-accent) 55%, #262838)", "color-mix(in srgb, var(--mn-accent) 80%, #262838)", "var(--mn-accent)"];
  const CELL = 15;
  const GAP = 3;
  const weeks = Math.ceil((offset + total) / 7);
  const WIDTH = 40 + weeks * (CELL + GAP);
  const HEIGHT = 22 + 7 * (CELL + GAP);
  const spentDays = Object.keys(days).length;
  const elapsed = dates.filter((d) => d <= today).length;
  const biggest = Object.entries(days).sort((a, b) => b[1].amount - a[1].amount)[0];

  return (
    <div className="grid gap-4">
      <div className="relative overflow-x-auto pb-2" onPointerLeave={() => setHover(null)}>
        {/* Scales to the panel width; the hover card is placed in % of the drawing. */}
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[640px]" role="img" aria-label={`Dépenses plaisir par jour en ${year}`}>
          {["L", "", "M", "", "V", "", "D"].map((d, i) => (
            <text key={i} x={0} y={22 + i * (CELL + GAP) + CELL - 3} fontSize="11" fill="#7b7c86">
              {d}
            </text>
          ))}
          {Array.from({ length: 12 }, (_, m) => {
            const index = dates.findIndex((d) => d.slice(5, 7) === String(m + 1).padStart(2, "0"));
            const week = Math.floor((offset + index) / 7);
            return (
              <text key={m} x={40 + week * (CELL + GAP)} y={12} fontSize="11" fontWeight="700" fill="#9a9cab">
                {short(`${year}-${String(m + 1).padStart(2, "0")}`)}
              </text>
            );
          })}
          {dates.map((date, i) => {
            const week = Math.floor((offset + i) / 7);
            const weekday = (offset + i) % 7;
            const day = days[date];
            const future = date > today;
            return (
              <rect
                key={date}
                x={40 + week * (CELL + GAP)}
                y={22 + weekday * (CELL + GAP)}
                width={CELL}
                height={CELL}
                fill={future ? "transparent" : COLORS[level(day?.amount ?? 0)]}
                stroke={card?.date === date ? "#fff" : future ? "rgba(255,255,255,0.06)" : "none"}
                strokeWidth={2}
                className={day ? "cursor-pointer" : ""}
                onPointerEnter={() => setHover({ date, x: 40 + week * (CELL + GAP), y: 22 + weekday * (CELL + GAP) })}
                onClick={() => (day ? setPinned(pinned?.date === date ? null : { date, x: 40 + week * (CELL + GAP), y: 22 + weekday * (CELL + GAP) }) : setPinned(null))}
              />
            );
          })}
        </svg>
        {card && (
          <LinesCard
            title={localDate(card.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
            total={days[card.date]?.amount ?? 0}
            lines={days[card.date]?.lines ?? []}
            max={pinned ? 20 : 6}
            showDate={false}
            interactive={!!pinned}
            onClose={pinned ? () => setPinned(null) : undefined}
            className="w-64"
            style={{ left: `${((card.x + CELL) / WIDTH) * 100}%`, top: `${(card.y / HEIGHT) * 100}%`, transform: card.x / WIDTH > 0.7 ? "translate(calc(-100% - 24px), -50%)" : "translate(8px, -50%)" }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--mn-muted)]">
        <span>
          <b className="text-white">{elapsed - spentDays}</b> jours sans dépense plaisir sur {elapsed}
          {biggest && (
            <>
              {" "}
              · plus grosse journée : <b className="text-white">{formatMoney(biggest[1].amount)}</b> le {localDate(biggest[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          moins
          {COLORS.map((c, i) => (
            <span key={i} className="h-3 w-3" style={{ background: c }} />
          ))}
          plus
        </span>
      </div>
    </div>
  );
}

const FIRST_LABELS = 6;

/** Where a category's money went: the biggest labels first, the rest on demand, a search when there are many. */
function WhereItGoes({ top }: { top: CategoryYear["top"] }) {
  const [hover, setHover] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const words = query.trim().toUpperCase();
  const matching = words ? top.filter((t) => t.label.includes(words)) : top;
  const shown = all || words ? matching : matching.slice(0, FIRST_LABELS);
  const rest = matching.slice(FIRST_LABELS);
  const max = top[0]?.total || 1;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Où ça part · {top.length} libellé{top.length > 1 ? "s" : ""}
        </p>
        {top.length > FIRST_LABELS * 2 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher…"
            aria-label="Chercher un libellé"
            className="w-36 !border-2 !py-1 !text-xs uppercase"
          />
        )}
      </div>
      <ul className="grid gap-1" onPointerLeave={() => setHover(null)}>
        {shown.map((t) => (
          <li
            key={t.label}
            tabIndex={0}
            onPointerEnter={() => setHover(t.label)}
            onFocus={() => setHover(t.label)}
            onBlur={() => setHover(null)}
            className={`relative -mx-2 grid gap-1 px-2 py-1 outline-none transition ${hover === t.label ? "bg-zinc-100" : ""}`}
          >
            <span className="flex justify-between gap-3 text-sm font-bold">
              <span className="truncate">{t.label}</span>
              <span className="shrink-0">
                {formatMoney(t.total)} <span className="font-semibold text-zinc-500">· {t.count}×</span>
              </span>
            </span>
            <span className="h-1.5 bg-zinc-200">
              <span className="block h-full transition-colors" style={{ width: `${(t.total / max) * 100}%`, background: hover === t.label ? "var(--mn-accent)" : "var(--mn-ink)" }} />
            </span>
            {hover === t.label && (
              <LinesCard title={`${t.label} · ${t.count} passage${t.count > 1 ? "s" : ""}`} total={t.total} lines={t.lines} max={30} showLabel={false} className="bottom-full left-0 right-0 mb-1" />
            )}
          </li>
        ))}
        {words && matching.length === 0 && <li className="py-2 text-sm text-zinc-500">Aucun libellé ne correspond.</li>}
      </ul>
      {!words && rest.length > 0 && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mt-2 flex w-full items-center justify-between gap-3 border-2 border-dashed border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-600 transition hover:border-[var(--mn-ink)] hover:text-[var(--mn-ink)]"
        >
          <span>{all ? "▲ Réduire" : `▼ ${rest.length} autre${rest.length > 1 ? "s" : ""} libellé${rest.length > 1 ? "s" : ""}`}</span>
          {!all && <span>{formatMoney(rest.reduce((n, t) => n + t.total, 0))}</span>}
        </button>
      )}
    </div>
  );
}

/** The account's year as a tiny curve in its color, to tie the card to its line on the chart. */
function Spark({ values, color }: { values: (number | null)[]; color: string }) {
  const known = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (known.length < 2) return null;
  const nums = known.map(([, v]) => v);
  const [min, max] = [Math.min(...nums), Math.max(...nums)];
  const points = known.map(([i, v]) => `${((i / 11) * 70).toFixed(1)},${(22 - ((v - min) / (max - min || 1)) * 18).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 70 26" className="h-7 w-20 shrink-0" aria-hidden>
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
