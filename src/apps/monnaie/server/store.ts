import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { appDataDir } from "@/lib/storage";
import {
  CATEGORIES,
  EMPTY_LEDGER,
  isValidDate,
  MAX_AMOUNT,
  type Entry,
  type Goal,
  type Kind,
  type Ledger,
  type Recurring,
  type Settings,
} from "../money";

export const SLUG = "monnaie";
const file = () => appDataDir(SLUG, "ledger.json");

/** Invalid input; its message is safe to show to the user / API client. */
export class LedgerError extends Error {}

export async function readLedger(): Promise<Ledger> {
  try {
    const data = JSON.parse(await fs.readFile(file(), "utf8")) as Partial<Ledger>;
    return {
      entries: data.entries ?? [],
      recurring: data.recurring ?? [],
      goals: data.goals ?? [],
      // Only known settings: older files also had a single "fixedCosts" amount, now real "charge" entries.
      settings: {
        monthlyBudget: data.settings?.monthlyBudget ?? EMPTY_LEDGER.settings.monthlyBudget,
        savingsStart: data.settings?.savingsStart ?? EMPTY_LEDGER.settings.savingsStart,
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_LEDGER);
    throw error;
  }
}

// Every change reads, edits and rewrites the whole file: changes run one after the other, so two
// saves can't overwrite each other, and the file is replaced atomically (never half written).
let queue: Promise<unknown> = Promise.resolve();
function update<T>(change: (ledger: Ledger) => T): Promise<T> {
  const run = queue.catch(() => {}).then(async () => {
    const ledger = await readLedger();
    const result = change(ledger);
    await fs.mkdir(appDataDir(SLUG), { recursive: true });
    const tmp = `${file()}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(ledger, null, 2));
    await fs.rename(tmp, file());
    return result;
  });
  queue = run;
  return run;
}

// --- Validation of untrusted input (forms and API) ---

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function checkKind(value: unknown): Kind {
  if (typeof value !== "string" || !Object.hasOwn(CATEGORIES, value)) throw new LedgerError("Type invalide (income, expense, charge, savings ou debt).");
  return value as Kind;
}

function checkAmount(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0 || value > MAX_AMOUNT) {
    throw new LedgerError("Montant invalide.");
  }
  return value;
}

function checkCategory(kind: Kind, value: unknown): string {
  if (typeof value !== "string" || !CATEGORIES[kind].some((c) => c.id === value)) throw new LedgerError("Catégorie inconnue.");
  return value;
}

function checkLabel(value: unknown): string {
  const label = text(value, 80);
  if (!label) throw new LedgerError("Donne un nom à la ligne.");
  return label;
}

export type EntryInput = { kind: unknown; amount: unknown; label: unknown; category: unknown; date: unknown; note?: unknown; regret?: unknown; person?: unknown };

function checkEntry(input: EntryInput) {
  const kind = checkKind(input.kind);
  if (typeof input.date !== "string" || !isValidDate(input.date)) throw new LedgerError("Date invalide (AAAA-MM-JJ).");
  const person = kind === "debt" ? text(input.person, 60) : "";
  if (kind === "debt" && !person) throw new LedgerError("Avec qui ? Donne un prénom.");
  return {
    kind,
    amount: checkAmount(input.amount),
    label: checkLabel(input.label),
    category: checkCategory(kind, input.category),
    date: input.date,
    note: text(input.note, 500),
    regret: kind === "expense" && input.regret === true,
    person: person || undefined,
  };
}

// --- Entries ---

export function addEntry(input: EntryInput): Promise<Entry> {
  const checked = checkEntry(input);
  return update((ledger) => {
    const entry: Entry = { id: randomUUID(), ...checked, createdAt: new Date().toISOString() };
    ledger.entries.push(entry);
    return entry;
  });
}

export function editEntry(id: string, input: EntryInput): Promise<Entry> {
  const checked = checkEntry(input);
  return update((ledger) => {
    const entry = ledger.entries.find((e) => e.id === id);
    if (!entry) throw new LedgerError("Ligne introuvable.");
    Object.assign(entry, checked);
    return entry;
  });
}

export function toggleRegret(id: string): Promise<void> {
  return update((ledger) => {
    const entry = ledger.entries.find((e) => e.id === id);
    if (entry?.kind === "expense") entry.regret = !entry.regret;
  });
}

/** Returns false when the entry did not exist. */
export function deleteEntry(id: string): Promise<boolean> {
  return update((ledger) => {
    const before = ledger.entries.length;
    ledger.entries = ledger.entries.filter((e) => e.id !== id);
    return ledger.entries.length < before;
  });
}

// --- Recurring templates ---

export function addRecurring(input: { kind: unknown; amount: unknown; label: unknown; category: unknown; day: unknown }): Promise<Recurring> {
  const kind = checkKind(input.kind);
  if (kind === "debt") throw new LedgerError("Une dette ne peut pas être récurrente.");
  const day = input.day;
  if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 28) throw new LedgerError("Jour invalide (1 à 28).");
  const recurring: Recurring = {
    id: randomUUID(),
    kind,
    amount: checkAmount(input.amount),
    label: checkLabel(input.label),
    category: checkCategory(kind, input.category),
    day,
  };
  return update((ledger) => {
    ledger.recurring.push(recurring);
    return recurring;
  });
}

export function deleteRecurring(id: string): Promise<void> {
  return update((ledger) => {
    ledger.recurring = ledger.recurring.filter((r) => r.id !== id);
  });
}

/** Adds the recurring templates missing from the month. Returns how many were added. */
export function applyRecurring(month: string): Promise<number> {
  return update((ledger) => {
    const now = new Date().toISOString();
    let added = 0;
    for (const r of ledger.recurring) {
      if (ledger.entries.some((e) => e.recurringId === r.id && e.date.startsWith(month))) continue;
      ledger.entries.push({
        id: randomUUID(),
        kind: r.kind,
        amount: r.amount,
        label: r.label,
        category: r.category,
        date: `${month}-${String(r.day).padStart(2, "0")}`,
        note: "",
        regret: false,
        recurringId: r.id,
        createdAt: now,
      });
      added++;
    }
    return added;
  });
}

// --- Goals ---

export function addGoal(input: { name: unknown; emoji: unknown; target: unknown }): Promise<Goal> {
  const name = text(input.name, 60);
  if (!name) throw new LedgerError("Donne un nom à l'objectif.");
  const goal: Goal = {
    id: randomUUID(),
    name,
    emoji: [...text(input.emoji, 16)].slice(0, 2).join("") || "🎯",
    target: checkAmount(input.target),
    saved: 0,
    createdAt: new Date().toISOString(),
  };
  return update((ledger) => {
    ledger.goals.push(goal);
    return goal;
  });
}

/** Puts money in (positive) or takes it out (negative). The saved amount never goes below 0. */
export function moveGoalMoney(id: string, delta: number): Promise<Goal> {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_AMOUNT) throw new LedgerError("Montant invalide.");
  return update((ledger) => {
    const goal = ledger.goals.find((g) => g.id === id);
    if (!goal) throw new LedgerError("Objectif introuvable.");
    goal.saved = Math.min(MAX_AMOUNT, Math.max(0, goal.saved + delta));
    return goal;
  });
}

export function deleteGoal(id: string): Promise<void> {
  return update((ledger) => {
    ledger.goals = ledger.goals.filter((g) => g.id !== id);
  });
}

// --- Settings ---

export function saveSettings(settings: Settings): Promise<void> {
  for (const value of Object.values(settings)) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_AMOUNT) throw new LedgerError("Montant invalide.");
  }
  return update((ledger) => {
    ledger.settings = settings;
  });
}
