"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { amountInput, CATEGORIES, KIND_LABELS, type Kind, type Settings } from "../money";
import { createGoal, createRecurring, moveMoney, removeGoal, updateSettings, type FormState } from "../server/actions";
import { buttonClass, squareClass } from "./kit";

const labelClass = "grid gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500";

/** Form wired to a Server Action: shows its message or error, and empties itself after a success. */
function ActionForm({
  action,
  children,
  className = "",
  reset = true,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: (pending: boolean) => ReactNode;
  className?: string;
  reset?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && reset) form.current?.reset();
  }, [state.ok, reset]);
  return (
    <form ref={form} action={formAction} className={className}>
      {children(pending)}
      {(state.error || state.message) && (
        <p className={`col-span-full text-sm font-bold ${state.error ? "text-[var(--mn-red)]" : "text-[var(--mn-ink)]"}`} role="status">
          {state.error ?? state.message}
        </p>
      )}
    </form>
  );
}

export function NewGoalForm() {
  return (
    <ActionForm action={createGoal} className="grid gap-4 sm:grid-cols-[5rem_1fr_9rem_auto] sm:items-end">
      {(pending) => (
        <>
          <label className={labelClass}>
            Emoji
            <input name="emoji" maxLength={16} placeholder="🎯" className="w-full text-center" />
          </label>
          <label className={labelClass}>
            Objectif
            <input name="name" required maxLength={60} placeholder="Voyage au Japon" />
          </label>
          <label className={labelClass}>
            Cible €
            <input name="target" required inputMode="decimal" placeholder="2 000" />
          </label>
          <button disabled={pending} className={buttonClass()}>
            <span>Créer</span>
          </button>
        </>
      )}
    </ActionForm>
  );
}

/** Put money in or take it out of a goal. */
export function GoalMoneyForm({ id }: { id: string }) {
  return (
    <ActionForm action={moveMoney.bind(null, id)} className="grid grid-cols-[1fr_auto_auto] gap-2">
      {(pending) => (
        <>
          <input name="amount" required inputMode="decimal" placeholder="50" aria-label="Montant" className="min-w-0" />
          <button name="direction" value="in" disabled={pending} className={`${buttonClass("accent", "sm")} !min-w-0 !px-4`} title="Mettre de côté">
            <span>+ Ranger</span>
          </button>
          <button name="direction" value="out" disabled={pending} className={`${buttonClass("dark", "sm")} !min-w-0 !px-4`} title="Reprendre">
            <span>− Piocher</span>
          </button>
        </>
      )}
    </ActionForm>
  );
}

export function DeleteGoalButton({ id, name }: { id: string; name: string }) {
  return (
    <button
      onClick={async () => {
        if (confirm(`Supprimer l'objectif « ${name} » ?`)) await removeGoal(id);
      }}
      className={squareClass(true)}
      aria-label={`Supprimer ${name}`}
    >
      ✕
    </button>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  return (
    <ActionForm action={updateSettings} reset={false} className="grid gap-5">
      {(pending) => (
        <>
          <label className={labelClass}>
            Budget plaisir / mois (€)
            <input name="monthlyBudget" inputMode="decimal" defaultValue={amountInput(settings.monthlyBudget)} placeholder="300" />
            <span className="text-xs font-semibold normal-case tracking-normal text-zinc-500">Le max que tu t&apos;autorises en dépenses pas nécessaires. Vide = pas de budget.</span>
          </label>
          <label className={labelClass}>
            Solde du livret au départ (€)
            <input name="savingsStart" inputMode="decimal" defaultValue={amountInput(settings.savingsStart)} placeholder="2 500" />
            <span className="text-xs font-semibold normal-case tracking-normal text-zinc-500">
              Ce qu&apos;il y avait sur ton livret avant ta première ligne « Livret » ici. Les virements font évoluer le solde.
            </span>
          </label>
          <p className="text-sm text-zinc-600">
            Les charges (loyer, électricité, eau, gaz, assurances…) ne comptent pas dans ce budget : ajoute-les en lignes « Charge », ou en récurrents juste à côté.
          </p>
          <div>
            <button disabled={pending} className={buttonClass()}>
              <span>Enregistrer</span>
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function RecurringForm() {
  // Debts are one-off (they need a person): not offered as recurring.
  const [kind, setKind] = useState<Exclude<Kind, "debt">>("income");
  return (
    <ActionForm action={createRecurring} className="grid gap-4 sm:grid-cols-2">
      {(pending) => (
        <>
          <label className={labelClass}>
            Type
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as Exclude<Kind, "debt">)}>
              {(["income", "charge", "savings", "expense"] as const).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Catégorie
            <select key={kind} name="category" required>
              {CATEGORIES[kind].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Nom
            <input name="label" required maxLength={80} placeholder={{ income: "Salaire", charge: "Loyer", savings: "Virement livret A", expense: "Netflix" }[kind]} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Montant €
              <input name="amount" required inputMode="decimal" placeholder="2 100" className="min-w-0" />
            </label>
            <label className={labelClass}>
              Le
              <input name="day" type="number" required min={1} max={28} defaultValue={1} className="min-w-0" />
            </label>
          </div>
          <div className="col-span-full">
            <button disabled={pending} className={buttonClass()}>
              <span>Ajouter</span>
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
