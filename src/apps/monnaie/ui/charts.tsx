import type { CSSProperties } from "react";
import { formatMoney, type Cents, type CategoryTotal } from "../money";

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
