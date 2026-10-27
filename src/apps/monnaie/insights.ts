// What the ledger says beyond the totals: what comes back every month, where the month will land,
// and how each category compares with the usual. Pure functions, like money.ts.

import { normalizeBankLabel } from "./import/suggest";
import {
  accountBalanceAt,
  categoriesOf,
  daysInMonth,
  getCategory,
  monthOf,
  shiftMonth,
  signedAmount,
  type Category,
  type Cents,
  type Entry,
  type Kind,
  type Ledger,
} from "./money";

/** Something paid or received about every month (subscription, rent, salary…). */
export type RecurringItem = {
  key: string;
  label: string;
  kind: Kind;
  category: Category;
  /** Typical amount (median), positive. */
  amount: Cents;
  /** Typical day of the month. */
  day: number;
  /** Months (among the last 6) where it showed up. */
  months: number;
  lastDate: string;
  /** Already seen in the reference month. */
  seenThisMonth: boolean;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

const RECURRING_KINDS: Kind[] = ["expense", "charge", "income"];

/**
 * Lines with the same label, in at least 3 of the 6 months up to `month`, with steady amounts (most within 25 %
 * of the median), and still alive (seen within the last 2 months).
 */
export function detectRecurring(ledger: Ledger, month: string): RecurringItem[] {
  const first = shiftMonth(month, -5);
  const categories = categoriesOf(ledger);
  const groups = new Map<string, Entry[]>();
  for (const e of ledger.entries) {
    const m = monthOf(e.date);
    if (m < first || m > month || !RECURRING_KINDS.includes(e.kind)) continue;
    const key = `${e.kind}|${normalizeBankLabel(e.label)}`;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const items: RecurringItem[] = [];
  for (const [key, list] of groups) {
    const months = new Set(list.map((e) => monthOf(e.date)));
    if (months.size < 3) continue;
    const amount = median(list.map((e) => e.amount));
    const steady = list.filter((e) => Math.abs(e.amount - amount) <= amount * 0.25).length;
    if (steady < list.length * 0.6) continue;
    const last = list.reduce((a, b) => (a.date > b.date ? a : b));
    if (monthOf(last.date) < shiftMonth(month, -1)) continue;
    // Several lines a month (coffee machine…) are habits, not subscriptions.
    if (list.length > months.size * 1.5) continue;
    items.push({
      key,
      label: last.label,
      kind: last.kind,
      category: getCategory(last.kind, last.category, categories),
      amount,
      day: median(list.map((e) => Number(e.date.slice(8)))),
      months: months.size,
      lastDate: last.date,
      seenThisMonth: months.has(month),
    });
  }
  return items.sort((a, b) => b.amount - a.amount);
}

export type Forecast = {
  /** Real balance at `today`, null without a checkpoint. */
  balance: Cents | null;
  /** Recurring lines expected between tomorrow and the end of the month. */
  upcoming: RecurringItem[];
  /** Effect of the upcoming lines (incomes positive). */
  upcomingFlow: Cents;
  /** Balance expected at the end of the month, null without a checkpoint. */
  endOfMonth: Cents | null;
};

/** Where the current account should land on the last day of `today`'s month. */
export function forecast(ledger: Ledger, today: string): Forecast {
  const month = monthOf(today);
  const day = Number(today.slice(8));
  const upcoming = detectRecurring(ledger, month).filter((r) => !r.seenThisMonth && r.day > day && r.day <= daysInMonth(month));
  const upcomingFlow = upcoming.reduce((n, r) => n + signedAmount({ kind: r.kind, amount: r.amount, category: r.category.id }), 0);
  const balance = accountBalanceAt(ledger, today);
  return { balance, upcoming: upcoming.sort((a, b) => a.day - b.day), upcomingFlow, endOfMonth: balance === null ? null : balance + upcomingFlow };
}

/** Spending of each category in `month` compared with its average over the 3 previous months with data. */
export function categoryAverages(ledger: Ledger, month: string, kind: "expense" | "charge"): Map<string, Cents> {
  const previous: string[] = [];
  const months = new Set(ledger.entries.map((e) => monthOf(e.date)));
  for (let m = shiftMonth(month, -1); previous.length < 3 && m >= shiftMonth(month, -12); m = shiftMonth(m, -1)) if (months.has(m)) previous.push(m);
  const totals = new Map<string, Cents>();
  if (!previous.length) return totals;
  for (const e of ledger.entries) {
    if (e.kind !== kind || !previous.includes(monthOf(e.date))) continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount);
  }
  for (const [id, total] of totals) totals.set(id, Math.round(total / previous.length));
  return totals;
}
