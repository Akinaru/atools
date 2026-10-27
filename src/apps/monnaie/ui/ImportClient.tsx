"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type CSSProperties } from "react";
import { formatMoney, formatSigned, KIND_LABELS, type Categories, type Kind } from "../money";
import { commitImport, previewImport, type PreviewRow } from "../server/actions";
import { BASE, buttonClass } from "./kit";
import { categoryOptions, kindOptions, Picker } from "./Picker";

/** A preview row as edited on screen. */
type Draft = {
  row: PreviewRow;
  ignore: boolean;
  kind: Kind;
  category: string;
  label: string;
  person: string;
  /** Learn a rule from this row (set as soon as the user changes something). */
  remember: boolean;
};

const KINDS = Object.keys(KIND_LABELS) as Kind[];
const FILTERS = ["Toutes", "À vérifier", "Ignorées"] as const;

const toDraft = (row: PreviewRow): Draft => ({
  row,
  ignore: row.suggestion.ignore,
  kind: row.suggestion.kind,
  category: row.suggestion.category,
  label: row.suggestion.label,
  person: row.suggestion.person ?? "",
  remember: false,
});

/** Rows the user should look at: no rule nor bank category matched, or a guessed person. */
const needsReview = (d: Draft) => !d.ignore && d.row.suggestion.source !== "rule" && (d.row.suggestion.source === "default" || d.kind === "debt");

/** Upload a bank export, review what each operation becomes, then import. */
export function ImportClient() {
  const [preview, previewAction, previewing] = useActionState(previewImport, {});
  return (
    <div className="grid gap-10">
      <form action={previewAction} className="mn-shape mn-paper mn-drop grid gap-4 p-6 sm:p-8" style={{ "--mn-tilt": "-0.8deg" } as CSSProperties}>
        <span className="text-sm font-semibold tracking-wide text-zinc-500">[1 · Ton export bancaire]</span>
        <p className="max-w-2xl text-zinc-700">
          Sur le site de la Caisse d&apos;Épargne, ouvre ton compte, télécharge tes opérations au format <b>CSV</b>, puis dépose le fichier ici. Les opérations
          déjà importées sont sautées : tu peux réimporter une période qui chevauche.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm font-semibold text-zinc-700 file:mr-3 file:border-[3px] file:border-[var(--mn-ink)] file:bg-white file:px-4 file:py-2 file:font-bold"
          />
          <button disabled={previewing} className={buttonClass()}>
            <span>{previewing ? "Lecture…" : "Analyser ▸"}</span>
          </button>
        </div>
        {preview.error && <p className="font-bold text-[var(--mn-red)]">{preview.error}</p>}
      </form>

      {/* A new analysis remounts the review with fresh drafts. */}
      {preview.rows && preview.categories && (
        <Review
          key={`${preview.fileName}-${preview.rows.length}-${preview.alreadyImported}`}
          rows={preview.rows}
          alreadyImported={preview.alreadyImported ?? 0}
          categories={preview.categories}
        />
      )}
    </div>
  );
}

function Review({ rows, alreadyImported, categories }: { rows: PreviewRow[]; alreadyImported: number; categories: Categories }) {
  const [drafts, setDrafts] = useState(() => rows.map(toDraft));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Toutes");
  const [result, commitAction, committing] = useActionState(commitImport, {});

  /** Edits a row, and the same change on every row with the same bank label (remembered as a rule). */
  const edit = (index: number, patch: Partial<Draft>) => {
    const match = drafts[index].row.match;
    setDrafts((list) =>
      list.map((d, i) => {
        if (i !== index && d.row.match !== match) return d;
        const next = { ...d, ...patch, remember: true };
        // A per-row label (different from the bank one) stays on its own row.
        if (i !== index && "label" in patch) next.label = d.label;
        return next;
      }),
    );
  };

  const kept = drafts.filter((d) => !d.ignore);
  // Operations ignored by default (fees refunded, ignore rules) come back at every import: not counted as new.
  const suggested = rows.filter((r) => !r.suggestion.ignore).length;
  const toReview = drafts.filter(needsReview).length;
  const shown = drafts
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => (filter === "Toutes" ? !d.ignore : filter === "Ignorées" ? d.ignore : needsReview(d)));
  const payload = useMemo(
    () =>
      JSON.stringify(
        drafts.map((d) => ({
          importId: d.row.importId,
          ignore: d.ignore,
          remember: d.remember,
          match: d.row.match,
          kind: d.kind,
          category: d.category,
          label: d.label,
          person: d.person,
          amount: Math.abs(d.row.amount),
          date: d.row.date,
          bookedDate: d.row.bookedDate,
          note: "",
        })),
      ),
    [drafts],
  );

  if (result.ok) {
    return (
      <div className="mn-shape mn-paper grid justify-items-start gap-4 p-8">
        <span className="mn-stamp mn-slam text-3xl text-[var(--mn-ink)]" style={{ "--mn-tilt": "-6deg" } as CSSProperties}>
          Importé
        </span>
        <p className="text-lg font-semibold">{result.message}</p>
        <Link href={BASE} className={buttonClass()}>
          <span>Voir le mois ▸</span>
        </Link>
      </div>
    );
  }

  return (
    <section className="mn-shape grid gap-6 p-6 sm:p-8" style={{ "--mn-shape": "var(--mn-panel)" } as CSSProperties}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-sm font-semibold tracking-wide text-[var(--mn-muted)]">[2 · Vérifie]</span>
          <h2 className="mn-punch mt-1 text-3xl">
            {suggested} nouvelle{suggested > 1 ? "s" : ""} opération{suggested > 1 ? "s" : ""}
          </h2>
          <p className="mt-1 text-sm text-[var(--mn-muted)]">
            {alreadyImported > 0 && `${alreadyImported} déjà importée${alreadyImported > 1 ? "s" : ""} (sautées) · `}
            {rows.length > suggested && `${rows.length - suggested} ignorée${rows.length - suggested > 1 ? "s" : ""} d'office (frais annulés, règles) · `}
            Modifier une ligne modifie toutes celles du même libellé et crée une règle pour les prochains imports.
          </p>
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`mn-punch px-3 pb-1 pt-2 text-lg ${filter === f ? "bg-[var(--mn-accent)] text-[var(--mn-ink)]" : "mn-ghost"}`}
            >
              {f}
              {f === "À vérifier" && ` (${toReview})`}
              {f === "Ignorées" && ` (${drafts.length - kept.length})`}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-2.5">
        {shown.map(({ d, i }) => (
          <ReviewRow key={d.row.importId} draft={d} categories={categories} onChange={(patch) => edit(i, patch)} tilt={i % 2 ? 0.25 : -0.25} />
        ))}
        {shown.length === 0 && <li className="py-8 text-center text-[var(--mn-muted)]">Rien ici.</li>}
      </ul>

      <form action={commitAction} className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
        <input type="hidden" name="rows" value={payload} />
        <p className="text-[var(--mn-muted)]">
          <b className="text-white">{kept.length}</b> ligne{kept.length > 1 ? "s" : ""} à importer · {drafts.filter((d) => d.remember).length} avec une règle à retenir
        </p>
        {result.error && <p className="w-full font-bold text-[var(--mn-red)]">{result.error}</p>}
        <button disabled={committing || kept.length === 0} className={buttonClass()}>
          <span>{committing ? "Import…" : `Importer ${kept.length} ▸`}</span>
        </button>
      </form>
    </section>
  );
}

const fieldClass = "!px-2 !py-1.5 text-sm";

function ReviewRow({ draft: d, categories: all, onChange, tilt }: { draft: Draft; categories: Categories; onChange: (patch: Partial<Draft>) => void; tilt: number }) {
  const categories = all[d.kind];
  return (
    <li
      className={`mn-shape grid items-center gap-3 px-4 py-3 focus-within:z-30 sm:grid-cols-[auto_minmax(0,1.4fr)_7rem_minmax(0,2fr)] ${d.ignore ? "opacity-45" : ""}`}
      style={{ "--mn-shape": "var(--mn-panel-2)", transform: `rotate(${tilt}deg)` } as CSSProperties}
    >
      <label className="flex items-center gap-2 text-sm font-bold" title={d.ignore ? "Ignorée" : "Importée"}>
        <input type="checkbox" checked={!d.ignore} onChange={(e) => onChange({ ignore: !e.target.checked })} className="h-5 w-5 accent-[var(--mn-accent)]" />
        <span className="w-12 text-[var(--mn-muted)]">{d.row.date.slice(8)}/{d.row.date.slice(5, 7)}</span>
      </label>

      <div className="min-w-0">
        <p className="truncate font-bold" title={d.row.detail}>
          {d.row.label}
        </p>
        <p className="truncate text-xs text-[var(--mn-muted)]">
          {d.row.suggestion.source === "rule" ? "⟳ règle" : d.row.bankSubcategory || d.row.type}
          {d.remember && " · règle à retenir"}
        </p>
      </div>

      <span className={`mn-punch text-right text-xl ${d.row.amount < 0 ? "text-[var(--mn-accent)]" : "text-white"}`} title={formatMoney(Math.abs(d.row.amount))}>
        {formatSigned(d.row.amount)}
      </span>

      <div className="grid gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Picker
          ariaLabel="Type"
          size="sm"
          value={d.kind}
          disabled={d.ignore}
          onChange={(v) => onChange({ kind: v as Kind, category: all[v as Kind][0].id })}
          options={kindOptions(KINDS)}
        />
        <Picker ariaLabel="Catégorie" size="sm" value={d.category} disabled={d.ignore} onChange={(v) => onChange({ category: v })} options={categoryOptions(categories)} />
        {d.kind === "debt" ? (
          <input aria-label="Avec qui" value={d.person} disabled={d.ignore} onChange={(e) => onChange({ person: e.target.value })} placeholder="Prénom" className={fieldClass} />
        ) : (
          <input aria-label="Libellé" value={d.label} disabled={d.ignore} onChange={(e) => onChange({ label: e.target.value })} className={`${fieldClass} uppercase`} />
        )}
      </div>
    </li>
  );
}
