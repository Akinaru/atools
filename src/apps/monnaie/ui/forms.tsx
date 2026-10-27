"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { amountInput, CUSTOMIZABLE_KINDS, type Categories, type Category, type Kind, type Settings } from "../money";
import { createCategory, createCheckpoint, updateCategoryBudgets, createGoal, createRecurring, moveMoney, removeGoal, restoreBackup, updateSettings, type FormState } from "../server/actions";
import { buttonClass, squareClass } from "./kit";
import { categoryOptions, kindOptions, Picker } from "./Picker";

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
              Ce qu&apos;il y avait sur ton livret avant ta première ligne « Épargne » ici. Les virements font évoluer le solde.
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

export function RecurringForm({ categories }: { categories: Categories }) {
  // Debts are one-off (they need a person): not offered as recurring.
  const [kind, setKind] = useState<Exclude<Kind, "debt">>("income");
  const [category, setCategory] = useState(categories.income[0].id);
  return (
    <ActionForm action={createRecurring} className="grid gap-4 sm:grid-cols-2">
      {(pending) => (
        <>
          <div className={labelClass}>
            Type
            <Picker
              ariaLabel="Type"
              name="kind"
              value={kind}
              onChange={(v) => {
                setKind(v as Exclude<Kind, "debt">);
                setCategory(categories[v as Kind][0].id);
              }}
              options={kindOptions(["income", "charge", "savings", "expense"])}
            />
          </div>
          <div className={labelClass}>
            Catégorie
            <Picker ariaLabel="Catégorie" name="category" value={category} onChange={setCategory} options={categoryOptions(categories[kind])} />
          </div>
          <label className={labelClass}>
            Nom
            <input name="label" required maxLength={80} placeholder={{ income: "Salaire", charge: "Loyer", savings: "Virement livret A", expense: "Netflix" }[kind]} className="uppercase" />
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

/** Replaces all the data with a backup file, after an explicit confirmation. */
export function RestoreForm() {
  return (
    <ActionForm action={restoreBackup} className="grid gap-4">
      {(pending) => (
        <>
          <input
            type="file"
            name="file"
            accept=".json,application/json"
            required
            className="text-sm font-semibold text-zinc-300 file:mr-3 file:border-2 file:border-white/30 file:bg-transparent file:px-4 file:py-2 file:font-bold file:text-zinc-200"
          />
          <label className="flex items-center gap-3 text-sm font-bold text-[var(--mn-red)]">
            <input type="checkbox" name="confirm" className="h-5 w-5 accent-[var(--mn-red)]" />
            Je remplace toutes les données actuelles par cette sauvegarde
          </label>
          <div>
            <button disabled={pending} className={buttonClass("dark", "sm")}>
              <span>Restaurer</span>
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** Records the real balance read in the bank app. `today` is YYYY-MM-DD. */
export function CheckpointForm({ today }: { today: string }) {
  return (
    <ActionForm action={createCheckpoint} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      {(pending) => (
        <>
          <label className={labelClass}>
            Solde lu dans l&apos;appli bancaire (€)
            <input name="balance" required inputMode="decimal" placeholder="1 250,40 (ou -80)" />
          </label>
          <label className={labelClass}>
            Au soir du
            <input type="date" name="date" required defaultValue={today} />
          </label>
          <button disabled={pending} className={buttonClass()}>
            <span>Pointer</span>
          </button>
        </>
      )}
    </ActionForm>
  );
}

/** New category, with keywords that move the matching lines and feed the next imports. */
export function CategoryForm() {
  const [kind, setKind] = useState<Kind>("expense");
  return (
    <ActionForm action={createCategory} className="grid gap-4 sm:grid-cols-[9rem_5rem_1fr] sm:items-end">
      {(pending) => (
        <>
          <div className={labelClass}>
            Type
            <Picker ariaLabel="Type" name="kind" value={kind} onChange={(v) => setKind(v as Kind)} options={kindOptions(CUSTOMIZABLE_KINDS)} />
          </div>
          <label className={labelClass}>
            Emoji
            <input name="emoji" maxLength={16} placeholder="🖥️" className="w-full text-center" />
          </label>
          <label className={labelClass}>
            Nom
            <input name="label" required maxLength={30} placeholder="Domaine & VPS" />
          </label>
          <label className={`${labelClass} sm:col-span-3`}>
            Mots-clés (optionnel, séparés par des virgules)
            <input name="keywords" maxLength={300} placeholder="CONTABO, OVH" className="uppercase" />
            <span className="text-xs font-semibold normal-case tracking-normal text-zinc-500">
              Les lignes dont le libellé contient un de ces mots passent dans cette catégorie, et les prochains imports aussi.
            </span>
          </label>
          <div>
            <button disabled={pending} className={buttonClass()}>
              <span>Créer</span>
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

/** One budget field per plaisir category; empty = no budget. */
export function CategoryBudgetsForm({ categories, budgets }: { categories: Category[]; budgets: Record<string, number> }) {
  return (
    <ActionForm action={updateCategoryBudgets} reset={false} className="grid gap-4">
      {(pending) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className="grid grid-cols-[1fr_7rem] items-center gap-3 text-sm font-bold text-zinc-300">
                <span className="truncate">
                  {c.emoji} {c.label}
                </span>
                <input name={`budget-${c.id}`} inputMode="decimal" defaultValue={amountInput(budgets[c.id] ?? 0)} placeholder="—" className="!py-1.5 text-right" />
              </label>
            ))}
          </div>
          <div>
            <button disabled={pending} className={buttonClass("accent", "sm")}>
              <span>Enregistrer</span>
            </button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
