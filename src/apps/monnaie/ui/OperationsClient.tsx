"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { formatSigned, signedAmount, type Categories, type Entry } from "../money";
import { EntryList } from "./EntryList";
import { allCategoryOptions, Picker } from "./Picker";

const PAGE = 150;
const fieldClass = "!px-2 !py-1.5 text-sm";
const labelClass = "grid gap-1 text-xs font-bold uppercase tracking-wider text-[#6b6e80]";

/**
 * Lines filtered on the fly (text, type, category, and the period unless `periods` is false), with the totals of
 * what is shown. `embedded` drops the outer cards, to sit inside a panel (the month's journal).
 */
export function OperationsClient({
  entries,
  categories,
  labelCounts: givenCounts,
  periods = true,
  embedded = false,
}: {
  entries: Entry[];
  categories: Categories;
  /** Lines per label over all the data (defaults to the given entries). */
  labelCounts?: Record<string, number>;
  periods?: boolean;
  embedded?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [limit, setLimit] = useState(PAGE);

  const labelCounts = useMemo(() => {
    if (givenCounts) return givenCounts;
    const counts: Record<string, number> = {};
    for (const e of entries) counts[e.label] = (counts[e.label] ?? 0) + 1;
    return counts;
  }, [entries, givenCounts]);

  const shown = useMemo(() => {
    const words = query.trim().toLocaleUpperCase("fr-FR").split(/\s+/).filter(Boolean);
    const list = entries.filter((e) => {
      if (category && `${e.kind}:${e.category}` !== category) return false;
      if (from && e.date.slice(0, 7) < from) return false;
      if (to && e.date.slice(0, 7) > to) return false;
      const haystack = `${e.label} ${e.note} ${e.person ?? ""}`.toLocaleUpperCase("fr-FR");
      return words.every((w) => haystack.includes(w));
    });
    return sort === "amount" ? [...list].sort((a, b) => b.amount - a.amount) : list;
  }, [entries, query, category, from, to, sort]);

  const moneyIn = shown.reduce((n, e) => n + Math.max(signedAmount(e), 0), 0);
  const moneyOut = shown.reduce((n, e) => n + Math.min(signedAmount(e), 0), 0);
  const reset = () => {
    setQuery("");
    setCategory("");
    setFrom("");
    setTo("");
    setLimit(PAGE);
  };

  return (
    <div className={embedded ? "grid gap-6" : "grid gap-8"}>
      {/* z-20: the pickers' lists open over the results below. */}
      <div className={embedded ? "relative z-20 grid gap-4 border-2 border-dashed border-white/15 p-4" : "mn-shape mn-paper relative z-20 grid gap-4 p-6 sm:p-8"}>
        <div className={`grid gap-3 ${periods ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_8.5rem_8.5rem_9rem]" : "md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_9rem]"}`}>
          <label className={labelClass}>
            Chercher
            <input value={query} onChange={(e) => (setQuery(e.target.value), setLimit(PAGE))} placeholder="MONOPRIX, uber, Julien…" className={`${fieldClass} uppercase`} autoFocus={!embedded} />
          </label>
          <div className={labelClass}>
            Catégorie
            <Picker
              ariaLabel="Catégorie"
              size="sm"
              value={category}
              onChange={setCategory}
              options={[{ value: "", label: "Toutes", emoji: "✱" }, ...allCategoryOptions(categories)]}
            />
          </div>
          {periods && (
            <>
            <label className={labelClass}>
              Depuis
              <input type="month" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Jusqu&apos;à
              <input type="month" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
            </label>
            </>
          )}
          <div className={labelClass}>
            Trier par
            <Picker
              ariaLabel="Trier par"
              size="sm"
              value={sort}
              onChange={(v) => setSort(v as "date" | "amount")}
              options={[
                { value: "date", label: "Date", emoji: "📅" },
                { value: "amount", label: "Montant", emoji: "💶" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-dashed border-zinc-200 pt-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <Stat label="Lignes" value={String(shown.length)} />
            <Stat label="Entrées" value={formatSigned(moneyIn)} />
            <Stat label="Sorties" value={formatSigned(moneyOut)} />
            <Stat label="Net" value={formatSigned(moneyIn + moneyOut)} strong />
          </div>
          <button type="button" onClick={reset} className="text-sm font-bold uppercase tracking-wider text-zinc-500 underline decoration-[var(--mn-accent)] decoration-2 underline-offset-4">
            Tout effacer
          </button>
        </div>
      </div>

      <section className={embedded ? "" : "mn-shape p-6 sm:p-8"} style={embedded ? undefined : ({ "--mn-shape": "var(--mn-panel)" } as CSSProperties)}>
        {shown.length ? (
          <>
            <EntryList entries={shown.slice(0, limit)} categories={categories} labelCounts={labelCounts} />
            {shown.length > limit && (
              <div className="mt-8 text-center">
                <button type="button" onClick={() => setLimit(limit + PAGE)} className="mn-punch mn-ghost text-2xl">
                  Afficher {Math.min(PAGE, shown.length - limit)} de plus ({shown.length - limit} restantes)
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="py-10 text-center text-[var(--mn-muted)]">Aucune ligne ne correspond.</p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mn-punch ${strong ? "text-3xl" : "text-2xl"}`}>{value}</div>
    </div>
  );
}
