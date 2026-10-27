// What importing a bank export into one account would do, operation by operation, before anything is written:
// already there, the other side of a line already known (a transfer seen from the other account), or new.
// Pure: used by the import screen (preview) and the API.

import { accountBalanceAt, accountFlow, accountOf, checkpointChecks, MAIN_ACCOUNT, savingsDelta, type Cents, type Entry, type Ledger } from "../money";
import { BankFileError } from "./csv";
import { normalizeBankLabel, suggest, type HistoryHit, type Suggestion } from "./suggest";
import type { BankFile, BankOperation } from "./types";

/** The account the export belongs to: a current account or a livret. */
export type ImportTarget = { type: "account" | "livret"; id: string };

/** The line an operation was matched with: the same money, already recorded from the other account. */
export type Twin = { id: string; label: string; date: string; kind: Entry["kind"]; account: string; to?: string; livret?: string };

export type PlannedRow = BankOperation & {
  /** Normalized label, what rules match. */
  match: string;
  status: "known" | "twin" | "new";
  twin?: Twin;
  suggestion: Suggestion;
};

export type ImportPlan = {
  rows: PlannedRow[];
  from: string;
  to: string;
  /** Balance of the account at the export's last day with what is already recorded, null when unknown. */
  balanceBefore: Cents | null;
  /** Balance the export gives after its last operation, when it gives one. */
  fileBalance: Cents | null;
  /** First import of an account whose export gives balances: what it held before its first operation. */
  start: Cents | null;
  /**
   * Main account only (its balance follows the checkpoints): each checkpoint with the balance the recorded lines
   * expect since the one before (null for the first). Lines added before a checkpoint change its gap, not its balance.
   */
  checkpoints: { date: string; balance: Cents; expected: Cents | null; previous: string | null }[];
};

const day = (date: string) => Date.parse(`${date}T00:00:00Z`) / 86_400_000;
const idsOf = (e: Entry) => [e.importId, e.pocketImportId].filter((id): id is string => !!id);

/** What each bank label (else each label) became the last time, the lines of `account` first. */
export function historyOf(entries: Entry[], account: string): Map<string, HistoryHit> {
  const history = new Map<string, HistoryHit & { date: string; same: boolean }>();
  for (const e of entries) {
    // An income or spending of another account that went through this one is not what this label means here.
    if (e.kind === "savings" || (e.category === "autre" && e.kind !== "debt") || e.pocketImportId?.endsWith(":via")) continue;
    const key = e.bankLabel ?? normalizeBankLabel(e.label);
    const same = e.kind === "transfer" ? accountOf(e) === account || e.to === account : accountOf(e) === account;
    const known = history.get(key);
    if (known && ((known.same && !same) || (known.same === same && known.date > e.date))) continue;
    const other = e.kind === "transfer" ? (accountOf(e) === account ? e.to : accountOf(e)) : undefined;
    history.set(key, { kind: e.kind, category: e.category, label: e.label, person: e.person, other, date: e.date, same });
  }
  return history;
}

/**
 * The line recorded from the other side of this operation: a transfer (or a savings move) with the same amount, in
 * the right direction, a few days apart, that only one side has imported so far (and not from this very export).
 */
function findTwin(entries: Entry[], op: BankOperation, target: ImportTarget, fileIds: Set<string>, used: Set<string>): Entry | undefined {
  const amount = Math.abs(op.amount);
  const into = op.amount > 0;
  const fits = (e: Entry) => {
    if (e.amount !== amount || used.has(e.id) || Math.abs(day(e.bookedDate ?? e.date) - day(op.date)) > 4) return false;
    const ids = idsOf(e);
    if (ids.length > 1 || ids.some((id) => fileIds.has(id))) return false;
    if (target.type === "livret") return e.kind === "savings" && (!e.livret || e.livret === target.id) && e.category === (into ? "depot" : "retrait");
    if (e.kind === "transfer") return into ? e.to === target.id : accountOf(e) === target.id;
    return e.kind === "savings" && accountOf(e) === target.id && e.category === (into ? "retrait" : "depot");
  };
  return entries.filter(fits).sort((a, b) => Math.abs(day(a.date) - day(op.date)) - Math.abs(day(b.date) - day(op.date)))[0];
}

/** Balance of the target at the end of `date`, from what is recorded. */
function balanceAt(ledger: Ledger, target: ImportTarget, date: string): Cents | null {
  if (target.type === "livret") {
    const livret = ledger.savingsAccounts.find((a) => a.id === target.id);
    return ledger.entries.reduce((n, e) => (e.kind === "savings" && e.livret === target.id && e.date <= date ? n + savingsDelta(e) : n), livret?.start ?? 0);
  }
  if (target.id === MAIN_ACCOUNT.id) return accountBalanceAt(ledger, date);
  const account = ledger.accounts.find((a) => a.id === target.id);
  return ledger.entries.reduce((n, e) => ((e.bookedDate ?? e.date) <= date ? n + accountFlow(e, target.id) : n), account?.start ?? 0);
}

export function planImport(ledger: Ledger, file: BankFile, target: ImportTarget): ImportPlan {
  const known = new Set(ledger.entries.flatMap(idsOf));
  const fileIds = new Set(file.operations.map((op) => op.importId));
  const history = historyOf(ledger.entries, target.id);
  const used = new Set<string>();
  const rows = file.operations.map((op): PlannedRow => {
    const match = normalizeBankLabel(op.label);
    const suggestion = suggestFor(op, ledger, target, history);
    if (known.has(op.importId)) return { ...op, match, status: "known", suggestion };
    const twin = findTwin(ledger.entries, op, target, fileIds, used);
    if (!twin) return { ...op, match, status: "new", suggestion };
    used.add(twin.id);
    return { ...op, match, status: "twin", suggestion, twin: { id: twin.id, label: twin.label, date: twin.date, kind: twin.kind, account: accountOf(twin), to: twin.to, livret: twin.livret } };
  });
  const last = file.operations.at(-1)!;
  const first = file.operations[0];
  const hasLines = ledger.entries.some((e) => (target.type === "livret" ? e.livret === target.id : accountOf(e) === target.id || e.to === target.id));
  return {
    rows,
    from: first.date,
    to: last.date,
    balanceBefore: balanceAt(ledger, target, last.bookedDate),
    fileBalance: last.balance ?? null,
    start: !hasLines && target.id !== MAIN_ACCOUNT.id && first.balance !== undefined ? first.balance - first.amount : null,
    checkpoints:
      target.type === "account" && target.id === MAIN_ACCOUNT.id
        ? checkpointChecks(ledger).map(({ checkpoint, expected }, i, all) => ({ date: checkpoint.date, balance: checkpoint.balance, expected, previous: i ? all[i - 1].checkpoint.date : null }))
        : [],
  };
}

/** A livret's operations are transfers with the current account, or interest. */
function suggestFor(op: BankOperation, ledger: Ledger, target: ImportTarget, history: Map<string, HistoryHit>): Suggestion {
  if (target.type === "account") return suggest(op, ledger.rules, { account: target.id, history });
  const livret = ledger.savingsAccounts.find((a) => a.id === target.id);
  if (/^INTERETS\b/.test(normalizeBankLabel(op.label)) && op.amount > 0) {
    return { ignore: false, kind: "savings", category: "interets", label: `INTÉRÊTS ${livret?.name ?? ""}`.trim().toUpperCase(), source: "bank" };
  }
  return { ignore: false, kind: "savings", category: op.amount > 0 ? "depot" : "retrait", label: op.label, account: MAIN_ACCOUNT.id, source: "bank" };
}

/**
 * The account an export goes into: the one asked ("account:<id>" or "livret:<id>"), else guessed from the bank:
 * the Caisse d'Épargne main account (a livret's export says so: only internal transfers and interest), Revolut and
 * Revolut Pro, Crédit Mutuel, by their names.
 */
export function resolveTarget(ledger: Ledger, file: BankFile, asked: string): ImportTarget {
  const [type, id] = asked.split(":");
  if (type === "account" && [MAIN_ACCOUNT, ...ledger.accounts].some((a) => a.id === id)) return { type, id };
  if (type === "livret" && ledger.savingsAccounts.some((a) => a.id === id)) return { type, id };
  const named = (test: RegExp, not?: RegExp) => ledger.accounts.find((a) => test.test(a.name) && !not?.test(a.name));
  if (file.bank === "caisse-epargne") {
    const livretFile = file.operations.every((op) => op.bankCategory === "Transaction exclue" || /^INTERETS/.test(normalizeBankLabel(op.label)));
    if (!livretFile) return { type: "account", id: MAIN_ACCOUNT.id };
    throw new BankFileError("C'est le relevé d'un livret : choisis lequel dans la liste « Compte ».");
  }
  const account =
    file.bank === "revolut" ? (file.product === "Pro" ? named(/revolut/i, /^(?!.*pro)/i) : named(/revolut/i, /pro/i)) : named(/cr[ée]dit mutuel|\bcm\b/i);
  if (!account) throw new BankFileError(`Aucun compte « ${file.bankName} » : crée-le dans Réglages > Comptes, ou choisis le compte dans la liste.`);
  return { type: "account", id: account.id };
}

/** The rows to write when the plan is taken as suggested (no review): new lines added, twins linked. */
export function rowsAsSuggested(plan: ImportPlan) {
  return plan.rows
    .filter((r) => r.status !== "known")
    .map((r) => ({
      importId: r.importId,
      match: r.match,
      action: r.status === "twin" ? "link" : r.suggestion.ignore ? "ignore" : "add",
      twin: r.twin?.id,
      kind: r.suggestion.kind,
      category: r.suggestion.category,
      label: r.suggestion.label,
      person: r.suggestion.person,
      account: r.suggestion.account,
      to: r.suggestion.to,
      via: r.suggestion.via,
      amount: Math.abs(r.amount),
      date: r.date,
      bookedDate: r.bookedDate,
      note: "",
    }));
}
