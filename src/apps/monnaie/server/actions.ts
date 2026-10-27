"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { VIEW_COOKIES } from "./view";
import { parseBankFile } from "../import/banks";
import { BankFileError, decodeBankFile } from "../import/csv";
import { planImport, resolveTarget, type ImportPlan } from "../import/plan";
import { accountNamesOf, categoriesOf, MONTH_PATTERN, parseAmount, parseOptionalAmount, type AccountNames, type Categories, type Kind } from "../money";
import {
  addEntry,
  addGoal,
  addSavingsAccount,
  deleteSavingsAccount,
  addCurrentAccount,
  deleteCurrentAccount,
  bulkDeleteEntries,
  bulkEditEntries,
  type BulkPatch,
  addRecurring,
  applyRecurring,
  deleteEntry,
  addCheckpoint,
  addCustomCategory,
  deleteCustomCategory,
  deleteCheckpoint,
  deleteGoal,
  deleteRule,
  recategorizeLabel,
  saveCategoryBudgets,
  applyImport,
  type ImportResult,
  deleteRecurring,
  editEntry,
  LedgerError,
  moveGoalMoney,
  readLedger,
  refreshBookedDates,
  restoreLedger,
  saveSettings,
  toggleRegret,
} from "./store";

export type FormState = { error?: string; message?: string; ok?: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Runs a change, turns validation errors into a message and refreshes the page on success. */
async function attempt(change: () => Promise<unknown>, message?: string): Promise<FormState> {
  try {
    await change();
  } catch (error) {
    if (error instanceof LedgerError) return { error: error.message };
    throw error;
  }
  refresh();
  // `ok` changes on every success, so forms can reset themselves.
  return { message, ok: Date.now() };
}

const entryFromForm = (formData: FormData) => ({
  kind: text(formData, "kind"),
  amount: parseAmount(text(formData, "amount")),
  label: text(formData, "label"),
  category: text(formData, "category"),
  date: text(formData, "date"),
  note: text(formData, "note"),
  regret: formData.get("regret") === "on",
  person: text(formData, "person"),
  account: text(formData, "account"),
  to: text(formData, "to"),
  livret: text(formData, "livret"),
});

export async function saveEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const input = entryFromForm(formData);
  if (input.amount === undefined) return { error: "Montant invalide (ex : 12,50)." };
  // "Toutes les lignes de ce libellé": same type and category everywhere, and for the next imports.
  if (id && formData.get("applyAll") === "on") {
    let changed = 0;
    const state = await attempt(async () => {
      await editEntry(id, input);
      changed = await recategorizeLabel(input.label, input.kind as Kind, input.category);
    });
    return state.error ? state : { ...state, message: `Ligne modifiée · ${changed} autre${changed > 1 ? "s" : ""} reclassée${changed > 1 ? "s" : ""}.` };
  }
  return attempt(() => (id ? editEntry(id, input) : addEntry(input)), id ? "Ligne modifiée." : "Ajouté !");
}

export async function removeEntry(id: string) {
  await deleteEntry(id);
  refresh();
}

/** Bulk actions of the Lignes page; `learn` also updates the import rules (see bulkEditEntries). */
export async function editLines(ids: string[], patch: BulkPatch, learn: boolean): Promise<{ error?: string; changed?: number }> {
  try {
    const changed = await bulkEditEntries(ids, patch, learn);
    refresh();
    return { changed };
  } catch (error) {
    if (error instanceof LedgerError) return { error: error.message };
    throw error;
  }
}

export async function deleteLines(ids: string[]): Promise<{ changed: number }> {
  const changed = await bulkDeleteEntries(ids);
  refresh();
  return { changed };
}

export async function flipRegret(id: string) {
  await toggleRegret(id);
  refresh();
}

export async function createRecurring(_prev: FormState, formData: FormData): Promise<FormState> {
  const amount = parseAmount(text(formData, "amount"));
  if (amount === undefined) return { error: "Montant invalide (ex : 12,50)." };
  return attempt(
    () => addRecurring({ kind: text(formData, "kind"), amount, label: text(formData, "label"), category: text(formData, "category"), day: Number(text(formData, "day")) }),
    "Récurrent ajouté.",
  );
}

export async function removeRecurring(id: string) {
  await deleteRecurring(id);
  refresh();
}

export async function addRecurringToMonth(month: string) {
  if (!MONTH_PATTERN.test(month)) return;
  await applyRecurring(month);
  refresh();
}

export async function createGoal(_prev: FormState, formData: FormData): Promise<FormState> {
  const target = parseAmount(text(formData, "target"));
  if (target === undefined) return { error: "Montant cible invalide." };
  return attempt(() => addGoal({ name: text(formData, "name"), emoji: text(formData, "emoji"), target }), "Objectif créé.");
}

export async function moveMoney(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const amount = parseAmount(text(formData, "amount"));
  if (amount === undefined) return { error: "Montant invalide." };
  const sign = text(formData, "direction") === "out" ? -1 : 1;
  return attempt(() => moveGoalMoney(id, sign * amount));
}

export async function removeGoal(id: string) {
  await deleteGoal(id);
  refresh();
}

export async function updateSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const monthlyBudget = parseOptionalAmount(text(formData, "monthlyBudget"));
  const savingsStart = parseOptionalAmount(text(formData, "savingsStart"));
  if (monthlyBudget === undefined || savingsStart === undefined) {
    return { error: "Montant invalide (ex : 300 ou 1 250,50)." };
  }
  return attempt(() => saveSettings({ monthlyBudget, savingsStart }), "Réglages enregistrés.");
}

/** Records the real balance of the current account at a date. The balance may be negative: "-120,50". */
export async function createCheckpoint(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = text(formData, "balance");
  const negative = /^[-−]/.test(raw);
  const balance = parseOptionalAmount(raw.replace(/^[-−]\s*/, ""));
  if (!raw || balance === undefined) return { error: "Solde invalide (ex : 1 250,40 ou -80)." };
  return attempt(() => addCheckpoint(text(formData, "date"), negative ? -balance : balance), "Pointage enregistré.");
}

export async function removeCheckpoint(id: string) {
  await deleteCheckpoint(id);
  refresh();
}

// --- Bank import ---

export type PreviewState = {
  error?: string;
  fileName?: string;
  bankName?: string;
  /** "account:<id>" or "livret:<id>". */
  target?: string;
  targetName?: string;
  plan?: ImportPlan;
  categories?: Categories;
  names?: AccountNames;
};

const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

/** Reads an uploaded bank export (any supported bank) and plans its import into the account chosen or guessed. */
export async function previewImport(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis le fichier CSV exporté depuis ta banque." };
  if (file.size > MAX_IMPORT_SIZE) return { error: "Fichier trop gros (5 Mo max)." };
  try {
    const bank = parseBankFile(decodeBankFile(new Uint8Array(await file.arrayBuffer())));
    const target = resolveTarget(await readLedger(), bank, text(formData, "target"));
    // The Caisse d'Épargne export also fixes the booking day of lines imported before.
    if (bank.bank === "caisse-epargne" && target.type === "account") await refreshBookedDates(bank.operations);
    const ledger = await readLedger();
    const names = accountNamesOf(ledger);
    const targetName = (target.type === "livret" ? names.livrets : names.accounts).find((a) => a.id === target.id)?.name;
    return { fileName: file.name, bankName: bank.bankName, target: `${target.type}:${target.id}`, targetName, plan: planImport(ledger, bank, target), categories: categoriesOf(ledger), names };
  } catch (error) {
    if (error instanceof BankFileError || error instanceof LedgerError) return { error: error.message };
    throw error;
  }
}

/** Saves the reviewed operations (sent as JSON by the import screen). */
export async function commitImport(_prev: FormState, formData: FormData): Promise<FormState & { result?: ImportResult }> {
  let rows: unknown;
  try {
    rows = JSON.parse(text(formData, "rows"));
  } catch {
    return { error: "Import illisible, recommence." };
  }
  const [type, id] = text(formData, "target").split(":");
  if ((type !== "account" && type !== "livret") || !id) return { error: "Compte manquant, recommence." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Rien à importer." };
  const start = text(formData, "start") ? Number(text(formData, "start")) : undefined;
  try {
    const result = await applyImport({ type, id }, rows, start);
    refresh();
    return { ok: Date.now(), result };
  } catch (error) {
    if (error instanceof LedgerError) return { error: error.message };
    throw error;
  }
}

export async function createSavingsAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  return attempt(() => addSavingsAccount({ name: text(formData, "name"), emoji: text(formData, "emoji") }), "Livret ajouté.");
}

export async function createCurrentAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  return attempt(
    () => addCurrentAccount({ name: text(formData, "name"), emoji: text(formData, "emoji"), personal: formData.get("pro") !== "on" }),
    "Compte ajouté.",
  );
}

/** Offered only for an account without lines (the store refuses otherwise). */
export async function removeCurrentAccount(id: string) {
  await deleteCurrentAccount(id);
  refresh();
}

export async function removeSavingsAccount(id: string) {
  await deleteSavingsAccount(id);
  refresh();
}

export async function removeRule(match: string) {
  await deleteRule(match);
  refresh();
}

/** Replaces all the data with a backup file (the previous data is kept on disk). */
export async function restoreBackup(_prev: FormState, formData: FormData): Promise<FormState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisis un fichier de sauvegarde (.json)." };
  if (file.size > 20 * 1024 * 1024) return { error: "Fichier trop gros (20 Mo max)." };
  if (formData.get("confirm") !== "on") return { error: "Coche la case pour confirmer : tout sera remplacé." };
  return attempt(async () => restoreLedger(await file.text()), "Sauvegarde restaurée.");
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  let moved = 0;
  const state = await attempt(async () => {
    ({ moved } = await addCustomCategory({
      kind: text(formData, "kind"),
      label: text(formData, "label"),
      emoji: text(formData, "emoji"),
      keywords: text(formData, "keywords"),
    }));
  });
  if (state.error) return state;
  return { ...state, message: moved ? `Catégorie créée · ${moved} ligne${moved > 1 ? "s" : ""} déplacée${moved > 1 ? "s" : ""}.` : "Catégorie créée." };
}

export async function removeCategory(id: string) {
  await deleteCustomCategory(id);
  refresh();
}

/** Saves the per-category budgets (fields "budget-<category id>"). */
export async function updateCategoryBudgets(_prev: FormState, formData: FormData): Promise<FormState> {
  const budgets: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("budget-") || typeof value !== "string") continue;
    const amount = parseOptionalAmount(value);
    if (amount === undefined) return { error: `Montant invalide pour « ${key.slice(7)} ».` };
    budgets[key.slice(7)] = amount;
  }
  return attempt(() => saveCategoryBudgets(budgets), "Budgets enregistrés.");
}

// --- Period shown (kept in a cookie, not in the URL) ---

// Back to today after a while: opening the app later shows the current period again.
const VIEW_MAX_AGE = 2 * 60 * 60;

async function remember(name: string, value: string | null) {
  const jar = await cookies();
  if (value) jar.set(name, value, { path: "/", httpOnly: true, sameSite: "lax", maxAge: VIEW_MAX_AGE });
  else jar.delete(name);
}

/** Shows another month in place (null: the current month). */
export async function showMonth(month: string | null) {
  await remember(VIEW_COOKIES.month, month && MONTH_PATTERN.test(month) ? month : null);
  refresh();
}

/** Shows another year in place (null: the current year). */
export async function showYear(year: number | null) {
  await remember(VIEW_COOKIES.year, year && Number.isInteger(year) && year > 1900 && year < 3000 ? String(year) : null);
  refresh();
}

/** Opens a month from elsewhere (the year table): remembers it and goes to the month page. */
export async function openMonth(month: string) {
  await remember(VIEW_COOKIES.month, MONTH_PATTERN.test(month) ? month : null);
  redirect("/apps/monnaie");
}
