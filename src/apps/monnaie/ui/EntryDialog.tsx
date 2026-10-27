"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { isTyping, playSound } from "@/components/console/sound";
import { amountInput, type Categories, type Entry, type Kind } from "../money";

const TITLES: Record<Kind, string> = { expense: "J'ai cramé…", charge: "J'ai payé…", income: "J'ai encaissé…", savings: "Épargne…", debt: "Dette…" };
const TABS: Record<Kind, string> = { expense: "Plaisir", charge: "Charge", savings: "Épargne", debt: "Dette", income: "Revenu" };
const PLACEHOLDERS: Record<Kind, string> = {
  expense: "Burger du vendredi",
  charge: "Loyer d'octobre",
  income: "Salaire d'octobre",
  savings: "Virement livret A",
  debt: "Place de concert",
};
import { saveEntry } from "../server/actions";
import { buttonClass, squareClass } from "./kit";

const labelClass = "grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500";

/**
 * Add (or edit, with `entry`) a line of any kind. The add button also opens with the X key.
 * `trigger` replaces the default button; `people` feeds the name suggestions of debts.
 */
export function EntryDialog({
  defaultDate,
  entry,
  trigger,
  hotkey = false,
  people = [],
  categories,
  sameLabel = 0,
}: {
  /** Lines with the same label (this one included): offers to reclassify them all. */
  sameLabel?: number;
  /** Built-in and user categories (categoriesOf(ledger)). */
  categories: Categories;
  defaultDate: string;
  entry?: Entry;
  trigger?: ReactNode;
  hotkey?: boolean;
  people?: string[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(saveEntry, {});
  const [kind, setKind] = useState<Kind>(entry?.kind ?? "expense");
  // Set after a new entry is saved: the next opening starts again from an expense.
  const saved = useRef(false);

  const open = () => {
    if (saved.current) {
      saved.current = false;
      setKind("expense");
    }
    playSound("select");
    dialog.current?.showModal();
  };

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isTyping(event) && (event.key === "x" || event.key === "X")) open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Close after a successful save; a new entry form starts empty again.
  useEffect(() => {
    if (!state.ok) return;
    dialog.current?.close();
    if (!entry) {
      form.current?.reset();
      saved.current = true;
    }
  }, [state.ok, entry]);

  return (
    <>
      <button type="button" onClick={open} className={trigger ? "min-w-0 flex-1 text-left" : buttonClass()}>
        {trigger ?? <span>+ Ajouter</span>}
      </button>
      <dialog ref={dialog} className="m-auto w-[min(34rem,94vw)] bg-transparent p-0">
        <div className="mn-shape mn-paper p-7 sm:p-9">
          <form ref={form} action={action} className="grid gap-5">
            {entry && <input type="hidden" name="id" value={entry.id} />}
            <div className="flex items-start justify-between">
              <h2 className="mn-punch text-5xl">{entry ? "Modifier" : TITLES[kind]}</h2>
              <button type="button" onClick={() => dialog.current?.close()} className={squareClass(true)} aria-label="Fermer">
                ✕
              </button>
            </div>

            <fieldset className="grid grid-cols-5 border-[3px] border-[var(--mn-ink)]">
              <legend className="sr-only">Type</legend>
              {(Object.keys(TABS) as Kind[]).map((k) => (
                <label key={k} className={`mn-punch cursor-pointer px-1 py-3 text-center text-sm sm:text-base ${kind === k ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : ""}`}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  {TABS[k]}
                </label>
              ))}
            </fieldset>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className={labelClass}>
                Quoi
                <input name="label" required maxLength={80} defaultValue={entry?.label} placeholder={PLACEHOLDERS[kind]} className="uppercase" />
              </label>
              <label className={labelClass}>
                Montant €
                <input name="amount" required inputMode="decimal" defaultValue={entry ? amountInput(entry.amount) : ""} placeholder="12,50" className="w-32" />
              </label>
            </div>

            {kind === "debt" && (
              <label className={labelClass}>
                Avec qui
                <input name="person" required maxLength={60} defaultValue={entry?.person} placeholder="Julien" list="mn-people" autoComplete="off" />
                <datalist id="mn-people">
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>
            )}

            <fieldset className="grid gap-2">
              <legend className={`${labelClass} mb-1.5`}>Catégorie</legend>
              <div className="flex flex-wrap gap-2">
                {categories[kind].map((c, i) => (
                  <label key={`${kind}-${c.id}`} className="cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      required
                      defaultChecked={entry?.kind === kind ? entry.category === c.id : i === 0}
                      className="peer sr-only"
                    />
                    <span className="inline-block border-2 border-[var(--mn-ink)] px-3 py-1.5 text-sm font-bold transition peer-checked:-rotate-2 peer-checked:bg-[var(--mn-accent)] peer-checked:shadow-[3px_3px_0_var(--mn-ink)] peer-focus-visible:outline peer-focus-visible:outline-2">
                      {c.emoji} {c.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-[auto_1fr] gap-3">
              <label className={labelClass}>
                Date
                <input type="date" name="date" required defaultValue={entry?.date ?? defaultDate} />
              </label>
              <label className={labelClass}>
                Note (optionnel)
                <input name="note" maxLength={500} defaultValue={entry?.note} placeholder="Avec qui, pourquoi…" />
              </label>
            </div>

            {kind === "expense" && (
              <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
                <input type="checkbox" name="regret" defaultChecked={entry?.regret} className="h-5 w-5 accent-[var(--mn-ink)]" />
                Je regrette déjà 😬
              </label>
            )}
            {entry && sameLabel > 1 && (kind === "expense" || kind === "charge" || kind === "income") && (
              <label className="flex cursor-pointer items-start gap-3 border-2 border-dashed border-[var(--mn-ink)] p-3 text-sm font-bold">
                <input type="checkbox" name="applyAll" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--mn-accent)]" />
                <span>
                  Appliquer ce type et cette catégorie aux {sameLabel} lignes « {entry.label} »
                  <span className="block font-semibold text-zinc-500">et aux prochains imports</span>
                </span>
              </label>
            )}

            {state.error && <p className="border-l-4 border-[var(--mn-red)] pl-3 text-sm font-bold text-[var(--mn-red)]">{state.error}</p>}
            <div className="flex justify-end">
              <button disabled={pending} className={buttonClass()}>
                <span>{pending ? "…" : entry ? "Enregistrer" : "Envoie ▸"}</span>
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
