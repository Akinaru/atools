"use server";

import { refresh } from "next/cache";
import { MONTH_PATTERN, parseAmount, parseOptionalAmount } from "../money";
import {
  addEntry,
  addGoal,
  addRecurring,
  applyRecurring,
  deleteEntry,
  deleteGoal,
  deleteRecurring,
  editEntry,
  LedgerError,
  moveGoalMoney,
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
});

export async function saveEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = text(formData, "id");
  const input = entryFromForm(formData);
  if (input.amount === undefined) return { error: "Montant invalide (ex : 12,50)." };
  return attempt(() => (id ? editEntry(id, input) : addEntry(input)), id ? "Ligne modifiée." : "Ajouté !");
}

export async function removeEntry(id: string) {
  await deleteEntry(id);
  refresh();
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
  const fixedCosts = parseOptionalAmount(text(formData, "fixedCosts"));
  if (monthlyBudget === undefined || fixedCosts === undefined) return { error: "Montant invalide (ex : 300 ou 1 250,50)." };
  return attempt(() => saveSettings({ monthlyBudget, fixedCosts }), "Réglages enregistrés.");
}
