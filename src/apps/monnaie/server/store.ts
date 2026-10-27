import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
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
  type CurrentAccount,
  accountOf,
  currentAccounts,
  MAIN_ACCOUNT,
  type Recurring,
  type SavingsAccount,
  type Settings,
} from "../money";

export const SLUG = "monnaie";
const file = () => appDataDir(SLUG, "ledger.json");

/** Invalid input; its message is safe to show to the user / API client. */
export class LedgerError extends Error {}

/** The data changed since the version the caller read: nothing was written. */
export class VersionConflictError extends LedgerError {}

/** Fingerprint of the data, to detect a change between a read and a write (ETag of the backup). */
export const ledgerVersion = (ledger: Ledger) => createHash("sha256").update(JSON.stringify(ledger)).digest("hex").slice(0, 32);

/** A savings line used to keep its livret in `account` (now the current account of every line). */
function migrateEntry(entry: Entry): Entry {
  if (entry.kind !== "savings" || !entry.account?.startsWith("l-") || entry.livret) return entry;
  const { account, ...rest } = entry;
  return { ...rest, livret: account };
}

export async function readLedger(): Promise<Ledger> {
  try {
    const data = JSON.parse(await fs.readFile(file(), "utf8")) as Partial<Ledger>;
    return {
      // Older lines were saved as typed: shown in capitals too, and rewritten so at the next save.
      entries: (data.entries ?? []).map((e) => migrateEntry({ ...e, label: toLabel(e.label) })),
      recurring: (data.recurring ?? []).map((r) => ({ ...r, label: toLabel(r.label) })),
      goals: data.goals ?? [],
      rules: data.rules ?? [],
      checkpoints: data.checkpoints ?? [],
      accounts: data.accounts ?? [],
      savingsAccounts: data.savingsAccounts ?? [],
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

export type EntryInput = {
  kind: unknown;
  amount: unknown;
  label: unknown;
  category: unknown;
  date: unknown;
  note?: unknown;
  regret?: unknown;
  person?: unknown;
  account?: unknown;
  to?: unknown;
  livret?: unknown;
};

/** Validates a line against the ledger's categories and savings accounts. */
function checkEntry(input: EntryInput, ledger: Ledger, categories: Categories = categoriesOf(ledger)) {
  const kind = checkKind(input.kind);
  if (typeof input.date !== "string" || !isValidDate(input.date)) throw new LedgerError("Date invalide (AAAA-MM-JJ).");
  const person = kind === "debt" ? text(input.person, 60) : "";
  if (kind === "debt" && !person) throw new LedgerError("Avec qui ? Donne un prénom.");
  const known = (id: string) => currentAccounts(ledger).some((a) => a.id === id);
  // The main account is the default: not written down.
  const account = text(input.account, 60);
  if (account && !known(account)) throw new LedgerError("Compte inconnu.");
  const to = kind === "transfer" ? text(input.to, 60) || MAIN_ACCOUNT.id : "";
  if (kind === "transfer" && (!known(to) || to === (account || MAIN_ACCOUNT.id))) throw new LedgerError("Choisis deux comptes différents.");
  const livret = kind === "savings" ? text(input.livret, 60) : "";
  if (livret && !ledger.savingsAccounts.some((a) => a.id === livret)) throw new LedgerError("Livret inconnu.");
  return {
    kind,
    amount: checkAmount(input.amount),
    label: checkLabel(input.label),
    category: checkCategory(kind, input.category, categories),
    date: input.date,
    note: text(input.note, 500),
    regret: kind === "expense" && input.regret === true,
    person: person || undefined,
    account: account && account !== MAIN_ACCOUNT.id ? account : undefined,
    to: to || undefined,
    livret: livret || undefined,
  };
}

// --- Entries ---

export function addEntry(input: EntryInput): Promise<Entry> {
  return update((ledger) => {
    const checked = checkEntry(input, ledger);
    const entry: Entry = { id: randomUUID(), ...checked, createdAt: new Date().toISOString() };
    ledger.entries.push(entry);
    return entry;
  });
}

export function editEntry(id: string, input: EntryInput): Promise<Entry> {
  return update((ledger) => {
    const checked = checkEntry(input, ledger);
    const entry = ledger.entries.find((e) => e.id === id);
    if (!entry) throw new LedgerError("Ligne introuvable.");
    // A date changed by hand no longer matches the bank's booking day.
    if (checked.date !== entry.date) delete entry.bookedDate;
    Object.assign(entry, checked);
    return entry;
  });
}

/** Changes some fields of a line (the others are kept), validated like a full edit. */
export function patchEntry(id: string, patch: Partial<EntryInput>): Promise<Entry> {
  return update((ledger) => {
    const entry = ledger.entries.find((e) => e.id === id);
    if (!entry) throw new LedgerError("Ligne introuvable.");
    const fields = ["kind", "amount", "label", "category", "date", "note", "regret", "person", "account", "to", "livret"] as const;
    const input: EntryInput = { ...entry };
    for (const key of fields) if (key in patch) input[key] = patch[key];
    const checked = checkEntry(input, ledger);
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

export type BulkPatch = { label?: unknown; kind?: unknown; category?: unknown; regret?: unknown };

/**
 * Changes the name, the type + category or the regret of several lines at once: all valid or nothing written.
 * With `learn`, the next imports follow: a rule already naming the old label takes the new one, and each renamed
 * or reclassified bank label gets an exact rule (when its lines agree on a type and a category).
 */
export function bulkEditEntries(ids: string[], patch: BulkPatch, learn = false): Promise<number> {
  const wanted = new Set(ids);
  return update((ledger) => {
    const categories = categoriesOf(ledger);
    const entries = ledger.entries.filter((e) => wanted.has(e.id));
    if (!entries.length) throw new LedgerError("Aucune ligne sélectionnée.");
    if ("kind" in patch && !(CUSTOMIZABLE_KINDS as readonly unknown[]).includes(patch.kind)) throw new LedgerError("Possible pour plaisir, charge ou revenu.");
    const before = new Map(entries.map((e) => [e.id, e.label]));
    const checked = entries.map((entry) => {
      const input: EntryInput = { ...entry };
      for (const key of ["label", "kind", "category", "regret"] as const) if (key in patch) input[key] = patch[key];
      return [entry, checkEntry(input, ledger, categories)] as const;
    });
    let changed = 0;
    for (const [entry, next] of checked) {
      if (next.label !== entry.label || next.kind !== entry.kind || next.category !== entry.category || next.regret !== entry.regret) changed++;
      Object.assign(entry, next);
    }

    if (learn && ("label" in patch || "kind" in patch)) {
      const byOldLabel = new Map<string, Entry[]>();
      for (const entry of entries) byOldLabel.set(before.get(entry.id)!, [...(byOldLabel.get(before.get(entry.id)!) ?? []), entry]);
      for (const [old, list] of byOldLabel) {
        const { kind, category, label } = list[0];
        const agree = (CUSTOMIZABLE_KINDS as readonly Kind[]).includes(kind) && list.every((e) => e.kind === kind && e.category === category);
        // A label given by a rule is not the bank's: those rules are the ones to update.
        const named = ledger.rules.filter((r) => r.label === old);
        if (named.length) {
          for (const rule of named) {
            if ("label" in patch) rule.label = label;
            if ("kind" in patch && agree) Object.assign(rule, { kind, category });
          }
          continue;
        }
        if (!agree || !list.some((e) => e.importId)) continue;
        const match = normalizeBankLabel(old);
        const existing = ledger.rules.find((r) => !r.contains && r.match === match);
        const rule: ImportRule = { ...existing, match, kind, category };
        if ("label" in patch) rule.label = label;
        if (rule.label === match) delete rule.label;
        delete rule.ignore;
        delete rule.person;
        ledger.rules = [...ledger.rules.filter((r) => r !== existing), rule];
      }
    }
    return changed;
  });
}

/** Deletes several lines; returns how many existed. */
export function bulkDeleteEntries(ids: string[]): Promise<number> {
  const wanted = new Set(ids);
  return update((ledger) => {
    const before = ledger.entries.length;
    ledger.entries = ledger.entries.filter((e) => !wanted.has(e.id));
    return before - ledger.entries.length;
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
        const entry = checkEntry(row, ledger, categories);
        // A transfer rule keeps my other account (the side that is not the imported one).
        const other = entry.kind === "transfer" ? (entry.account ?? entry.to) : undefined;
        const learned: ImportRule | undefined = rule
          ? { match: rule, kind: entry.kind, category: entry.category, label: entry.label, person: entry.person, account: other }
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
      // A transfer already brought in by the livret's own export: the same line, now seen from the current account.
      const twin = row.entry.kind === "savings" || row.entry.kind === "transfer" ? findTransfer(ledger.entries, row.entry, (e) => !e.importId && !!e.pocketImportId) : undefined;
      if (twin) {
        Object.assign(twin, { importId: row.importId, bookedDate: row.bookedDate });
        skipped++;
        continue;
      }
      ledger.entries.push({ id: randomUUID(), ...row.entry, importId: row.importId, bookedDate: row.bookedDate, createdAt: now });
      added++;
    }
    const rules = checked.flatMap((row) => (row.rule ? [row.rule] : []));
    for (const rule of rules) ledger.rules = [...ledger.rules.filter((r) => r.match !== rule.match), rule];
    return { added, skipped, rules: rules.length };
  });
}

/**
 * The same transfer (kind, direction and amount) a few days apart at most: banks book both sides on different days.
 * `target` is a savings line (direction in its category) or a transfer between two current accounts.
 */
function findTransfer(entries: Entry[], target: Pick<Entry, "category" | "amount" | "date"> & Partial<Pick<Entry, "kind" | "account" | "to">>, eligible: (e: Entry) => boolean) {
  const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
  const kind = target.kind ?? "savings";
  const sameSides = (e: Entry) => kind !== "transfer" || (accountOf(e) === accountOf(target) && e.to === target.to);
  return entries
    .filter((e) => e.kind === kind && e.category === target.category && e.amount === target.amount && sameSides(e) && Math.abs(day(e.date) - day(target.date)) <= 4 && eligible(e))
    .sort((a, b) => Math.abs(day(a.date) - day(target.date)) - Math.abs(day(b.date) - day(target.date)))[0];
}

/**
 * Imports a livret's own export into savings account `accountId`. Each transfer is matched with the line already
 * imported from the current account (it gets attributed to this livret); interest becomes a new line; a transfer
 * not found yet is added (the current-account import will match it later).
 */
export function importSavingsOperations(
  accountId: string,
  operations: { importId: string; date: string; label: string; amount: number }[],
): Promise<{ linked: number; added: number; interest: number; skipped: number }> {
  return update((ledger) => {
    const account = ledger.savingsAccounts.find((a) => a.id === accountId);
    if (!account) throw new LedgerError("Livret inconnu.");
    const known = new Set(ledger.entries.map((e) => e.pocketImportId).filter(Boolean));
    const result = { linked: 0, added: 0, interest: 0, skipped: 0 };
    const now = new Date().toISOString();
    for (const op of operations) {
      if (known.has(op.importId)) {
        result.skipped++;
        continue;
      }
      if (!Number.isInteger(op.amount) || op.amount === 0 || !isValidDate(op.date)) throw new LedgerError("Opération invalide.");
      known.add(op.importId);
      const base = { amount: Math.abs(op.amount), date: op.date, note: "", regret: false, livret: account.id, pocketImportId: op.importId, createdAt: now };
      if (/^INTERETS\b/i.test(normalizeBankLabel(op.label)) && op.amount > 0) {
        ledger.entries.push({ id: randomUUID(), kind: "savings", category: "interets", label: toLabel(`INTÉRÊTS ${account.name}`), ...base });
        result.interest++;
        continue;
      }
      // Money in on the livret is a deposit from the current account.
      const category = op.amount > 0 ? "depot" : "retrait";
      const twin = findTransfer(ledger.entries, { category, amount: Math.abs(op.amount), date: op.date }, (e) => !e.pocketImportId && (!e.livret || e.livret === account.id));
      if (twin) {
        Object.assign(twin, { livret: account.id, pocketImportId: op.importId });
        result.linked++;
      } else {
        ledger.entries.push({ id: randomUUID(), kind: "savings", category, label: toLabel(op.label), ...base });
        result.added++;
      }
    }
    return result;
  });
}

// --- Savings accounts ---

export function addSavingsAccount(input: { name: unknown; emoji: unknown }): Promise<SavingsAccount> {
  const name = text(input.name, 30);
  if (!name) throw new LedgerError("Donne un nom au livret.");
  const emoji = [...text(input.emoji, 16)].slice(0, 2).join("") || "🐷";
  return update((ledger) => {
    if (ledger.savingsAccounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new LedgerError("Ce livret existe déjà.");
    const slug = name.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 30) || "livret";
    const account: SavingsAccount = { id: `l-${slug}-${randomUUID().slice(0, 4)}`, name, emoji };
    ledger.savingsAccounts.push(account);
    return account;
  });
}

/** Deletes a savings account: its lines stay (the money moved), no longer attributed to a livret. */
export function deleteSavingsAccount(id: string): Promise<void> {
  return update((ledger) => {
    ledger.savingsAccounts = ledger.savingsAccounts.filter((a) => a.id !== id);
    for (const entry of ledger.entries) if (entry.livret === id) delete entry.livret;
  });
}

/** Adds a current account (Revolut, Crédit Mutuel…); `personal: false` for a business account. */
export function addCurrentAccount(input: { name: unknown; emoji: unknown; personal: unknown }): Promise<CurrentAccount> {
  const name = text(input.name, 30);
  if (!name) throw new LedgerError("Donne un nom au compte.");
  const emoji = [...text(input.emoji, 16)].slice(0, 2).join("") || "💳";
  return update((ledger) => {
    if (currentAccounts(ledger).some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new LedgerError("Ce compte existe déjà.");
    const slug = name.normalize("NFD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 30) || "compte";
    const account: CurrentAccount = { id: `a-${slug}-${randomUUID().slice(0, 4)}`, name, emoji, personal: input.personal !== false };
    ledger.accounts.push(account);
    return account;
  });
}

/** Deletes a current account that has no line left (its lines would lose where the money is). */
export function deleteCurrentAccount(id: string): Promise<void> {
  return update((ledger) => {
    const used = ledger.entries.filter((e) => e.account === id || e.to === id).length;
    if (used) throw new LedgerError(`Ce compte a encore ${used} ligne${used > 1 ? "s" : ""} : déplace-les ou supprime-les d'abord.`);
    ledger.accounts = ledger.accounts.filter((a) => a.id !== id);
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
export function restoreLedger(raw: string, expectedVersion?: string): Promise<number> {
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
    // Written by someone else (the app, another script) since the caller's read: refuse rather than overwrite.
    if (expectedVersion && ledgerVersion(ledger) !== expectedVersion) {
      throw new VersionConflictError("Les données ont changé depuis ta lecture : relis la sauvegarde et refais ta modification.");
    }
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
