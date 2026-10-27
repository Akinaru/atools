"use client";

import { useOptimistic, useState, useTransition, type CSSProperties } from "react";
import { dayParts, formatSigned, getCategory, lineCategoryLabel, monthShortName, savingsDelta, signedAmount, type Categories, type Entry, type Kind, type SavingsAccount } from "../money";
import { flipRegret, removeEntry } from "../server/actions";
import { EntryDialog } from "./EntryDialog";
import { squareClass } from "./kit";
import { useBusy } from "./motion";

/** Sticker and amount colors: plaisir in accent, charges in grey, income in white, livret in yellow. */
const STICKER: Record<Kind, string> = {
  expense: "bg-[var(--mn-accent)]",
  charge: "bg-[var(--mn-muted)]",
  income: "bg-white",
  savings: "bg-[var(--mn-yellow)]",
  debt: "bg-[var(--mn-red)]",
};
const AMOUNT: Record<Kind, string> = {
  expense: "text-[var(--mn-accent)]",
  charge: "text-[var(--mn-muted)]",
  income: "text-white",
  savings: "text-[var(--mn-yellow)]",
  debt: "text-[var(--mn-red)]",
};

/** Entries of a month, grouped by day, newest first: a big date on the left, one ticket per entry. */
export function EntryList({ entries, categories, accounts, labelCounts = {} }: { entries: Entry[]; categories: Categories; accounts: SavingsAccount[]; labelCounts?: Record<string, number> }) {
  const days = new Map<string, Entry[]>();
  for (const entry of entries) days.set(entry.date, [...(days.get(entry.date) ?? []), entry]);

  let row = 0;
  return (
    <div className="grid gap-5">
      {[...days].map(([date, list]) => {
        const { day, weekday } = dayParts(date);
        const total = list.reduce((n, e) => n + signedAmount(e), 0);
        return (
          <section key={date} className="grid gap-3 sm:grid-cols-[8.5rem_1fr] sm:gap-6">
            <header className="flex items-center gap-3 sm:self-start sm:pt-2">
              <span className="mn-punch mn-title w-14 text-center text-5xl">{day}</span>
              <span className="grid gap-1 leading-none">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--mn-muted)]">
                  {weekday} {monthShortName(date.slice(0, 7))}
                </span>
                <span className={`mn-punch text-lg ${total < 0 ? "text-[var(--mn-accent)]" : "text-white"}`}>{formatSigned(total)}</span>
              </span>
            </header>
            <ul className="grid content-start gap-3">
              {list.map((entry) => (
                <EntryRow key={entry.id} entry={entry} categories={categories} accounts={accounts} sameLabel={labelCounts[entry.label] ?? 1} tilt={row++ % 2 ? 0.35 : -0.35} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * One entry as a slightly tilted ticket: sticker, label, amount; actions show on hover. Deleting and
 * regretting are optimistic: the row reacts at once, the server follows (and the row comes back on error).
 */
function EntryRow({ entry, categories, accounts, sameLabel, tilt }: { entry: Entry; categories: Categories; accounts: SavingsAccount[]; sameLabel: number; tilt: number }) {
  const category = getCategory(entry.kind, entry.category, categories);
  const [pending, startTransition] = useTransition();
  const [regret, setRegret] = useOptimistic(entry.regret);
  const [removing, setRemoving] = useState(false);
  useBusy(pending);

  const remove = () => {
    setRemoving(true);
    startTransition(async () => {
      try {
        await removeEntry(entry.id);
      } catch {
        setRemoving(false);
      }
    });
  };
  const toggleRegret = () =>
    startTransition(async () => {
      setRegret(!regret);
      await flipRegret(entry.id);
    });
  // A savings transfer shows its effect on its pocket (+ put aside, − taken back), an IOU its amount;
  // the rest, its effect on the current account.
  const amount =
    entry.kind === "savings"
      ? savingsDelta(entry)
      : entry.kind === "debt" && entry.category === "dette"
        ? entry.amount
        : signedAmount(entry);
  return (
    <li
      className={`mn-shape group flex items-center gap-4 py-3 pl-3 pr-4 drop-shadow-[0.3rem_0.35rem_0_rgba(0,0,0,0.45)] transition-transform duration-150 [transform:rotate(var(--mn-tilt))] hover:[transform:translateY(-2px)_rotate(0deg)] sm:pl-4 ${removing ? "mn-row-out" : ""}`}
      aria-busy={pending}
      style={{ "--mn-shape": "var(--mn-panel-2)", "--mn-tilt": `${tilt}deg` } as CSSProperties}
    >
      <span
        className={`flex h-12 w-12 shrink-0 -rotate-6 items-center justify-center text-2xl shadow-[3px_3px_0_var(--mn-ink)] transition-transform group-hover:rotate-6 group-hover:scale-110 ${STICKER[entry.kind]}`}
        aria-hidden
      >
        {category.emoji}
      </span>

      <EntryDialog
        categories={categories}
        accounts={accounts}
        sameLabel={sameLabel}
        defaultDate={entry.date}
        entry={entry}
        trigger={
          <span className="block min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-lg font-bold decoration-[var(--mn-accent)] decoration-2 underline-offset-4 group-hover:underline">{entry.label}</span>
              {entry.recurringId && (
                <span className="shrink-0 text-xs text-[var(--mn-muted)]" title="Ajouté depuis un récurrent">
                  ⟳
                </span>
              )}
              {regret && (
                <span className="mn-punch mn-pop shrink-0 -rotate-3 border-2 border-[var(--mn-red)] px-1.5 pt-0.5 text-xs text-[var(--mn-red)]">Regret</span>
              )}
            </span>
            <span className="block truncate text-sm text-[var(--mn-muted)]">
              {lineCategoryLabel(entry, categories, accounts)}
              {entry.person && ` · ${entry.person}`}
              {entry.note && ` · ${entry.note}`}
            </span>
          </span>
        }
      />

      <span className="ml-auto flex shrink-0 items-center gap-2">
        <span className="flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {entry.kind === "expense" && (
            <button
              type="button"
              onClick={toggleRegret}
              title={regret ? "Finalement j'assume" : "Je regrette"}
              aria-label={regret ? `Ne plus regretter ${entry.label}` : `Regretter ${entry.label}`}
              aria-pressed={regret}
              className={`${squareClass()} text-lg ${regret ? "" : "grayscale"}`}
            >
              😬
            </button>
          )}
          <button type="button" onClick={remove} disabled={removing} title="Supprimer" aria-label={`Supprimer ${entry.label}`} className={squareClass()}>
            ✕
          </button>
        </span>
        <span className={`mn-punch min-w-28 text-right text-2xl sm:text-3xl ${AMOUNT[entry.kind]}`}>
          {formatSigned(amount)}
          {entry.kind === "savings" && <span className="block text-right text-xs tracking-wider">livret</span>}
          {entry.kind === "debt" && entry.category === "dette" && <span className="block text-right text-xs tracking-wider">à rendre</span>}
        </span>
      </span>
    </li>
  );
}
