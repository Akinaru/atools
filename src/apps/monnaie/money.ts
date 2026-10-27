// Domain of the app: data types, categories, amounts and the stats computed from the ledger.
// Pure functions only (no I/O), shared by the UI, the Server Actions and the API.

/** Amounts are integers in cents, never floats. */
export type Cents = number;

/**
 * income: money in · expense: unnecessary spending (the budget) · charge: necessary bills (rent, energy…)
 * savings: transfer between the current account and the savings account (category "depot" or "retrait")
 * debt: money owed between me and a `person` (categories below).
 */
export type Kind = "income" | "expense" | "charge" | "savings" | "debt";

export const KIND_LABELS: Record<Kind, string> = { income: "Revenu", expense: "Dépense plaisir", charge: "Charge", savings: "Livret", debt: "Dette" };

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
  /** Debt only: who I owe, or who owes me. */
  person?: string;
  createdAt: string;
};

/** Template added in one click each month (salary, rent, subscriptions…). */
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
  /** Savings account balance before the first transfer tracked here. */
  savingsStart: Cents;
};

export type Ledger = {
  entries: Entry[];
  recurring: Recurring[];
  goals: Goal[];
  settings: Settings;
};

export const EMPTY_LEDGER: Ledger = { entries: [], recurring: [], goals: [], settings: { monthlyBudget: 0, savingsStart: 0 } };

export type Category = { id: string; label: string; emoji: string };

export const CATEGORIES: Record<Kind, Category[]> = {
  expense: [
    { id: "resto", label: "Restau & fast-food", emoji: "🍔" },
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
    { id: "remboursement", label: "Remboursement (sécu, achat…)", emoji: "↩️" },
    { id: "autre", label: "Autre", emoji: "✨" },
  ],
  charge: [
    { id: "loyer", label: "Loyer", emoji: "🏠" },
    { id: "electricite", label: "Électricité", emoji: "⚡" },
    { id: "gaz", label: "Gaz", emoji: "🔥" },
    { id: "eau", label: "Eau", emoji: "💧" },
    { id: "assurances", label: "Assurances", emoji: "🛡️" },
    { id: "internet", label: "Internet & mobile", emoji: "📶" },
    { id: "transport", label: "Transport", emoji: "🚇" },
    { id: "essence", label: "Essence", emoji: "⛽" },
    { id: "courses", label: "Courses (supermarché)", emoji: "🛒" },
    { id: "sante", label: "Santé", emoji: "💊" },
    { id: "impots", label: "Impôts", emoji: "🧾" },
    { id: "autre", label: "Autre", emoji: "📎" },
  ],
  savings: [
    { id: "depot", label: "Vers le livret", emoji: "🐷" },
    { id: "retrait", label: "Depuis le livret", emoji: "🔓" },
  ],
  // dette: someone paid or lent for me (no money on my account yet) · rembourse: I pay them back.
  // pret: I paid or lent for someone · recu: they pay me back.
  debt: [
    { id: "dette", label: "Je dois", emoji: "🫠" },
    { id: "rembourse", label: "Je rembourse", emoji: "🤝" },
    { id: "pret", label: "J'avance pour quelqu'un", emoji: "🫴" },
    { id: "recu", label: "On me rembourse", emoji: "📥" },
  ],
};

type Movement = Pick<Entry, "kind" | "amount" | "category">;

/** Effect on the current account: money in is positive, money out negative, an IOU ("Je dois") 0. */
export function signedAmount(entry: Movement): Cents {
  if (entry.kind === "income") return entry.amount;
  if (entry.kind === "savings") return entry.category === "retrait" ? entry.amount : -entry.amount;
  if (entry.kind === "debt") return entry.category === "dette" ? 0 : entry.category === "recu" ? entry.amount : -entry.amount;
  return -entry.amount;
}

/** What is still owed, per person: `iOwe` (I owe them) and `owesMe` (they owe me), never below 0. */
export type DebtBalance = { person: string; iOwe: Cents; owesMe: Cents };

export function debtBalances(entries: Entry[]): DebtBalance[] {
  const map = new Map<string, DebtBalance>();
  for (const e of entries) {
    if (e.kind !== "debt" || !e.person) continue;
    const key = e.person.toLowerCase();
    const b = map.get(key) ?? { person: e.person, iOwe: 0, owesMe: 0 };
    if (e.category === "dette") b.iOwe += e.amount;
    if (e.category === "rembourse") b.iOwe -= e.amount;
    if (e.category === "pret") b.owesMe += e.amount;
    if (e.category === "recu") b.owesMe -= e.amount;
    map.set(key, b);
  }
  return [...map.values()]
    .map((b) => ({ ...b, iOwe: Math.max(b.iOwe, 0), owesMe: Math.max(b.owesMe, 0) }))
    .sort((a, b) => b.iOwe + b.owesMe - (a.iOwe + a.owesMe));
}

/** Effect on the savings account: a deposit is positive, a withdrawal negative, anything else 0. */
export const savingsDelta = (entry: Movement) => (entry.kind !== "savings" ? 0 : entry.category === "retrait" ? -entry.amount : entry.amount);

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
  charges: Cents;
  /** Net transfers to the savings account (deposits - withdrawals). */
  saved: Cents;
  /** Savings account balance at the end of the month. */
  savingsBalance: Cents;
  /** Effect of debts on the current account (repaid, advanced, received back). */
  debtFlow: Cents;
  /** Left on the current account: income - charges - spent - saved + debtFlow. */
  left: Cents;
  /** Share of the income put on the savings account, null without income. */
  savingsRate: number | null;
  budget: Cents;
  byCategory: CategoryTotal[];
  incomeByCategory: CategoryTotal[];
  chargesByCategory: CategoryTotal[];
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
  const charges = sum(entries, "charge");
  const saved = entries.reduce((n, e) => n + savingsDelta(e), 0);
  const debtFlow = entries.reduce((n, e) => (e.kind === "debt" ? n + signedAmount(e) : n), 0);
  const left = income - charges - spent - saved + debtFlow;
  const savingsBalance =
    ledger.settings.savingsStart + ledger.entries.reduce((n, e) => (monthOf(e.date) <= month ? n + savingsDelta(e) : n), 0);

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
    charges,
    saved,
    savingsBalance,
    debtFlow,
    left,
    savingsRate: income > 0 ? saved / income : null,
    budget: ledger.settings.monthlyBudget,
    byCategory: totals(entries, "expense"),
    incomeByCategory: totals(entries, "income"),
    chargesByCategory: totals(entries, "charge"),
    cumulative,
    biggest: expenses.reduce<Entry | undefined>((best, e) => (!best || e.amount > best.amount ? e : best), undefined),
  };
}

export type YearStats = {
  year: number;
  months: MonthStats[];
  income: Cents;
  spent: Cents;
  charges: Cents;
  saved: Cents;
  regret: Cents;
  left: Cents;
  byCategory: CategoryTotal[];
  chargesByCategory: CategoryTotal[];
};

export function yearStats(ledger: Ledger, year: number): YearStats {
  const months = Array.from({ length: 12 }, (_, i) => monthStats(ledger, `${year}-${String(i + 1).padStart(2, "0")}`));
  return {
    year,
    months,
    income: months.reduce((n, m) => n + m.income, 0),
    spent: months.reduce((n, m) => n + m.spent, 0),
    charges: months.reduce((n, m) => n + m.charges, 0),
    saved: months.reduce((n, m) => n + m.saved, 0),
    regret: months.reduce((n, m) => n + m.regret, 0),
    left: months.reduce((n, m) => n + m.left, 0),
    byCategory: totals(ledger.entries.filter((e) => e.date.startsWith(`${year}-`)), "expense"),
    chargesByCategory: totals(ledger.entries.filter((e) => e.date.startsWith(`${year}-`)), "charge"),
  };
}

/** Recurring templates not added yet to the month. */
export const pendingRecurring = (ledger: Ledger, month: string) =>
  ledger.recurring.filter((r) => !ledger.entries.some((e) => e.recurringId === r.id && monthOf(e.date) === month));

/** Savings account balance today. */
export const savingsBalance = (ledger: Ledger): Cents => ledger.settings.savingsStart + ledger.entries.reduce((n, e) => n + savingsDelta(e), 0);

/** Savings account money not assigned to a goal yet (negative when the goals ask for more than the livret holds). */
export const freeMoney = (ledger: Ledger): Cents => savingsBalance(ledger) - ledger.goals.reduce((n, g) => n + g.saved, 0);

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
