"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { isTyping, playSound } from "@/components/console/sound";
import { CUSTOMIZABLE_KINDS, formatSigned, getCategory, lineCategoryLabel, monthName, monthShortName, signedAmount, type Categories, type Entry, type Kind, type SavingsAccount } from "../money";
import { deleteLines, editLines } from "../server/actions";
import { EntryDialog } from "./EntryDialog";
import { buttonClass } from "./kit";
import { useBusy } from "./motion";
import { allCategoryOptions, KIND_COLORS, Picker } from "./Picker";

const PAGE = 200;

const AMOUNT: Record<Kind, string> = {
  expense: "text-[var(--mn-accent)]",
  charge: "text-[var(--mn-muted)]",
  income: "text-white",
  savings: "text-[var(--mn-yellow)]",
  debt: "text-[var(--mn-red)]",
};

const shortDate = (date: string) => `${Number(date.slice(8))} ${monthShortName(date.slice(0, 7)).replace(".", "")} ${date.slice(2, 4)}`;

type Group = { label: string; ids: string[]; total: number; last: string; emojis: string[] };

/**
 * Every line of the ledger: search, filter, sort, then select (click, shift-click for a range, ⌘A for all) and act
 * on the selection: rename, reclassify, regret, delete. "Libellés" groups lines by name to rename one everywhere.
 */
export function LinesBrowser({ entries, categories, accounts }: { entries: Entry[]; categories: Categories; accounts: SavingsAccount[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [sort, setSort] = useState<"date" | "amount" | "label">("date");
  const [view, setView] = useState<"lines" | "labels">("lines");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<number | null>(null);
  // The bulk bar is fixed to the screen: it lives on <main>, outside the animated (transformed) page body.
  const root = useRef<HTMLDivElement>(null);
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => setHost(root.current?.closest("main") ?? null), []);

  const shown = useMemo(() => {
    const words = query.trim().toLocaleUpperCase("fr-FR").split(/\s+/).filter(Boolean);
    const list = entries.filter((e) => {
      if (category && `${e.kind}:${e.category}` !== category) return false;
      if (period && !e.date.startsWith(period)) return false;
      const haystack = `${e.label} ${e.note} ${e.person ?? ""}`.toLocaleUpperCase("fr-FR");
      return words.every((w) => haystack.includes(w));
    });
    if (sort === "amount") return [...list].sort((a, b) => b.amount - a.amount);
    if (sort === "label") return [...list].sort((a, b) => a.label.localeCompare(b.label) || b.date.localeCompare(a.date));
    return list;
  }, [entries, query, category, period, sort]);

  const groups = useMemo(() => {
    const byLabel = new Map<string, Group>();
    for (const e of shown) {
      const group = byLabel.get(e.label) ?? { label: e.label, ids: [], total: 0, last: e.date, emojis: [] };
      const emoji = getCategory(e.kind, e.category, categories).emoji;
      group.ids.push(e.id);
      group.total += signedAmount(e);
      if (e.date > group.last) group.last = e.date;
      if (!group.emojis.includes(emoji)) group.emojis.push(emoji);
      byLabel.set(e.label, group);
    }
    const list = [...byLabel.values()];
    if (sort === "amount") return list.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
    if (sort === "label") return list.sort((a, b) => a.label.localeCompare(b.label));
    return list.sort((a, b) => b.ids.length - a.ids.length || b.last.localeCompare(a.last));
  }, [shown, sort, categories]);

  // Only the categories and periods that appear in the ledger.
  const categoryOptions = useMemo(() => {
    const used = new Set(entries.map((e) => `${e.kind}:${e.category}`));
    return allCategoryOptions(categories).filter((o) => used.has(o.value));
  }, [entries, categories]);
  const periodOptions = useMemo(() => {
    const months = [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse();
    return months.flatMap((m, i) => [
      ...(i === 0 || months[i - 1].slice(0, 4) !== m.slice(0, 4)) ? [{ value: m.slice(0, 4), label: `Toute l'année ${m.slice(0, 4)}`, group: m.slice(0, 4) }] : [],
      { value: m, label: `${monthName(m)} ${m.slice(0, 4)}`, group: m.slice(0, 4) },
    ]);
  }, [entries]);

  const selection = entries.filter((e) => selected.has(e.id));
  const sum = (list: Entry[]) => list.reduce((n, e) => n + signedAmount(e), 0);
  const filtered = query !== "" || category !== "" || period !== "";
  const resetPage = () => setLimit(PAGE);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  // Shift-click selects (or unselects) the whole range since the last click.
  const clickRow = (index: number, shift: boolean) => {
    const id = shown[index].id;
    const on = !selected.has(id);
    if (shift && anchor.current !== null) {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      toggle(shown.slice(from, to + 1).map((e) => e.id), on);
    } else toggle([id], on);
    anchor.current = index;
  };
  const allShown = shown.length > 0 && shown.every((e) => selected.has(e.id));
  const selectAll = () => {
    playSound("select");
    toggle(shown.map((e) => e.id), !allShown);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.key === "Escape" && selected.size) setSelected(new Set());
      if (event.key === "a" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSelected(new Set(shown.map((e) => e.id)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div ref={root} className="grid gap-6 pb-28">
      {/* z-20: the pickers' lists open over the lines below. */}
      <div className="relative z-20 flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-[2]">
          <span className="sr-only">Chercher</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mn-ink)]">
            ⌕
          </span>
          <input value={query} onChange={(e) => (setQuery(e.target.value), resetPage())} placeholder="Chercher : uber, loyer, julien…" className="w-full !py-2 !pl-8 text-sm uppercase" />
        </label>
        <Picker
          ariaLabel="Catégorie"
          className="min-w-52 flex-1"
          value={category}
          onChange={(v) => (setCategory(v), resetPage())}
          options={[{ value: "", label: "Toutes les catégories", emoji: "✱" }, ...categoryOptions]}
        />
        <Picker
          ariaLabel="Période"
          className="min-w-48 flex-1"
          value={period}
          onChange={(v) => (setPeriod(v), resetPage())}
          options={[{ value: "", label: "Depuis toujours", emoji: "∞" }, ...periodOptions]}
        />
        <Segmented
          label="Trier par"
          value={sort}
          onChange={setSort}
          options={[
            ["date", "Date"],
            ["amount", "Montant"],
            ["label", "Nom"],
          ]}
        />
        <Segmented
          label="Vue"
          value={view}
          onChange={setView}
          options={[
            ["lines", "Lignes"],
            ["labels", "Libellés"],
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--mn-muted)]">
        <button type="button" onClick={selectAll} className="flex items-center gap-2 font-bold uppercase tracking-wider hover:text-white" disabled={!shown.length}>
          <Check on={allShown} partial={!allShown && shown.some((e) => selected.has(e.id))} />
          {allShown ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        <span>
          <b className="mn-punch text-lg text-white">{shown.length}</b> ligne{shown.length > 1 ? "s" : ""}
          {view === "labels" && (
            <>
              {" "}
              · <b className="mn-punch text-lg text-white">{groups.length}</b> libellé{groups.length > 1 ? "s" : ""}
            </>
          )}
        </span>
        <span>
          net <b className="mn-punch text-lg text-white">{formatSigned(sum(shown))}</b>
        </span>
        {filtered && (
          <button
            type="button"
            onClick={() => (setQuery(""), setCategory(""), setPeriod(""), resetPage())}
            className="ml-auto font-bold uppercase tracking-wider underline decoration-[var(--mn-accent)] decoration-2 underline-offset-4 hover:text-white"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {!shown.length ? (
        <p className="py-10 text-center text-[var(--mn-muted)]">Aucune ligne ne correspond.</p>
      ) : view === "lines" ? (
        <>
          <ul className="divide-y divide-white/5 border-y-2 border-white/10">
            {shown.slice(0, limit).map((entry, index) => {
              const cat = getCategory(entry.kind, entry.category, categories);
              const on = selected.has(entry.id);
              return (
                <li
                  key={entry.id}
                  className={`group grid grid-cols-[auto_1.75rem_minmax(0,1fr)_auto] items-center gap-3 border-l-4 px-3 py-2 transition-colors sm:grid-cols-[auto_5rem_1.75rem_minmax(0,1fr)_12rem_auto] ${on ? "border-[var(--mn-accent)] bg-[color-mix(in_srgb,var(--mn-accent)_14%,transparent)]" : "border-transparent hover:bg-white/5"}`}
                >
                  <button type="button" onClick={(e) => clickRow(index, e.shiftKey)} aria-label={`${on ? "Désélectionner" : "Sélectionner"} ${entry.label}`} className="p-1">
                    <Check on={on} />
                  </button>
                  <span className="hidden text-sm font-bold text-[var(--mn-muted)] sm:block">{shortDate(entry.date)}</span>
                  <span className="text-center text-lg" aria-hidden>
                    {cat.emoji}
                  </span>
                  <EntryDialog
                    categories={categories}
                    accounts={accounts}
                    sameLabel={entries.filter((e) => e.label === entry.label).length}
                    defaultDate={entry.date}
                    entry={entry}
                    trigger={
                      <span className="block min-w-0">
                        <span className="block truncate font-bold decoration-[var(--mn-accent)] decoration-2 underline-offset-4 group-hover:underline">
                          {entry.label}
                          {entry.regret && <span className="ml-2 text-xs text-[var(--mn-red)]">REGRET</span>}
                        </span>
                        <span className="block truncate text-xs text-[var(--mn-muted)] empty:hidden">
                          <span className="sm:hidden">{shortDate(entry.date)} · {lineCategoryLabel(entry, categories, accounts)}</span>
                          {(entry.note || entry.person) && <span className="max-sm:before:content-['_·_']">{[entry.person, entry.note].filter(Boolean).join(" · ")}</span>}
                        </span>
                      </span>
                    }
                  />
                  <span className="hidden items-center gap-2 truncate text-sm text-[var(--mn-muted)] sm:flex">
                    <span className="h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: KIND_COLORS[entry.kind] }} aria-hidden />
                    <span className="truncate">{lineCategoryLabel(entry, categories, accounts)}</span>
                  </span>
                  <span className={`mn-punch min-w-24 text-right text-xl ${AMOUNT[entry.kind]}`}>{formatSigned(signedAmount(entry))}</span>
                </li>
              );
            })}
          </ul>
          {shown.length > limit && (
            <div className="text-center">
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="mn-punch mn-ghost text-2xl">
                Afficher {Math.min(PAGE, shown.length - limit)} de plus ({shown.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <ul className="divide-y divide-white/5 border-y-2 border-white/10">
          {groups.map((g) => {
            const count = g.ids.filter((id) => selected.has(id)).length;
            const on = count === g.ids.length;
            return (
              <li
                key={g.label}
                className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-l-4 px-3 py-2.5 transition-colors ${count ? "border-[var(--mn-accent)] bg-[color-mix(in_srgb,var(--mn-accent)_14%,transparent)]" : "border-transparent hover:bg-white/5"}`}
              >
                <button type="button" onClick={() => toggle(g.ids, !on)} aria-label={`${on ? "Désélectionner" : "Sélectionner"} les lignes ${g.label}`} className="p-1">
                  <Check on={on} partial={count > 0 && !on} />
                </button>
                <button type="button" onClick={() => toggle(g.ids, !on)} className="min-w-0 text-left">
                  <span className="block truncate font-bold">
                    <span className="mr-2" aria-hidden>
                      {g.emojis.join("")}
                    </span>
                    {g.label}
                  </span>
                  <span className="block text-xs text-[var(--mn-muted)]">
                    {g.ids.length} ligne{g.ids.length > 1 ? "s" : ""} · dernière le {shortDate(g.last)}
                  </span>
                </button>
                <span className="mn-punch text-right text-xl">{formatSigned(g.total)}</span>
              </li>
            );
          })}
        </ul>
      )}

      {selection.length > 0 &&
        host &&
        createPortal(<BulkBar key={[...selected].join()} selection={selection} categories={categories} total={sum(selection)} onClear={() => setSelected(new Set())} />, host)}
    </div>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex border-2 border-[var(--mn-ink)] bg-white" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`mn-punch px-3 pb-1.5 pt-2.5 text-sm transition ${value === key ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : "text-[var(--mn-ink)] hover:bg-zinc-100"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Check({ on, partial = false }: { on: boolean; partial?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-5 w-5 items-center justify-center border-2 text-xs font-black transition ${on || partial ? "-rotate-6 border-[var(--mn-ink)] bg-[var(--mn-accent)] text-[var(--mn-ink)] shadow-[2px_2px_0_var(--mn-ink)]" : "border-white/40"}`}
    >
      {on ? "✓" : partial ? "–" : ""}
    </span>
  );
}

const editable = (CUSTOMIZABLE_KINDS as readonly Kind[]).map(String);

/** Bar stuck to the bottom while lines are selected: what is selected and what to do with it. */
function BulkBar({ selection, categories, total, onClear }: { selection: Entry[]; categories: Categories; total: number; onClear: () => void }) {
  const labels = [...new Set(selection.map((e) => e.label))];
  const [mode, setMode] = useState<"none" | "rename" | "delete">("none");
  const [name, setName] = useState(labels.length === 1 ? labels[0] : "");
  const [learn, setLearn] = useState(true);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  useBusy(pending);
  const ids = selection.map((e) => e.id);
  const allExpense = selection.every((e) => e.kind === "expense");
  const allRegret = allExpense && selection.every((e) => e.regret);

  const run = (change: () => Promise<{ error?: string; changed?: number }>, done: (n: number) => string) =>
    startTransition(async () => {
      const result = await change();
      if (result.error) {
        playSound("back");
        setMessage({ text: result.error, error: true });
      } else {
        playSound("select");
        setMessage({ text: done(result.changed ?? 0) });
        setMode("none");
      }
    });
  const plural = (n: number) => (n > 1 ? "s" : "");

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div
        className={`mn-drop flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-3 border-[3px] border-[var(--mn-ink)] bg-white px-4 py-3 text-[var(--mn-ink)] shadow-[6px_6px_0_var(--mn-ink)] ${pending ? "mn-pending" : ""}`}
        style={{ "--mn-tilt": "-0.4deg" } as React.CSSProperties}
        aria-busy={pending}
      >
        <span className="mr-auto leading-tight">
          <span className="mn-punch block text-xl">
            {selection.length} ligne{plural(selection.length)} · {formatSigned(total)}
          </span>
          <span className={`block text-xs font-semibold ${message?.error ? "text-[var(--mn-red)]" : "text-zinc-500"}`}>
            {message?.text ?? (labels.length === 1 ? labels[0] : `${labels.length} libellés différents`)}
          </span>
        </span>

        {mode === "rename" ? (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => editLines(ids, { label: name }, learn), (n) => `${n} ligne${plural(n)} renommée${plural(n)} en ${name.toLocaleUpperCase("fr-FR")}.`);
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouveau nom" className="w-56 !py-1.5 text-sm uppercase" aria-label="Nouveau nom" />
            <button type="submit" disabled={pending || !name.trim()} className={buttonClass("accent", "sm")}>
              <span>Renommer</span>
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-sm font-bold underline">
              Annuler
            </button>
          </form>
        ) : mode === "delete" ? (
          <span className="flex items-center gap-3">
            <span className="text-sm font-bold">Supprimer {selection.length} ligne{plural(selection.length)} ?</span>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteLines(ids);
                  playSound("back");
                  onClear();
                })
              }
              className="mn-punch border-2 border-[var(--mn-ink)] bg-[var(--mn-red)] px-3 pb-1 pt-2 text-sm text-white shadow-[3px_3px_0_var(--mn-ink)]"
            >
              Oui, supprimer
            </button>
            <button type="button" onClick={() => setMode("none")} className="text-sm font-bold underline">
              Non
            </button>
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMode("rename")} className={buttonClass("dark", "sm")}>
              <span>Renommer</span>
            </button>
            <Picker
              up
              ariaLabel="Changer la catégorie"
              placeholder="Catégorie…"
              className="w-48"
              value=""
              onChange={(v) => {
                const [kind, category] = v.split(":");
                const cat = getCategory(kind as Kind, category, categories);
                run(() => editLines(ids, { kind, category }, learn), (n) => `${n} ligne${plural(n)} passée${plural(n)} en ${cat.emoji} ${cat.label}.`);
              }}
              options={allCategoryOptions(categories).filter((o) => editable.includes(o.value.split(":")[0]))}
            />
            {allExpense && (
              <button
                type="button"
                onClick={() => run(() => editLines(ids, { regret: !allRegret }, false), (n) => `${n} ligne${plural(n)} ${allRegret ? "assumée" : "regrettée"}${plural(n)}.`)}
                className="mn-punch border-2 border-[var(--mn-ink)] px-3 pb-1 pt-2 text-sm hover:shadow-[3px_3px_0_var(--mn-ink)]"
              >
                😬 {allRegret ? "J'assume" : "Regret"}
              </button>
            )}
            <button type="button" onClick={() => setMode("delete")} className="mn-punch border-2 border-[var(--mn-red)] px-3 pb-1 pt-2 text-sm text-[var(--mn-red)] hover:bg-[var(--mn-red)] hover:text-white">
              Supprimer
            </button>
          </span>
        )}

        <span className="flex items-center gap-4 border-l-2 border-dashed border-zinc-200 pl-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500" title="Le nom et la catégorie seront repris aux prochains imports bancaires">
            <input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} className="h-4 w-4 accent-[var(--mn-accent)]" />
            Retenir pour l&apos;import
          </label>
          <button type="button" onClick={onClear} className="text-sm font-bold text-zinc-500 hover:text-[var(--mn-ink)]" title="Échap">
            ✕ Désélectionner
          </button>
        </span>
      </div>
    </div>
  );
}
