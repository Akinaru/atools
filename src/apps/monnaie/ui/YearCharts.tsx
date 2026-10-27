"use client";

import { useMemo, useState, useTransition, type CSSProperties } from "react";
import type { CategoryYear, DaySpending, LineDetail } from "../insights";
import { formatMoney, formatSigned, monthName, monthShortName, type AccountLevels, type Cents } from "../money";
import { openMonth } from "../server/actions";
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
function LinesCard({ title, total, lines, max = 8, showLabel = true, showDate = true, className = "w-64", style }: { title: string; total: Cents; lines: LineDetail[]; max?: number; showLabel?: boolean; showDate?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div className={`pointer-events-none absolute z-30 border-[3px] border-[var(--mn-ink)] bg-white p-3 text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-ink)] ${className}`} style={style}>
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-dashed border-zinc-200 pb-1.5">
        <span className="mn-punch truncate text-base capitalize">{title}</span>
        <span className="mn-punch shrink-0 text-base text-[var(--mn-accent)]">{formatMoney(total)}</span>
      </div>
      {lines.length ? (
        <ul className={`mt-1.5 grid gap-x-4 gap-y-1 text-[13px] ${showLabel ? "" : "grid-cols-3"}`}>
          {lines.slice(0, max).map((l, i) => (
            <li key={i} className="flex items-baseline gap-2">
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
  const [active, setActive] = useState<Set<SeriesKey>>(new Set(["income", "charges", "spent", "kept"]));
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

const ACCOUNT_COLORS = ["#e8e8ee", "var(--mn-yellow)", "#5ee08a", "#7cc4ff", "#c58cff", "#ff8fb8"];

/**
 * Level of each account at the end of every month of the year, and their total. `months` starts with the
 * December before (the level at the start of the year); `levels` has one value per month of `months`.
 */
export function AccountLevelsChart({ months, levels }: { months: string[]; levels: AccountLevels[] }) {
  const series = [
    ...levels.map((l, i) => ({ ...l, color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length], total: false })),
    {
      id: "total",
      name: "Total",
      emoji: "Σ",
      type: "courant" as const,
      color: "var(--mn-accent)",
      total: true,
      // Unknown as soon as one account is unknown.
      values: months.map((_, i) => (levels.every((l) => l.values[i] !== null) ? levels.reduce((n, l) => n + (l.values[i] ?? 0), 0) : null)),
    },
  ];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const shown = series.filter((s) => !hidden.has(s.id));
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
      return next.size < series.length ? next : set;
    });
  const last = (s: (typeof series)[number]) => s.values.findLastIndex((v) => v !== null);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Comptes affichés">
        {series.map((s) => (
          <Chip key={s.id} on={!hidden.has(s.id)} color={s.color} label={`${s.emoji} ${s.name}`} dashed={s.total} onClick={() => toggle(s.id)} />
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
              <g key={`${s.id}-${hidden.size}`} pointerEvents="none">
                <path
                  d={points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")}
                  pathLength={1}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.total ? 3 : 3.5}
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
            <li key={s.id} className="mn-shape grid gap-1 px-4 py-3" style={{ "--mn-shape": s.total ? "var(--mn-ink)" : "var(--mn-panel-2)" } as CSSProperties}>
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--mn-muted)]">
                <span className="h-2.5 w-2.5" style={{ background: s.color }} aria-hidden />
                {s.emoji} {s.name}
              </span>
              <span className="mn-punch text-2xl">{value === null ? "—" : formatMoney(value)}</span>
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
  const [hoverTop, setHoverTop] = useState<string | null>(null);
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

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Où ça part</p>
                <ul className="grid gap-1" onPointerLeave={() => setHoverTop(null)}>
                  {selected.top.map((t) => (
                    <li
                      key={t.label}
                      tabIndex={0}
                      onPointerEnter={() => setHoverTop(t.label)}
                      onFocus={() => setHoverTop(t.label)}
                      onBlur={() => setHoverTop(null)}
                      className={`relative -mx-2 grid gap-1 px-2 py-1 outline-none transition ${hoverTop === t.label ? "bg-zinc-100" : ""}`}
                    >
                      <span className="flex justify-between gap-3 text-sm font-bold">
                        <span className="truncate">{t.label}</span>
                        <span className="shrink-0">
                          {formatMoney(t.total)} <span className="font-semibold text-zinc-500">· {t.count}×</span>
                        </span>
                      </span>
                      <span className="h-1.5 bg-zinc-200">
                        <span className="block h-full transition-colors" style={{ width: `${(t.total / selected.top[0].total) * 100}%`, background: hoverTop === t.label ? "var(--mn-accent)" : "var(--mn-ink)" }} />
                      </span>
                      {hoverTop === t.label && (
                        <LinesCard title={`${t.label} · ${t.count} passage${t.count > 1 ? "s" : ""}`} total={t.total} lines={t.lines} max={30} showLabel={false} className="bottom-full left-0 right-0 mb-1" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
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
                stroke={hover?.date === date ? "#fff" : future ? "rgba(255,255,255,0.06)" : "none"}
                strokeWidth={2}
                onPointerEnter={() => setHover({ date, x: 40 + week * (CELL + GAP), y: 22 + weekday * (CELL + GAP) })}
              />
            );
          })}
        </svg>
        {hover && (
          <LinesCard
            title={localDate(hover.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" })}
            total={days[hover.date]?.amount ?? 0}
            lines={days[hover.date]?.lines ?? []}
            max={6}
            showDate={false}
            className="w-64"
            style={{ left: `${((hover.x + CELL) / WIDTH) * 100}%`, top: `${(hover.y / HEIGHT) * 100}%`, transform: hover.x / WIDTH > 0.7 ? "translate(calc(-100% - 24px), -50%)" : "translate(8px, -50%)" }}
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
