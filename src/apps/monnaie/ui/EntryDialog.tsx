"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { isTyping, playSound } from "@/components/console/sound";
import { amountInput, CATEGORIES, type Entry, type Kind } from "../money";
import { saveEntry } from "../server/actions";
import { buttonClass, squareClass } from "./kit";

const labelClass = "grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500";

/**
 * Add (or edit, with `entry`) an income or an expense. The add button also opens with the X key.
 * `trigger` replaces the default button.
 */
export function EntryDialog({ defaultDate, entry, trigger, hotkey = false }: { defaultDate: string; entry?: Entry; trigger?: ReactNode; hotkey?: boolean }) {
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
              <h2 className="mn-punch text-5xl">{entry ? "Modifier" : kind === "expense" ? "J'ai cramé…" : "J'ai encaissé…"}</h2>
              <button type="button" onClick={() => dialog.current?.close()} className={squareClass(true)} aria-label="Fermer">
                ✕
              </button>
            </div>

            <fieldset className="grid grid-cols-2 border-[3px] border-[var(--mn-ink)]">
              <legend className="sr-only">Type</legend>
              {(["expense", "income"] as const).map((k) => (
                <label key={k} className={`mn-punch cursor-pointer py-3 text-center text-lg ${kind === k ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : ""}`}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  {k === "expense" ? "Dépense plaisir" : "Revenu"}
                </label>
              ))}
            </fieldset>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <label className={labelClass}>
                Quoi
                <input name="label" required maxLength={80} defaultValue={entry?.label} placeholder={kind === "expense" ? "Burger du vendredi" : "Salaire d'octobre"} />
              </label>
              <label className={labelClass}>
                Montant €
                <input name="amount" required inputMode="decimal" defaultValue={entry ? amountInput(entry.amount) : ""} placeholder="12,50" className="w-32" />
              </label>
            </div>

            <fieldset className="grid gap-2">
              <legend className={`${labelClass} mb-1.5`}>Catégorie</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES[kind].map((c, i) => (
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
