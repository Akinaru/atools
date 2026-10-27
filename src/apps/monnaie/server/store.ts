import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { appDataDir } from "@/lib/storage";
import { normalizeBankLabel } from "../import/suggest";
import {
  CATEGORIES,
  categoriesOf,
  CUSTOMIZABLE_KINDS,
  EMPTY_LEDGER,
  isValidDate,
  MAX_AMOUNT,
  type Entry,
  type Categories,
  type Checkpoint,
  type CustomCategory,
  type Goal,
  type ImportRule,
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
      // Older lines were saved as typed: shown in capitals too, and rewritten so at the next save.
      entries: (data.entries ?? []).map((e) => ({ ...e, label: toLabel(e.label) })),
      recurring: (data.recurring ?? []).map((r) => ({ ...r, label: toLabel(r.label) })),
      goals: data.goals ?? [],
      rules: data.rules ?? [],
      checkpoints: data.checkpoints ?? [],
      customCategories: data.customCategories ?? [],
      categoryBudgets: data.categoryBudgets ?? {},
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

/** `categories` must include the user's own: validate inside `update`, with categoriesOf(ledger). */
function checkCategory(kind: Kind, value: unknown, categories: Categories): string {
  if (typeof value !== "string" || !categories[kind].some((c) => c.id === value)) throw new LedgerError("Catégorie inconnue.");
  return value;
}

/** Labels are always stored in capitals, so they read the same everywhere. */
const toLabel = (value: string) => value.toLocaleUpperCase("fr-FR");

function checkLabel(value: unknown): string {
  const label = toLabel(text(value, 80));
  if (!label) throw new LedgerError("Donne un nom à la ligne.");
  return label;
}

export type EntryInput = { kind: unknown; amount: unknown; label: unknown; category: unknown; date: unknown; note?: unknown; regret?: unknown; person?: unknown };

function checkEntry(input: EntryInput, categories: Categories) {
  const kind = checkKind(input.kind);
  if (typeof input.date !== "string" || !isValidDate(input.date)) throw new LedgerError("Date invalide (AAAA-MM-JJ).");
  const person = kind === "debt" ? text(input.person, 60) : "";
  if (kind === "debt" && !person) throw new LedgerError("Avec qui ? Donne un prénom.");
  return {
    kind,
    amount: checkAmount(input.amount),
    label: checkLabel(input.label),
    category: checkCategory(kind, input.category, categories),
    date: input.date,
    note: text(input.note, 500),
    regret: kind === "expense" && input.regret === true,
    person: person || undefined,
  };
}

// --- Entries ---

export function addEntry(input: EntryInput): Promise<Entry> {
  return update((ledger) => {
    const checked = checkEntry(input, categoriesOf(ledger));
    const entry: Entry = { id: randomUUID(), ...checked, createdAt: new Date().toISOString() };
    ledger.entries.push(entry);
    return entry;
  });
}

export function editEntry(id: string, input: EntryInput): Promise<Entry> {
  return update((ledger) => {
    const checked = checkEntry(input, categoriesOf(ledger));
    const entry = ledger.entries.find((e) => e.id === id);
    if (!entry) throw new LedgerError("Ligne introuvable.");
    // A date changed by hand no longer matches the bank's booking day.
    if (checked.date !== entry.date) delete entry.bookedDate;
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
  const amount = checkAmount(input.amount);
  const label = checkLabel(input.label);
  return update((ledger) => {
    const recurring: Recurring = { id: randomUUID(), kind, amount, label, category: checkCategory(kind, input.category, categoriesOf(ledger)), day };
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

// --- Bank import ---

const IMPORT_ID = /^[a-z]{2,8}:[0-9a-f]{24}$/;

/** One reviewed bank operation, as sent back by the import screen (untrusted). */
export type ImportRow = EntryInput & {
  importId: unknown;
  /** Day the bank booked it (YYYY-MM-DD). */
  bookedDate?: unknown;
  ignore?: unknown;
  /** Learn a rule from this row for the next imports. */
  remember?: unknown;
  /** Normalized bank label the rule matches. */
  match?: unknown;
};

/**
 * Adds the reviewed operations that are not imported yet (same importId) and saves the rules to remember.
 * Validates every row like a hand-typed entry; nothing is written if one row is invalid.
 */
export function importOperations(rows: ImportRow[]): Promise<{ added: number; skipped: number; rules: number }> {
  const now = new Date().toISOString();
  return update((ledger) => {
    const categories = categoriesOf(ledger);
    const checked = rows.map((row, i) => {
      if (typeof row.importId !== "string" || !IMPORT_ID.test(row.importId)) throw new LedgerError(`Ligne ${i + 1} : identifiant d'import invalide.`);
      const rule = row.remember === true && typeof row.match === "string" && row.match.trim() ? row.match.trim().slice(0, 120) : undefined;
      if (row.ignore === true) return { importId: row.importId, ignore: true as const, rule: rule ? { match: rule, ignore: true } : undefined };
      try {
        const entry = checkEntry(row, categories);
        const learned: ImportRule | undefined = rule
          ? { match: rule, kind: entry.kind, category: entry.category, label: entry.label, person: entry.person }
          : undefined;
        const bookedDate = typeof row.bookedDate === "string" && isValidDate(row.bookedDate) ? row.bookedDate : undefined;
        return { importId: row.importId, ignore: false as const, entry, bookedDate, rule: learned };
      } catch (error) {
        if (error instanceof LedgerError) throw new LedgerError(`Ligne ${i + 1} : ${error.message}`);
        throw error;
      }
    });

    const known = new Set(ledger.entries.map((e) => e.importId).filter(Boolean));
    let added = 0;
    let skipped = 0;
    for (const row of checked) {
      if (row.ignore) continue;
      if (known.has(row.importId)) {
        skipped++;
        continue;
      }
      known.add(row.importId);
      ledger.entries.push({ id: randomUUID(), ...row.entry, importId: row.importId, bookedDate: row.bookedDate, createdAt: now });
      added++;
    }
    const rules = checked.flatMap((row) => (row.rule ? [row.rule] : []));
    for (const rule of rules) ledger.rules = [...ledger.rules.filter((r) => r.match !== rule.match), rule];
    return { added, skipped, rules: rules.length };
  });
}

export function deleteRule(match: string): Promise<void> {
  return update((ledger) => {
    ledger.rules = ledger.rules.filter((r) => r.match !== match);
  });
}

// --- Backup / restore (moving the data from one install to another) ---

/**
 * Replaces the whole ledger with a backup file. The current file is kept next to it first
 * (ledger.before-restore-<date>.json), so a wrong restore can be undone by hand.
 */
export function restoreLedger(raw: string): Promise<number> {
  let data: Partial<Ledger>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new LedgerError("Fichier de sauvegarde illisible (JSON attendu).");
  }
  if (typeof data !== "object" || data === null || !Array.isArray(data.entries)) {
    throw new LedgerError("Ce n'est pas une sauvegarde Monnaie (lignes manquantes).");
  }
  const entries = data.entries;
  return update((ledger) => {
    const previous = structuredClone(ledger);
    Object.assign(ledger, structuredClone(EMPTY_LEDGER), data);
    return previous;
  }).then(async (previous) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(appDataDir(SLUG, `ledger.before-restore-${stamp}.json`), JSON.stringify(previous, null, 2));
    return entries.length;
  });
}

// --- Balance checkpoints ---

/** Records the real balance read in the bank app at the end of a day (one per day: a new one replaces it). */
export function addCheckpoint(date: unknown, balance: unknown): Promise<Checkpoint> {
  if (typeof date !== "string" || !isValidDate(date)) throw new LedgerError("Date invalide.");
  if (typeof balance !== "number" || !Number.isInteger(balance) || Math.abs(balance) > MAX_AMOUNT) throw new LedgerError("Solde invalide.");
  const checkpoint: Checkpoint = { id: randomUUID(), date, balance, createdAt: new Date().toISOString() };
  return update((ledger) => {
    ledger.checkpoints = [...ledger.checkpoints.filter((c) => c.date !== date), checkpoint];
    return checkpoint;
  });
}

export function deleteCheckpoint(id: string): Promise<void> {
  return update((ledger) => {
    ledger.checkpoints = ledger.checkpoints.filter((c) => c.id !== id);
  });
}

// --- Custom categories ---

export type CustomCategoryInput = { kind: unknown; label: unknown; emoji: unknown; keywords?: unknown };

/**
 * Creates a category. Each keyword ("CONTABO", "OVH") moves the existing lines whose label contains it into the new
 * category, and becomes an import rule so the next bank imports land there too. Returns how many lines moved.
 */
export function addCustomCategory(input: CustomCategoryInput): Promise<{ category: CustomCategory; moved: number }> {
  const kind = checkKind(input.kind);
  if (!(CUSTOMIZABLE_KINDS as readonly Kind[]).includes(kind)) throw new LedgerError("Catégorie possible pour : plaisir, charge ou revenu.");
  const label = text(input.label, 30);
  if (!label) throw new LedgerError("Donne un nom à la catégorie.");
  const emoji = [...text(input.emoji, 16)].slice(0, 2).join("") || "🏷️";
  const keywords = [...new Set(text(input.keywords, 300).split(",").map((k) => normalizeBankLabel(k)).filter((k) => k.length >= 2))].slice(0, 10);

  return update((ledger) => {
    if (categoriesOf(ledger)[kind].some((c) => c.label.toLowerCase() === label.toLowerCase())) throw new LedgerError("Cette catégorie existe déjà.");
    const slug = label.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 30) || "cat";
    const category: CustomCategory = { id: `c-${slug}-${randomUUID().slice(0, 4)}`, kind, label, emoji };
    ledger.customCategories.push(category);

    let moved = 0;
    for (const entry of ledger.entries) {
      if (!(CUSTOMIZABLE_KINDS as readonly Kind[]).includes(entry.kind)) continue;
      const entryLabel = normalizeBankLabel(entry.label);
      if (!keywords.some((k) => entryLabel.includes(k))) continue;
      entry.kind = kind;
      entry.category = category.id;
      if (kind !== "expense") entry.regret = false;
      moved++;
    }
    for (const keyword of keywords) {
      ledger.rules = [...ledger.rules.filter((r) => r.match !== keyword), { match: keyword, contains: true, kind, category: category.id }];
    }
    return { category, moved };
  });
}

/** Deletes a category: its lines and recurring templates go back to "Autre", its import rules are removed. */
export function deleteCustomCategory(id: string): Promise<void> {
  return update((ledger) => {
    const category = ledger.customCategories.find((c) => c.id === id);
    if (!category) return;
    ledger.customCategories = ledger.customCategories.filter((c) => c.id !== id);
    for (const item of [...ledger.entries, ...ledger.recurring]) if (item.kind === category.kind && item.category === id) item.category = "autre";
    ledger.rules = ledger.rules.filter((r) => r.category !== id);
  });
}

/** Replaces the per-category budgets of plaisir categories (0 removes a budget). */
export function saveCategoryBudgets(budgets: Record<string, number>): Promise<void> {
  return update((ledger) => {
    const known = new Set(categoriesOf(ledger).expense.map((c) => c.id));
    const next: Record<string, number> = {};
    for (const [id, value] of Object.entries(budgets)) {
      if (!known.has(id)) throw new LedgerError("Catégorie inconnue.");
      if (!Number.isInteger(value) || value < 0 || value > MAX_AMOUNT) throw new LedgerError("Montant invalide.");
      if (value > 0) next[id] = value;
    }
    ledger.categoryBudgets = next;
  });
}

/**
 * Gives every line with this label (and the next imports) the same type and category.
 * Only for types without extra data (plaisir, charge, revenu). Returns how many lines changed.
 */
export function recategorizeLabel(label: string, kind: Kind, category: string): Promise<number> {
  if (!(CUSTOMIZABLE_KINDS as readonly Kind[]).includes(kind)) throw new LedgerError("Possible pour plaisir, charge ou revenu.");
  const target = toLabel(label.trim());
  return update((ledger) => {
    checkCategory(kind, category, categoriesOf(ledger));
    let changed = 0;
    for (const entry of ledger.entries) {
      if (entry.label !== target || !(CUSTOMIZABLE_KINDS as readonly Kind[]).includes(entry.kind)) continue;
      if (entry.kind !== kind || entry.category !== category) changed++;
      entry.kind = kind;
      entry.category = category;
      if (kind !== "expense") entry.regret = false;
    }
    const match = normalizeBankLabel(target);
    ledger.rules = [...ledger.rules.filter((r) => r.contains || r.match !== match), { match, kind, category }];
    return changed;
  });
}

/**
 * Fills in the bank booking day of lines imported before it was recorded (or fixes it), from a new export.
 * The booking day is a bank fact, not a choice: safe to apply at every preview or import.
 */
export function refreshBookedDates(operations: { importId: string; bookedDate: string }[]): Promise<number> {
  const byId = new Map(operations.map((op) => [op.importId, op.bookedDate]));
  return update((ledger) => {
    let changed = 0;
    for (const entry of ledger.entries) {
      const booked = entry.importId && byId.get(entry.importId);
      if (booked && entry.bookedDate !== booked) {
        entry.bookedDate = booked;
        changed++;
      }
    }
    return changed;
  });
}
