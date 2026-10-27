import type { CSSProperties } from "react";
import { formatMoney, monthShortName, type Cents, type CategoryTotal, type MonthStats } from "../money";

/** Spending gauge against the monthly budget, with the ideal pace for today. */
export function BudgetGauge({ spent, budget, pace }: { spent: Cents; budget: Cents; pace?: number }) {
  const ratio = budget ? spent / budget : 0;
  const over = ratio > 1;
  return (
    <div>
      <div className="relative h-9 border-[3px] border-[var(--mn-ink)] bg-zinc-100">
        <div
          className="mn-grow h-full"
          style={{ width: `${Math.min(ratio, 1) * 100}%`, background: over ? "var(--mn-red)" : "var(--mn-accent)" }}
        />
        {pace !== undefined && (
          <div className="absolute inset-y-[-8px] w-[3px] bg-[var(--mn-ink)]" style={{ left: `${pace * 100}%` }} title="Rythme idéal aujourd'hui">
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider">auj.</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-sm font-semibold text-zinc-500">
        <span>{Math.round(ratio * 100)} % du budget</span>
        <span>{formatMoney(budget, true)}</span>
      </div>
    </div>
  );
}

/** Cumulative spending of the month, day by day, against a straight budget line. */
export function SpendingCurve({ stats, today }: { stats: MonthStats; today?: number }) {
  const days = stats.cumulative.length;
  const shown = today ? stats.cumulative.slice(0, today) : stats.cumulative;
  const max = Math.max(stats.budget, stats.cumulative[days - 1] ?? 0, 1);
  const W = 600;
  const H = 220;
  const x = (day: number) => (day / (days - 1 || 1)) * W;
  const y = (cents: number) => H - (cents / max) * H;
  const line = shown.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = shown.length ? `${line}L${x(shown.length - 1).toFixed(1)},${H}L0,${H}Z` : "";
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-56 w-full overflow-visible" role="img" aria-label="Dépenses cumulées du mois">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.06)" vectorEffect="non-scaling-stroke" />
        ))}
        {stats.budget > 0 && (
          <line x1="0" y1={H} x2={W} y2={y(stats.budget)} stroke="#6b6c75" strokeWidth="2" strokeDasharray="6 6" vectorEffect="non-scaling-stroke" />
        )}
        {area && <path d={area} fill="rgba(255,122,47,0.16)" />}
        {line && <path d={line} fill="none" stroke="var(--mn-accent)" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      </svg>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-400">
        <span className="flex items-center gap-2">
          <span className="h-1 w-5 bg-[var(--mn-accent)]" /> Cramé cumulé
        </span>
        {stats.budget > 0 && (
          <span className="flex items-center gap-2">
            <span className="h-0 w-5 border-t-2 border-dashed border-zinc-500" /> Rythme du budget
          </span>
        )}
        <span className="ml-auto">jour 1 → {days}</span>
      </figcaption>
    </figure>
  );
}

/** One row per category, the biggest in lime. */
export function CategoryBars({ totals, dark = false }: { totals: CategoryTotal[]; dark?: boolean }) {
  const max = totals[0]?.total ?? 1;
  const all = totals.reduce((n, t) => n + t.total, 0) || 1;
  return (
    <ul className="grid gap-4">
      {totals.map((t, i) => (
        <li key={t.category.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="mn-punch text-lg">
              <span className="mr-2 not-italic">{t.category.emoji}</span>
              {t.category.label}
            </span>
            <span className={`text-sm font-bold ${dark ? "text-zinc-300" : "text-zinc-600"}`}>
              {formatMoney(t.total)} · {Math.round((t.total / all) * 100)} %
            </span>
          </div>
          <div className={`h-3 ${dark ? "bg-black/30" : "bg-zinc-100"}`}>
            <div
              className="mn-grow h-full"
              style={{ width: `${(t.total / max) * 100}%`, background: i === 0 ? "var(--mn-accent)" : dark ? "#6b6e85" : "#3a3b44", animationDelay: `${i * 60}ms` } as CSSProperties}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 12 months: income vs spending bars, and the money left piling up. */
export function YearChart({ months, cumulativeLeft, current }: { months: MonthStats[]; cumulativeLeft: Cents[]; current?: string }) {
  const W = 720;
  const H = 260;
  const top = Math.max(...months.flatMap((m) => [m.income, m.spent]), ...cumulativeLeft.map(Math.abs), 1);
  const slot = W / 12;
  const bar = slot * 0.3;
  const y = (cents: number) => H - (Math.max(cents, 0) / top) * H;
  const lastActive = months.findLastIndex((m) => m.entries.length > 0);
  const line = cumulativeLeft
    .slice(0, lastActive + 1)
    .map((v, i) => `${i ? "L" : "M"}${(slot * i + slot / 2).toFixed(1)},${y(v).toFixed(1)}`)
    .join("");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full overflow-visible" role="img" aria-label="Revenus et dépenses par mois">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="rgba(255,255,255,0.06)" />
        ))}
        {months.map((m, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={m.month}>
              {m.month === current && <rect x={slot * i + 2} y="0" width={slot - 4} height={H} fill="rgba(255,255,255,0.04)" />}
              <rect x={cx - bar - 2} y={y(m.income)} width={bar} height={H - y(m.income)} fill="#e8e8ee">
                <title>{`Encaissé ${formatMoney(m.income)}`}</title>
              </rect>
              <rect x={cx + 2} y={y(m.spent)} width={bar} height={H - y(m.spent)} fill="var(--mn-accent)">
                <title>{`Cramé ${formatMoney(m.spent)}`}</title>
              </rect>
              <text x={cx} y={H + 22} textAnchor="middle" fontSize="15" fill={m.month === current ? "#fff" : "#7b7c86"} fontWeight="700">
                {monthShortName(m.month).replace(".", "")}
              </text>
            </g>
          );
        })}
        {line && <path d={line} fill="none" stroke="var(--mn-yellow)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round" />}
      </svg>
      <figcaption className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-400">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-[#e8e8ee]" /> Encaissé
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-[var(--mn-accent)]" /> Cramé (pas nécessaire)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-[3px] border-dotted border-[var(--mn-yellow)]" /> Reste cumulé
        </span>
      </figcaption>
    </figure>
  );
}
