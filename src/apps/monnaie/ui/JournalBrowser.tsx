"use client";

import { useMemo, useState } from "react";
import { formatSigned, signedAmount, type AccountNames, type Categories, type Entry } from "../money";
import { EntryList } from "./EntryList";
import { allCategoryOptions, Picker } from "./Picker";

const PAGE = 150;

/** The month's lines, filtered on the fly (text, category) and sorted, with the totals of what is shown. */
export function JournalBrowser({ entries, categories, names, labelCounts }: { entries: Entry[]; categories: Categories; names: AccountNames; labelCounts: Record<string, number> }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const words = query.trim().toLocaleUpperCase("fr-FR").split(/\s+/).filter(Boolean);
    const list = entries.filter((e) => {
      if (category && `${e.kind}:${e.category}` !== category) return false;
      const haystack = `${e.label} ${e.note} ${e.person ?? ""}`.toLocaleUpperCase("fr-FR");
      return words.every((w) => haystack.includes(w));
    });
    return sort === "amount" ? [...list].sort((a, b) => b.amount - a.amount) : list;
  }, [entries, query, category, sort]);

  const moneyIn = shown.reduce((n, e) => n + Math.max(signedAmount(e), 0), 0);
  const moneyOut = shown.reduce((n, e) => n + Math.min(signedAmount(e), 0), 0);
  const filtered = query !== "" || category !== "";
  // Only the categories that appear this month.
  const options = useMemo(() => {
    const used = new Set(entries.map((e) => `${e.kind}:${e.category}`));
    return allCategoryOptions(categories).filter((o) => used.has(o.value));
  }, [entries, categories]);

  return (
    <div className="grid gap-6">
      {/* z-20: the picker's list opens over the lines below. */}
      <div className="relative z-20 flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-[2]">
          <span className="sr-only">Chercher</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mn-ink)]">
            ⌕
          </span>
          <input
            value={query}
            onChange={(e) => (setQuery(e.target.value), setLimit(PAGE))}
            placeholder="Chercher : monoprix, uber, julien…"
            className="w-full !py-2 !pl-8 text-sm uppercase"
          />
        </label>
        <Picker
          ariaLabel="Catégorie"
          size="md"
          className="min-w-52 flex-1"
          value={category}
          onChange={setCategory}
          options={[{ value: "", label: "Toutes les catégories", emoji: "✱" }, ...options]}
        />
        <div className="flex border-2 border-[var(--mn-ink)] bg-white" role="group" aria-label="Trier par">
          {(
            [
              ["date", "Date"],
              ["amount", "Montant"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              aria-pressed={sort === key}
              className={`mn-punch px-3 pb-1.5 pt-2.5 text-sm transition ${sort === key ? "bg-[var(--mn-ink)] text-[var(--mn-accent)]" : "text-[var(--mn-ink)] hover:bg-zinc-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-[var(--mn-muted)]">
        <span>
          <b className="mn-punch text-lg text-white">{shown.length}</b> ligne{shown.length > 1 ? "s" : ""}
        </span>
        <span>
          entrées <b className="mn-punch text-lg text-white">{formatSigned(moneyIn)}</b>
        </span>
        <span>
          sorties <b className="mn-punch text-lg text-[var(--mn-accent)]">{formatSigned(moneyOut)}</b>
        </span>
        <span>
          net <b className="mn-punch text-lg text-white">{formatSigned(moneyIn + moneyOut)}</b>
        </span>
        {filtered && (
          <button
            type="button"
            onClick={() => (setQuery(""), setCategory(""), setLimit(PAGE))}
            className="ml-auto font-bold uppercase tracking-wider underline decoration-[var(--mn-accent)] decoration-2 underline-offset-4 hover:text-white"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {shown.length ? (
        <>
          <EntryList entries={shown.slice(0, limit)} categories={categories} names={names} labelCounts={labelCounts} />
          {shown.length > limit && (
            <div className="text-center">
              <button type="button" onClick={() => setLimit(limit + PAGE)} className="mn-punch mn-ghost text-2xl">
                Afficher {Math.min(PAGE, shown.length - limit)} de plus ({shown.length - limit} restantes)
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-[var(--mn-muted)]">Aucune ligne ne correspond.</p>
      )}
    </div>
  );
}
