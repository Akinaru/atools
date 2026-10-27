// Domain of the app: data types, categories, amounts and the stats computed from the ledger.
// Pure functions only (no I/O), shared by the UI, the Server Actions and the API.

/** Amounts are integers in cents, never floats. */
export type Cents = number;

/**
 * income: money in · expense: unnecessary spending (the budget) · charge: necessary bills (rent, energy…)
 * savings: a savings account (livret) moving: transfer with the current account ("depot" / "retrait") or
 * interest it earned ("interets", the current account does not move)
 * debt: money owed between me and a `person` (categories below).
 * transfer: money moved between two of my current accounts (`account` to `to`): neither spent nor earned.
 * Every line but a transfer happens on one current account, `account` (absent = the main one, MAIN_ACCOUNT).
 */
export type Kind = "income" | "expense" | "charge" | "savings" | "debt" | "transfer";

export const KIND_LABELS: Record<Kind, string> = {
  income: "Revenu",
  expense: "Dépense plaisir",
  charge: "Charge",
  savings: "Épargne",
  debt: "Dette",
  transfer: "Virement interne",
};

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
  /** The current account the money moved on (CurrentAccount id); absent = the main one. Transfer: where it left. */
  account?: string;
  /** Transfer only: the current account it went to. */
  to?: string;
  /** Savings only: the livret (SavingsAccount id); absent = not attributed yet. */
  livret?: string;
  /** Set when imported from the current-account export: identifies the bank operation, so it is never imported twice. */
  importId?: string;
  /** Set when matched with (or imported from) the other account's own export (livret, Revolut…): its operation id. */
  pocketImportId?: string;
  /** Imported only: the day the bank booked it (YYYY-MM-DD), often 1 to 4 days after `date`. The balance follows it. */
  bookedDate?: string;
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

/** A livret (Livret A, Livret Jeune…): its balance is the sum of its savings lines. */
export type SavingsAccount = { id: string; name: string; emoji: string };

/**
 * A current account besides the main one (Revolut, Crédit Mutuel…). Its balance is the sum of its lines (its
 * history is imported from the start). Not `personal` (a business account): left out of the personal stats.
 */
export type CurrentAccount = { id: string; name: string; emoji: string; personal: boolean };

/** The main current account, where lines without `account` happen; its balance comes from the checkpoints. */
export const MAIN_ACCOUNT: CurrentAccount = { id: "courant", name: "Compte courant", emoji: "💳", personal: true };

/** The main account then the others. */
export const currentAccounts = (ledger: Pick<Ledger, "accounts">): CurrentAccount[] => [MAIN_ACCOUNT, ...ledger.accounts];

/** The account a line happens on (where a transfer leaves). */
export const accountOf = (entry: Pick<Entry, "account">) => entry.account ?? MAIN_ACCOUNT.id;

/** Real current-account balance read in the bank app at the end of a day; may be negative. */
export type Checkpoint = { id: string; date: string; balance: Cents; createdAt: string };

/** What a bank operation becomes on import, learned from the user's corrections. */
export type ImportRule = {
  /** Normalized bank label (see normalizeBankLabel), or a word it contains when `contains` is set. */
  match: string;
  contains?: boolean;
  /** Ignore the operation instead of importing it. */
  ignore?: boolean;
  kind?: Kind;
  category?: string;
  /** Label to use instead of the bank one. */
  label?: string;
  person?: string;
  /** Transfer rule: my other account the money goes to or comes from. */
  account?: string;
};

export type Ledger = {
  entries: Entry[];
  recurring: Recurring[];
  goals: Goal[];
  rules: ImportRule[];
  checkpoints: Checkpoint[];
  accounts: CurrentAccount[];
  savingsAccounts: SavingsAccount[];
  /** Categories created by the user, next to the built-in ones. */
  customCategories: CustomCategory[];
  /** Monthly budget per plaisir category id (cents); absent = no budget. */
  categoryBudgets: Record<string, Cents>;
  settings: Settings;
};

export const EMPTY_LEDGER: Ledger = {
  entries: [],
  recurring: [],
  goals: [],
  rules: [],
  checkpoints: [],
  accounts: [],
  savingsAccounts: [],
  customCategories: [],
  categoryBudgets: {},
  settings: { monthlyBudget: 0, savingsStart: 0 },
};

export type Category = { id: string; label: string; emoji: string };
export type CustomCategory = Category & { kind: Kind };
export type Categories = Record<Kind, Category[]>;

/** Kinds the user can add categories to (pockets and debts have fixed meanings). */
export const CUSTOMIZABLE_KINDS = ["expense", "charge", "income"] as const satisfies Kind[];

/** Built-in categories; use categoriesOf(ledger) to include the user's own. */
export const CATEGORIES: Categories = {
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
    { id: "aides", label: "Aides & allocations", emoji: "🏛️" },
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
    { id: "sport", label: "Salle de sport", emoji: "🏋️" },
    { id: "maison", label: "Maison & entretien", emoji: "🔧" },
    { id: "banque", label: "Banque", emoji: "🏦" },
    { id: "autre", label: "Autre", emoji: "📎" },
  ],
  savings: [
    { id: "depot", label: "Vers le livret", emoji: "🐷" },
    { id: "retrait", label: "Depuis le livret", emoji: "🔓" },
    { id: "interets", label: "Intérêts", emoji: "✨" },
  ],
  // dette: someone paid or lent for me (no money on my account yet) · rembourse: I pay them back.
  // pret: I paid or lent for someone · recu: they pay me back.
  debt: [
    { id: "dette", label: "Je dois", emoji: "🫠" },
    { id: "rembourse", label: "Je rembourse", emoji: "🤝" },
    { id: "pret", label: "J'avance pour quelqu'un", emoji: "🫴" },
    { id: "recu", label: "On me rembourse", emoji: "📥" },
  ],
  transfer: [{ id: "virement", label: "Entre mes comptes", emoji: "🔁" }],
};

type Movement = Pick<Entry, "kind" | "amount" | "category">;

/**
 * Effect on the line's current account: money in is positive, money out negative, an IOU ("Je dois") 0. A transfer
 * stays between my accounts: 0 (see accountFlow for each side).
 */
export function signedAmount(entry: Movement): Cents {
  if (entry.kind === "income") return entry.amount;
  if (entry.kind === "transfer") return 0;
  if (entry.kind === "savings") return entry.category === "retrait" ? entry.amount : entry.category === "depot" ? -entry.amount : 0;
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

/** Money moved from the current account to the livrets: a deposit is positive, a withdrawal negative, anything else 0. */
export const transferDelta = (entry: Movement) =>
  entry.kind !== "savings" ? 0 : entry.category === "depot" ? entry.amount : entry.category === "retrait" ? -entry.amount : 0;

/** Effect on the livret's balance: the transfers plus the interest it earned. */
export const savingsDelta = (entry: Movement) => transferDelta(entry) + (entry.kind === "savings" && entry.category === "interets" ? entry.amount : 0);

/** Effect of a line on one current account: a transfer takes from `account` and gives to `to`. */
export function accountFlow(entry: Movement & Pick<Entry, "account" | "to">, accountId: string): Cents {
  if (entry.kind === "transfer") return (entry.to === accountId ? entry.amount : 0) - (accountOf(entry) === accountId ? entry.amount : 0);
  return accountOf(entry) === accountId ? signedAmount(entry) : 0;
}

/** Names of the accounts and livrets, to label the lines. */
export type AccountNames = { accounts: CurrentAccount[]; livrets: SavingsAccount[] };

export const accountNamesOf = (ledger: Pick<Ledger, "accounts" | "savingsAccounts">): AccountNames => ({ accounts: currentAccounts(ledger), livrets: ledger.savingsAccounts });

/**
 * "Vers le livret · Livret A", "Revolut → Compte courant", "Courses · Revolut": the category of a line, with its
 * livret, the two accounts of a transfer, or its account when it is not the main one.
 */
export const lineCategoryLabel = (entry: Pick<Entry, "kind" | "category" | "account" | "to" | "livret">, categories: Categories, names: AccountNames) => {
  const name = (id: string | undefined) => names.accounts.find((a) => a.id === (id ?? MAIN_ACCOUNT.id))?.name ?? "?";
  if (entry.kind === "transfer") return `${name(entry.account)} → ${name(entry.to)}`;
  const label = getCategory(entry.kind, entry.category, categories).label;
  const parts = [label];
  const livret = entry.kind === "savings" && names.livrets.find((a) => a.id === entry.livret);
  if (livret) parts.push(livret.name);
  if (accountOf(entry) !== MAIN_ACCOUNT.id) parts.push(name(entry.account));
  return parts.join(" · ");
};

/** Balance of each savings account today; lines not attributed to a livret are under "". */
export function savingsAccountBalances(ledger: Pick<Ledger, "entries">): Map<string, Cents> {
  const balances = new Map<string, Cents>();
  for (const e of ledger.entries) if (e.kind === "savings") balances.set(e.livret ?? "", (balances.get(e.livret ?? "") ?? 0) + savingsDelta(e));
  return balances;
}

/** The lines of the personal accounts only (a business account is left out of the stats). */
export function personalLedger<T extends Pick<Ledger, "entries" | "accounts">>(ledger: T): T {
  const business = new Set(ledger.accounts.filter((a) => !a.personal).map((a) => a.id));
  if (!business.size) return ledger;
  return { ...ledger, entries: ledger.entries.filter((e) => !business.has(accountOf(e))) };
}


/** Built-in categories plus the user's, inserted before "Autre" (always last). */
export function categoriesOf(ledger: Pick<Ledger, "customCategories">): Categories {
  const result = structuredClone(CATEGORIES);
  for (const custom of ledger.customCategories) {
    const list = result[custom.kind];
    list.splice(list.length - 1, 0, { id: custom.id, label: custom.label, emoji: custom.emoji });
  }
  return result;
}

export function getCategory(kind: Kind, id: string, categories: Categories = CATEGORIES): Category {
  const list = categories[kind];
  return list.find((c) => c.id === id) ?? list[list.length - 1];
}

// --- Amounts ---

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 123456 -> "1 234,56 €". Always with the cents: amounts are never rounded. */
export const formatMoney = (cents: Cents) => euros.format(cents / 100);

/** Same with an explicit sign: "+12,00 €" / "−12,00 €". */
export const formatSigned = (cents: Cents) => `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${formatMoney(Math.abs(cents))}`;

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

const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** "2026-10-27" -> "mardi 27 octobre 2026". */
export const formatDay = (date: string) => longDay.format(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8))));

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
  /** Net transfers to the livrets (deposits - withdrawals), interest not included. */
  saved: Cents;
  /** Interest earned by the livrets this month. */
  interest: Cents;
  /** Savings account balance at the end of the month. */
  savingsBalance: Cents;
  /** Effect of debts on the current account (repaid, advanced, received back). */
  debtFlow: Cents;
  /** What was kept of the month's income, wherever it went: income - charges - spent + debtFlow. */
  kept: Cents;
  /** The part of `kept` left on the current account: kept - saved (not the account balance). */
  left: Cents;
  /** Real current-account balance at the end of the month, null without any balance checkpoint. */
  accountBalance: Cents | null;
  /** Share of the income put on the livret, null without income. */
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

function totals(entries: Entry[], kind: Kind, categories: Categories): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>();
  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    const category = getCategory(kind, entry.category, categories);
    const current = map.get(category.id) ?? { category, total: 0, count: 0 };
    map.set(category.id, { ...current, total: current.total + entry.amount, count: current.count + 1 });
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const sum = (entries: Entry[], kind: Kind) => entries.reduce((n, e) => (e.kind === kind ? n + e.amount : n), 0);

/** Newest first, then most recently added first. */
export const byDateDesc = (a: Entry, b: Entry) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

export function monthStats(ledger: Ledger, month: string): MonthStats {
  const categories = categoriesOf(ledger);
  const all = ledger.entries.filter((e) => monthOf(e.date) === month).sort(byDateDesc);
  // The totals are about my own money: the lines of a business account are listed, not counted.
  const entries = personalLedger({ ...ledger, entries: all }).entries;
  const income = sum(entries, "income");
  const spent = sum(entries, "expense");
  const charges = sum(entries, "charge");
  const saved = entries.reduce((n, e) => n + transferDelta(e), 0);
  const interest = entries.reduce((n, e) => n + savingsDelta(e) - transferDelta(e), 0);
  const debtFlow = entries.reduce((n, e) => (e.kind === "debt" ? n + signedAmount(e) : n), 0);
  const kept = income - charges - spent + debtFlow;
  const left = kept - saved;
  const upToMonth = ledger.entries.filter((e) => monthOf(e.date) <= month);
  const savingsBalance = ledger.settings.savingsStart + upToMonth.reduce((n, e) => n + savingsDelta(e), 0);
  const accountBalance = accountBalanceAt(ledger, `${month}-${String(daysInMonth(month)).padStart(2, "0")}`);

  const perDay = Array.from({ length: daysInMonth(month) }, () => 0);
  for (const e of entries) if (e.kind === "expense") perDay[Number(e.date.slice(8)) - 1] += e.amount;
  let running = 0;
  const cumulative = perDay.map((n) => (running += n));

  const expenses = entries.filter((e) => e.kind === "expense");
  return {
    month,
    entries: all,
    income,
    spent,
    regret: expenses.reduce((n, e) => (e.regret ? n + e.amount : n), 0),
    charges,
    saved,
    interest,
    savingsBalance,
    accountBalance,
    debtFlow,
    kept,
    left,
    savingsRate: income > 0 ? saved / income : null,
    budget: ledger.settings.monthlyBudget,
    byCategory: totals(entries, "expense", categories),
    incomeByCategory: totals(entries, "income", categories),
    chargesByCategory: totals(entries, "charge", categories),
    cumulative,
    biggest: expenses.reduce<Entry | undefined>((best, e) => (!best || e.amount > best.amount ? e : best), undefined),
  };
}

/** Day-by-day running totals of a month (index 0 = day 1), for the comparison chart. */
export type MonthDaily = { month: string; plaisir: Cents[]; charges: Cents[]; depenses: Cents[]; garde: Cents[] };

export function monthDaily(ledger: Ledger, month: string): MonthDaily {
  const days = daysInMonth(month);
  const plaisir = Array.from({ length: days }, () => 0);
  const charges = Array.from({ length: days }, () => 0);
  const garde = Array.from({ length: days }, () => 0);
  for (const e of personalLedger(ledger).entries) {
    if (monthOf(e.date) !== month) continue;
    const day = Number(e.date.slice(8)) - 1;
    if (e.kind === "expense") plaisir[day] += e.amount;
    if (e.kind === "charge") charges[day] += e.amount;
    // Kept = income - charges - plaisir ± debts (savings transfers move money, they do not spend it).
    if (e.kind !== "savings") garde[day] += signedAmount(e);
  }
  const running = (values: Cents[]) => {
    let total = 0;
    return values.map((v) => (total += v));
  };
  const p = running(plaisir);
  const c = running(charges);
  return { month, plaisir: p, charges: c, depenses: p.map((v, i) => v + c[i]), garde: running(garde) };
}

export type YearStats = {
  year: number;
  months: MonthStats[];
  income: Cents;
  spent: Cents;
  charges: Cents;
  saved: Cents;
  regret: Cents;
  kept: Cents;
  left: Cents;
  byCategory: CategoryTotal[];
  chargesByCategory: CategoryTotal[];
};

export function yearStats(ledger: Ledger, year: number): YearStats {
  const mine = personalLedger(ledger).entries.filter((e) => e.date.startsWith(`${year}-`));
  const months = Array.from({ length: 12 }, (_, i) => monthStats(ledger, `${year}-${String(i + 1).padStart(2, "0")}`));
  return {
    year,
    months,
    income: months.reduce((n, m) => n + m.income, 0),
    spent: months.reduce((n, m) => n + m.spent, 0),
    charges: months.reduce((n, m) => n + m.charges, 0),
    saved: months.reduce((n, m) => n + m.saved, 0),
    regret: months.reduce((n, m) => n + m.regret, 0),
    kept: months.reduce((n, m) => n + m.kept, 0),
    left: months.reduce((n, m) => n + m.left, 0),
    byCategory: totals(mine, "expense", categoriesOf(ledger)),
    chargesByCategory: totals(mine, "charge", categoriesOf(ledger)),
  };
}

/** Recurring templates not added yet to the month. */
export const pendingRecurring = (ledger: Ledger, month: string) =>
  ledger.recurring.filter((r) => !ledger.entries.some((e) => e.recurringId === r.id && monthOf(e.date) === month));

/** Savings account balance today. */
export const savingsBalance = (ledger: Ledger): Cents => ledger.settings.savingsStart + ledger.entries.reduce((n, e) => n + savingsDelta(e), 0);

/** The day an entry hits the account balance: the bank's booking day when known, else the payment day. */
const balanceDate = (e: Entry) => e.bookedDate ?? e.date;

/** Sum of the effects on the main current account of the entries booked in (from, to]. */
const flowBetween = (entries: Entry[], from: string, to: string) =>
  entries.reduce((n, e) => (balanceDate(e) > from && balanceDate(e) <= to ? n + accountFlow(e, MAIN_ACCOUNT.id) : n), 0);

/**
 * Main current-account balance at the end of `date`, from the closest checkpoint (the last one on or before `date`,
 * else the first one after): operations in between are added or taken back. Null without any checkpoint.
 */
export function accountBalanceAt(ledger: Ledger, date: string): Cents | null {
  const sorted = [...ledger.checkpoints].sort((a, b) => a.date.localeCompare(b.date));
  const anchor = sorted.findLast((c) => c.date <= date) ?? sorted[0];
  if (!anchor) return null;
  return anchor.date <= date ? anchor.balance + flowBetween(ledger.entries, anchor.date, date) : anchor.balance - flowBetween(ledger.entries, date, anchor.date);
}

/**
 * Each checkpoint compared with the previous one: the balance expected from the operations in between, and the gap
 * with the real balance (a missing or duplicated operation). The first checkpoint has nothing to compare with.
 */
export function checkpointChecks(ledger: Ledger): { checkpoint: Checkpoint; expected: Cents | null; gap: Cents | null }[] {
  const sorted = [...ledger.checkpoints].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((checkpoint, i) => {
    const previous = sorted[i - 1];
    if (!previous) return { checkpoint, expected: null, gap: null };
    const expected = previous.balance + flowBetween(ledger.entries, previous.date, checkpoint.date);
    return { checkpoint, expected, gap: checkpoint.balance - expected };
  });
}

/** Level of one account at the end of each month asked; null when unknown (no balance checkpoint, future). */
export type AccountLevels = { id: string; name: string; emoji: string; type: "courant" | "livret"; personal: boolean; values: (Cents | null)[] };

/**
 * The level of every account at the end of each month of `months` ("YYYY-MM", in order): the main current account
 * (from the balance checkpoints), the other current accounts (sum of their lines), each livret, and the savings
 * not attributed to a livret when there are some. Months after `today` are null.
 */
export function accountLevels(ledger: Ledger, months: string[], today: string): AccountLevels[] {
  const ends = months.map((m) => `${m}-${String(daysInMonth(m)).padStart(2, "0")}`);
  const known = (i: number) => months[i] <= monthOf(today);
  const savingsAt = (end: string, livret: string) =>
    ledger.entries.reduce((n, e) => (e.kind === "savings" && (e.livret ?? "") === livret && e.date <= end ? n + savingsDelta(e) : n), 0);
  const flowAt = (end: string, account: string) => ledger.entries.reduce((n, e) => (balanceDate(e) <= end ? n + accountFlow(e, account) : n), 0);
  const levels: AccountLevels[] = [
    { ...MAIN_ACCOUNT, type: "courant", values: ends.map((end, i) => (known(i) ? accountBalanceAt(ledger, end > today ? today : end) : null)) },
    ...ledger.accounts.map((a) => ({ ...a, type: "courant" as const, values: ends.map((end, i) => (known(i) ? flowAt(end, a.id) : null)) })),
    ...ledger.savingsAccounts.map((a) => ({ ...a, type: "livret" as const, personal: true, values: ends.map((end, i) => (known(i) ? savingsAt(end, a.id) : null)) })),
  ];
  const loose = ends.map((end, i) => (known(i) ? ledger.settings.savingsStart + savingsAt(end, "") : null));
  if (loose.some((v) => v)) levels.push({ id: "", name: "Épargne sans livret", emoji: "🪙", type: "livret", personal: true, values: loose });
  return levels;
}

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
