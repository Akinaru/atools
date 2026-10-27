// Domain of the app: data types, categories, amounts and the stats computed from the ledger.
// Pure functions only (no I/O), shared by the UI, the Server Actions and the API.

/** Amounts are integers in cents, never floats. */
export type Cents = number;

export type Kind = "income" | "expense";

export type Entry = {
  id: string;
  kind: Kind;
  amount: Cents;
  label: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  /** Expense only: "ça valait pas le coup". */
  regret: boolean;
  /** Set when the entry was added from a recurring template. */
  recurringId?: string;
  createdAt: string;
};

/** Template added in one click each month (salary, subscriptions…). */
export type Recurring = {
  id: string;
  kind: Kind;
  amount: Cents;
  label: string;
  category: string;
  /** Day of the month, 1 to 28 so it exists in every month. */
  day: number;
};

export type Goal = {
  id: string;
  name: string;
  emoji: string;
  target: Cents;
  saved: Cents;
  createdAt: string;
};

export type Settings = {
  /** Monthly budget for unnecessary spending. 0 = no budget. */
  monthlyBudget: Cents;
  /** Rent, bills…: not tracked one by one, subtracted from what is left each month. */
  fixedCosts: Cents;
};

export type Ledger = {
  entries: Entry[];
  recurring: Recurring[];
  goals: Goal[];
  settings: Settings;
};

export const EMPTY_LEDGER: Ledger = { entries: [], recurring: [], goals: [], settings: { monthlyBudget: 0, fixedCosts: 0 } };

export type Category = { id: string; label: string; emoji: string };

export const CATEGORIES: Record<Kind, Category[]> = {
  expense: [
    { id: "resto", label: "Bouffe & resto", emoji: "🍔" },
    { id: "sorties", label: "Sorties", emoji: "🍻" },
    { id: "shopping", label: "Shopping", emoji: "🛍️" },
    { id: "jeux", label: "Jeux & loisirs", emoji: "🎮" },
    { id: "tech", label: "Tech", emoji: "💻" },
    { id: "abonnements", label: "Abonnements", emoji: "📺" },
    { id: "voyages", label: "Voyages", emoji: "✈️" },
    { id: "cadeaux", label: "Cadeaux", emoji: "🎁" },
    { id: "autre", label: "Autre", emoji: "🌀" },
  ],
  income: [
    { id: "salaire", label: "Salaire", emoji: "💼" },
    { id: "freelance", label: "Freelance", emoji: "🧑‍💻" },
    { id: "revente", label: "Revente", emoji: "🏷️" },
    { id: "cadeau", label: "Cadeau", emoji: "🎁" },
    { id: "remboursement", label: "Remboursement", emoji: "↩️" },
    { id: "autre", label: "Autre", emoji: "✨" },
  ],
};

export function getCategory(kind: Kind, id: string): Category {
  const list = CATEGORIES[kind];
  return list.find((c) => c.id === id) ?? list[list.length - 1];
}

// --- Amounts ---

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurosRound = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** 123456 -> "1 234,56 €". `round` drops the cents (for big headline numbers). */
export const formatMoney = (cents: Cents, round = false) => (round ? eurosRound : euros).format(cents / 100);

/** Same with an explicit sign: "+12 €" / "−12 €". */
export const formatSigned = (cents: Cents, round = false) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatMoney(Math.abs(cents), round)}`;

/** Max amount of one entry or goal: 10 M€. */
export const MAX_AMOUNT: Cents = 1_000_000_000;

/** "12", "12,5", "1 234.56 €" -> cents. Undefined when not a positive amount. */
export function parseAmount(input: string): Cents | undefined {
  const cleaned = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > 0 && cents <= MAX_AMOUNT ? cents : undefined;
}

/** Same as parseAmount, but 0 and empty are allowed (settings). */
export function parseOptionalAmount(input: string): Cents | undefined {
  return input.trim() === "" || /^0+([.,]0*)?$/.test(input.trim()) ? 0 : parseAmount(input);
}

/** Cents -> value for an <input> ("12,50"), empty for 0. */
export const amountInput = (cents: Cents) => (cents ? (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");

// --- Dates ---

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Local date as YYYY-MM-DD. */
export const toDateString = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return toDateString(date).slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function isValidDate(date: string): boolean {
  return DATE_PATTERN.test(date) && Number(date.slice(8)) <= daysInMonth(monthOf(date));
}

const monthNames = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/** "2026-10" -> "octobre". */
export const monthName = (month: string) => monthNames.format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));
/** "2026-10" -> "oct.". */
export const monthShortName = (month: string) => monthShort.format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));

const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });

/** "2026-10-27" -> { day: "27", weekday: "mar." }. */
export function dayParts(date: string) {
  const local = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8)));
  return { day: date.slice(8).replace(/^0/, ""), weekday: weekdayShort.format(local) };
}

// --- Stats ---

export type CategoryTotal = { category: Category; total: Cents; count: number };

export type MonthStats = {
  month: string;
  entries: Entry[];
  income: Cents;
  spent: Cents;
  regret: Cents;
  fixedCosts: Cents;
  /** income - fixed costs - spent. */
  left: Cents;
  /** Share of the income left at the end, null without income. */
  savingsRate: number | null;
  budget: Cents;
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  /** Cumulative spending at the end of each day (index 0 = day 1). */
  cumulative: Cents[];
  /** Biggest single expense. */
  biggest?: Entry;
};

function totals(entries: Entry[], kind: Kind): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const category = getCategory(kind, entry.category);
    const current = map.get(category.id) ?? { category, total: 0, count: 0 };
    map.set(category.id, { ...current, total: current.total + entry.amount, count: current.count + 1 });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const sum = (entries: Entry[], kind: Kind) => entries.reduce((n, e) => (e.kind === kind ? n + e.amount : n), 0);

/** Newest first, then most recently added first. */
export const byDateDesc = (a: Entry, b: Entry) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function monthStats(ledger: Ledger, month: string): MonthStats {
  const entries = ledger.entries.filter((e) => monthOf(e.date) === month).sort(byDateDesc);
  const income = sum(entries, "income");
  const spent = sum(entries, "expense");
  // Fixed costs only count for months with activity: an empty month stays at zero.
  const fixedCosts = entries.length ? ledger.settings.fixedCosts : 0;
  const left = income - fixedCosts - spent;

  const perDay = Array.from({ length: daysInMonth(month) }, () => 0);
  for (const e of entries) if (e.kind === "expense") perDay[Number(e.date.slice(8)) - 1] += e.amount;
  let running = 0;
  const cumulative = perDay.map((n) => (running += n));

  const expenses = entries.filter((e) => e.kind === "expense");
  return {
    month,
    entries,
    income,
    spent,
    regret: expenses.reduce((n, e) => (e.regret ? n + e.amount : n), 0),
    fixedCosts,
    left,
    savingsRate: income > 0 ? left / income : null,
    budget: ledger.settings.monthlyBudget,
    byCategory: totals(entries, "expense"),
    incomeByCategory: totals(entries, "income"),
    cumulative,
    biggest: expenses.reduce<Entry | undefined>((best, e) => (!best || e.amount > best.amount ? e : best), undefined),
  };
}

export type YearStats = {
  year: number;
  months: MonthStats[];
  income: Cents;
  spent: Cents;
  regret: Cents;
  left: Cents;
  byCategory: CategoryTotal[];
  /** Running total of `left`, month after month. */
  cumulativeLeft: Cents[];
};

export function yearStats(ledger: Ledger, year: number): YearStats {
  const months = Array.from({ length: 12 }, (_, i) => monthStats(ledger, `${year}-${String(i + 1).padStart(2, "0")}`));
  let running = 0;
  return {
    year,
    months,
    income: months.reduce((n, m) => n + m.income, 0),
    spent: months.reduce((n, m) => n + m.spent, 0),
    regret: months.reduce((n, m) => n + m.regret, 0),
    left: months.reduce((n, m) => n + m.left, 0),
    byCategory: totals(ledger.entries.filter((e) => e.date.startsWith(`${year}-`)), "expense"),
    cumulativeLeft: months.map((m) => (running += m.left)),
  };
}

/** Recurring templates not added yet to the month. */
export const pendingRecurring = (ledger: Ledger, month: string) =>
  ledger.recurring.filter((r) => !ledger.entries.some((e) => e.recurringId === r.id && monthOf(e.date) === month));

/** All-time money left (income - fixed costs - spending), minus what sits in the goals. */
export function freeMoney(ledger: Ledger): Cents {
  const months = new Set(ledger.entries.map((e) => monthOf(e.date)));
  const total = ledger.entries.reduce((n, e) => n + (e.kind === "income" ? e.amount : -e.amount), 0);
  return total - months.size * ledger.settings.fixedCosts - ledger.goals.reduce((n, g) => n + g.saved, 0);
}

/** Cheeky one-liner on the budget gauge. */
export function budgetMood(spent: Cents, budget: Cents): string {
  if (!budget) return "Pas de budget fixé. Freestyle total.";
  const ratio = spent / budget;
  if (ratio === 0) return "Zéro dépense. Moine bouddhiste.";
  if (ratio < 0.5) return "Tranquille. Tout roule.";
  if (ratio < 0.8) return "Ça commence à chauffer.";
  if (ratio <= 1) return "Frein à main. Maintenant.";
  return "Budget explosé. Respire.";
}
