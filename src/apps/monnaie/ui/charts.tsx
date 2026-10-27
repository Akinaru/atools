import type { CSSProperties } from "react";
import { formatMoney, monthShortName, type Cents, type CategoryTotal, type MonthStats } from "../money";

/**
 * One row per category, the biggest in the accent color. Optional per-category `budgets` (a white marker, the bar turns
 * red past it) and `averages` (usual monthly amount: shows the gap, e.g. "+38 % vs moy.").
 */
export function CategoryBars({
  totals,
  dark = false,
  budgets = {},
  averages,
}: {
  totals: CategoryTotal[];
  dark?: boolean;
  budgets?: Record<string, Cents>;
  averages?: Map<string, Cents>;
}) {
  const max = Math.max(totals[0]?.total ?? 1, ...totals.map((t) => budgets[t.category.id] ?? 0), 1);
  const all = totals.reduce((n, t) => n + t.total, 0) || 1;
  return (
    <ul className="grid gap-4">
      {totals.map((t, i) => {
        const budget = budgets[t.category.id];
        const over = budget !== undefined && t.total > budget;
        const average = averages?.get(t.category.id);
        // Only against a meaningful habit (10 € a month or more): 75 € vs 1,67 € is not a trend.
        const gap = average && average >= 1000 ? (t.total - average) / average : null;
        return (
          <li key={t.category.id}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="mn-punch text-lg">
                <span className="mr-2 not-italic">{t.category.emoji}</span>
                {t.category.label}
              </span>
              <span className={`text-right text-sm font-bold ${dark ? "text-zinc-300" : "text-zinc-600"}`}>
                {formatMoney(t.total)}
                {budget !== undefined ? ` / ${formatMoney(budget)}` : ` · ${Math.round((t.total / all) * 100)} %`}
                {gap !== null && Math.abs(gap) >= 0.1 && (
                  <span className={`ml-2 ${gap > 0 ? "text-[var(--mn-red)]" : "text-emerald-400"}`} title={`Moyenne des 3 mois précédents : ${formatMoney(average!)}`}>
                    {gap > 0 ? "+" : "−"}
                    {Math.round(Math.abs(gap) * 100)} % vs moy.
                  </span>
                )}
              </span>
            </div>
            <div className={`relative h-3 ${dark ? "bg-black/30" : "bg-zinc-100"}`}>
              <div
                className="mn-grow h-full"
                style={{
                  width: `${(t.total / max) * 100}%`,
                  background: over ? "var(--mn-red)" : i === 0 ? "var(--mn-accent)" : dark ? "#6b6e85" : "#3a3b44",
                  animationDelay: `${i * 60}ms`,
                } as CSSProperties}
              />
              {budget !== undefined && (
                <span className="absolute -bottom-1 -top-1 w-[3px] bg-white" style={{ left: `${(budget / max) * 100}%` }} title={`Budget ${formatMoney(budget)}`} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 12 months: income bar, and an outflow bar stacked with charges, plaisir and what was put aside.
 * The dotted line is the livret balance at the end of each month.
 */
export function YearChart({ months, current }: { months: MonthStats[]; current?: string }) {
  const W = 720;
  const H = 260;
  const outflow = (m: MonthStats) => m.charges + m.spent + Math.max(m.saved, 0);
  const lastActive = months.findLastIndex((m) => m.entries.length > 0);
  const balances = months.slice(0, lastActive + 1).map((m) => m.savingsBalance);
  const top = Math.max(...months.flatMap((m) => [m.income, outflow(m)]), ...balances, 1);
  const slot = W / 12;
  const bar = slot * 0.3;
  const y = (cents: number) => H - (Math.max(cents, 0) / top) * H;
  const h = (cents: number) => (Math.max(cents, 0) / top) * H;
  const line = balances.map((v, i) => `${i ? "L" : "M"}${(slot * i + slot / 2).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full overflow-visible" role="img" aria-label="Revenus, dépenses et livret par mois">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} stroke="rgba(255,255,255,0.06)" />
        ))}
        {months.map((m, i) => {
          const cx = slot * i + slot / 2;
          // Stack from the bottom: charges, then plaisir, then livret.
          const stack = [
            { value: m.charges, fill: "var(--mn-muted)", label: "Charges" },
            { value: m.spent, fill: "var(--mn-accent)", label: "Cramé" },
            { value: Math.max(m.saved, 0), fill: "var(--mn-yellow)", label: "Livret" },
          ];
          let base = H;
          return (
            <g key={m.month}>
              {m.month === current && <rect x={slot * i + 2} y="0" width={slot - 4} height={H} fill="rgba(255,255,255,0.04)" />}
              <rect x={cx - bar - 2} y={y(m.income)} width={bar} height={h(m.income)} fill="#e8e8ee">
                <title>{`Encaissé ${formatMoney(m.income)}`}</title>
              </rect>
              {stack.map((part) => {
                base -= h(part.value);
                return (
                  <rect key={part.label} x={cx + 2} y={base} width={bar} height={h(part.value)} fill={part.fill}>
                    <title>{`${part.label} ${formatMoney(part.value)}`}</title>
                  </rect>
                );
              })}
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
          <span className="h-3 w-3 bg-[var(--mn-muted)]" /> Charges
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-[var(--mn-accent)]" /> Cramé (plaisir)
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 bg-[var(--mn-yellow)]" /> Mis de côté
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0 w-5 border-t-[3px] border-dotted border-[var(--mn-yellow)]" /> Solde du livret
        </span>
      </figcaption>
    </figure>
  );
}
