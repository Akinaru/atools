"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type CSSProperties } from "react";
import type { PlannedRow } from "../import/plan";
import { formatDay, formatMoney, formatSigned, getCategory, KIND_LABELS, MAIN_ACCOUNT, type AccountNames, type Categories, type Kind } from "../money";
import { commitImport, previewImport, type PreviewState } from "../server/actions";
import { BASE, buttonClass } from "./kit";
import { categoryOptions, KIND_COLORS, kindOptions, Picker, type PickerOption } from "./Picker";

/** An operation as edited on screen; a twin is linked unless the user says it is not the same money. */
type Draft = {
  row: PlannedRow;
  action: "add" | "link" | "ignore";
  kind: Kind;
  category: string;
  label: string;
  person: string;
  /** Transfer: my other account. Savings on a current account: the livret. Other kinds: the account it belongs to (via). */
  other: string;
  /** Learn a rule from this row (set as soon as the user changes something). */
  remember: boolean;
};

const FILTERS = ["À vérifier", "Nouvelles", "Rattachées", "Ignorées", "Déjà là"] as const;
type Filter = (typeof FILTERS)[number];

const SOURCES: Record<PlannedRow["suggestion"]["source"], string> = { rule: "⟳ règle", history: "↺ comme avant", bank: "banque", default: "à classer" };

const toDraft = (row: PlannedRow, target: string): Draft => {
  const s = row.suggestion;
  const other = s.kind === "transfer" ? (s.account === target ? s.to : s.account) : s.via;
  return {
    row,
    action: row.status === "twin" ? "link" : s.ignore ? "ignore" : "add",
    kind: s.kind,
    category: s.category,
    label: s.label,
    person: s.person ?? "",
    other: other ?? "",
    remember: false,
  };
};

/** Rows to look at: nothing better than a default, a guessed person, or a transfer without its other account. */
const needsReview = (d: Draft) =>
  d.action === "add" && d.row.suggestion.source !== "rule" && (d.row.suggestion.source === "default" || d.kind === "debt" || (d.kind === "transfer" && !d.other));

const targetOptions = (names: AccountNames): PickerOption[] => [
  { value: "", label: "Détecter d'après le fichier", emoji: "✨" },
  ...names.accounts.map((a) => ({ value: `account:${a.id}`, label: a.name, emoji: a.emoji, group: "Comptes" })),
  ...names.livrets.map((a) => ({ value: `livret:${a.id}`, label: a.name, emoji: a.emoji, group: "Livrets" })),
];

/** Upload a bank export of any account, review everything it brings, then import. */
export function ImportClient({ names }: { names: AccountNames }) {
  const [preview, previewAction, previewing] = useActionState(previewImport, {});
  const [target, setTarget] = useState("");
  return (
    <div className="grid gap-10">
      <form action={previewAction} className="mn-shape mn-paper mn-drop grid gap-4 p-6 sm:p-8" style={{ "--mn-tilt": "-0.8deg" } as CSSProperties}>
        <span className="text-sm font-semibold tracking-wide text-zinc-500">[1 · Ton relevé]</span>
        <p className="max-w-3xl text-zinc-700">
          Dépose l&apos;export CSV d&apos;un compte : <b>Caisse d&apos;Épargne</b> (compte ou livret), <b>Revolut</b> (relevé Excel, perso ou Pro) ou{" "}
          <b>Crédit Mutuel</b>. La banque est reconnue toute seule. Les opérations déjà là sont sautées, et les virements déjà vus depuis un autre compte
          sont rattachés : tu peux importer chaque mois, même avec des périodes qui se chevauchent.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Picker ariaLabel="Compte" name="target" className="w-64" value={target} onChange={setTarget} options={targetOptions(names)} />
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
      {preview.plan && preview.target && preview.categories && preview.names && (
        <Review key={`${preview.fileName}-${preview.target}-${preview.plan.rows.length}-${preview.plan.to}`} preview={preview as Required<PreviewState>} />
      )}
    </div>
  );
}

function Review({ preview }: { preview: Required<PreviewState> }) {
  const { plan, categories, names } = preview;
  const [targetType, targetId] = preview.target.split(":") as ["account" | "livret", string];
  const isLivret = targetType === "livret";
  const known = plan.rows.filter((r) => r.status === "known");
  const [drafts, setDrafts] = useState(() => plan.rows.filter((r) => r.status !== "known").map((r) => toDraft(r, targetId)));
  const [filter, setFilter] = useState<Filter>(() => (drafts.some(needsReview) ? "À vérifier" : "Nouvelles"));
  const [query, setQuery] = useState("");
  const [state, commitAction, committing] = useActionState(commitImport, {});

  /** Edits a row, and the same change on every new row with the same bank label (remembered as a rule). */
  const edit = (index: number, patch: Partial<Draft>, sameLabel = true) => {
    const match = drafts[index].row.match;
    setDrafts((list) =>
      list.map((d, i) => {
        if (i !== index && (!sameLabel || d.row.match !== match || d.row.status !== "new")) return d;
        const next = { ...d, ...patch, remember: d.row.status === "new" };
        // A per-row label (different from the bank one) stays on its own row.
        if (i !== index && "label" in patch) next.label = d.label;
        return next;
      }),
    );
  };

  const added = drafts.filter((d) => d.action === "add");
  const linked = drafts.filter((d) => d.action === "link");
  const ignored = drafts.filter((d) => d.action === "ignore");
  const counts: Record<Filter, number> = {
    "À vérifier": drafts.filter(needsReview).length,
    Nouvelles: added.length,
    Rattachées: drafts.filter((d) => d.row.status === "twin").length,
    Ignorées: ignored.filter((d) => d.row.status === "new").length,
    "Déjà là": known.length,
  };
  const words = query.trim().toLocaleUpperCase("fr-FR");
  const visible = (label: string) => !words || label.toLocaleUpperCase("fr-FR").includes(words);
  const shown = drafts
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => visible(`${d.row.label} ${d.label}`))
    .filter(({ d }) =>
      filter === "À vérifier"
        ? needsReview(d)
        : filter === "Nouvelles"
          ? d.action === "add"
          : filter === "Rattachées"
            ? d.row.status === "twin"
            : d.action === "ignore" && d.row.status === "new",
    );

  // What the import adds, and where the account lands.
  const moneyIn = added.reduce((n, d) => n + Math.max(d.row.amount, 0), 0);
  const moneyOut = added.reduce((n, d) => n + Math.min(d.row.amount, 0), 0);
  const byKind = new Map<Kind, { count: number; total: number }>();
  for (const d of added) {
    const k = byKind.get(d.kind) ?? { count: 0, total: 0 };
    byKind.set(d.kind, { count: k.count + 1, total: k.total + d.row.amount });
  }
  const byCategory = new Map<string, { label: string; emoji: string; total: number }>();
  for (const d of added.filter((d) => d.kind === "expense" || d.kind === "charge")) {
    const c = getCategory(d.kind, d.category, categories);
    const key = `${d.kind}:${c.id}`;
    byCategory.set(key, { label: c.label, emoji: c.emoji, total: (byCategory.get(key)?.total ?? 0) - d.row.amount });
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  // The main account's balance follows the checkpoints: only lines after the last one move it; the others change gaps.
  const lastCheckpoint = plan.checkpoints.at(-1)?.date;
  const moving = added.filter((d) => !lastCheckpoint || d.row.bookedDate > lastCheckpoint);
  const after = plan.balanceBefore === null ? null : plan.balanceBefore + (plan.start ?? 0) + moving.reduce((n, d) => n + d.row.amount, 0);
  const gap = after !== null && plan.fileBalance !== null ? after - plan.fileBalance : null;
  const checks = plan.checkpoints
    .filter((c) => c.expected !== null && c.date >= plan.from && c.previous! <= plan.to)
    .map((c) => {
      const between = added.filter((d) => d.row.bookedDate > c.previous! && d.row.bookedDate <= c.date).reduce((n, d) => n + d.row.amount, 0);
      return { date: c.date, before: c.balance - c.expected!, after: c.balance - c.expected! - between };
    });
  const rules = drafts.filter((d) => d.remember).length;

  const payload = useMemo(
    () =>
      JSON.stringify(
        drafts.map((d) => {
          const out = d.row.amount < 0;
          const base = {
            importId: d.row.importId,
            action: d.action,
            twin: d.row.twin?.id,
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
          };
          if (isLivret) return { ...base, account: d.row.suggestion.account ?? MAIN_ACCOUNT.id };
          if (d.kind === "transfer") return { ...base, account: out ? targetId : d.other, to: out ? d.other : targetId };
          if (d.kind === "savings") return { ...base, account: targetId, livret: d.other || undefined };
          return { ...base, via: d.other && d.other !== targetId ? d.other : undefined };
        }),
      ),
    [drafts, isLivret, targetId],
  );

  if (state.ok && state.result) {
    const r = state.result;
    return (
      <div className="mn-shape mn-paper grid justify-items-start gap-4 p-8">
        <span className="mn-stamp mn-slam text-3xl text-[var(--mn-ink)]" style={{ "--mn-tilt": "-6deg" } as CSSProperties}>
          Importé
        </span>
        <p className="text-lg font-semibold">
          {preview.targetName} : {r.added} ligne{r.added > 1 ? "s" : ""} ajoutée{r.added > 1 ? "s" : ""} · {r.linked} rattachée{r.linked > 1 ? "s" : ""} ·{" "}
          {r.ignored} ignorée{r.ignored > 1 ? "s" : ""}
          {r.skipped > 0 && ` · ${r.skipped} déjà là`}
          {r.rules > 0 && ` · ${r.rules} règle${r.rules > 1 ? "s" : ""} retenue${r.rules > 1 ? "s" : ""}`}.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href={`${BASE}/lignes`} className={buttonClass()}>
            <span>Voir les lignes ▸</span>
          </Link>
          <Link href={BASE} className={buttonClass("dark")}>
            <span>Le mois</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="grid gap-6">
      {/* What this export is, and what it brings. */}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="mn-shape grid content-start gap-4 p-6 sm:p-8" style={{ "--mn-shape": "var(--mn-panel)" } as CSSProperties}>
          <span className="text-sm font-semibold tracking-wide text-[var(--mn-muted)]">[2 · Le récap]</span>
          <h2 className="mn-punch text-3xl sm:text-4xl">
            {preview.bankName} → {preview.targetName}
          </h2>
          <p className="text-[var(--mn-muted)]">
            {preview.fileName} · du {formatDay(plan.from)} au {formatDay(plan.to)} · {plan.rows.length} opération{plan.rows.length > 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Count label="nouvelles" value={added.length} tone="accent" />
            <Count label="rattachées" value={linked.length} tone="blue" />
            <Count label="ignorées" value={ignored.length} />
            <Count label="déjà là" value={known.length} />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t-2 border-dashed border-white/10 pt-4 sm:grid-cols-3">
            <Stat label="Entrées ajoutées" value={formatSigned(moneyIn)} />
            <Stat label="Sorties ajoutées" value={formatSigned(moneyOut)} accent />
            <Stat label="Net" value={formatSigned(moneyIn + moneyOut)} />
          </div>
          {byKind.size > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {[...byKind].map(([kind, k]) => (
                <li key={kind} className="flex items-center gap-2 border-2 border-white/15 px-2.5 py-1 font-semibold">
                  <span className="h-2.5 w-2.5 rotate-45" style={{ background: KIND_COLORS[kind] }} aria-hidden />
                  {KIND_LABELS[kind]} · {k.count} · {formatSigned(k.total)}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-6">
          <BalanceCheck after={after} gap={gap} plan={plan} checks={checks} isMain={!isLivret && targetId === MAIN_ACCOUNT.id} />
          {topCategories.length > 0 && (
            <div className="mn-shape grid gap-2 p-6" style={{ "--mn-shape": "var(--mn-panel)" } as CSSProperties}>
              <span className="text-sm font-semibold tracking-wide text-[var(--mn-muted)]">[Où part l&apos;argent ajouté]</span>
              {topCategories.map(([key, c]) => (
                <p key={key} className="flex justify-between gap-3 text-sm font-semibold">
                  <span>
                    {c.emoji} {c.label}
                  </span>
                  <span className="text-[var(--mn-accent)]">{formatMoney(c.total)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mn-shape grid gap-5 p-6 sm:p-8" style={{ "--mn-shape": "var(--mn-panel)" } as CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`mn-punch px-3 pb-1 pt-2 text-lg ${filter === f ? "bg-[var(--mn-accent)] text-[var(--mn-ink)]" : "mn-ghost"}`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher un libellé…" className="w-56 !py-1.5 text-sm uppercase" aria-label="Chercher" />
        </div>
        <p className="text-sm text-[var(--mn-muted)]">
          Changer le type ou la catégorie d&apos;une ligne change toutes les nouvelles lignes du même libellé, et crée une règle pour les prochains imports.
          Une ligne rattachée est la même opération, déjà notée depuis l&apos;autre compte : elle n&apos;est pas ajoutée une 2e fois.
        </p>

        {filter === "Déjà là" ? (
          <ul className="grid gap-1.5">
            {known
              .filter((r) => visible(r.label))
              .map((r) => (
                <li key={r.importId} className="flex items-center gap-3 px-3 py-1.5 text-sm text-[var(--mn-muted)]">
                  <span className="w-12 shrink-0">{shortDate(r.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  <span className="font-bold">{formatSigned(r.amount)}</span>
                </li>
              ))}
            {known.length === 0 && <li className="py-8 text-center text-[var(--mn-muted)]">Rien de déjà importé dans ce fichier.</li>}
          </ul>
        ) : (
          <ul className="grid gap-2.5">
            {shown.map(({ d, i }) =>
              d.row.status === "twin" && d.action === "link" ? (
                <TwinRow key={d.row.importId} draft={d} names={names} onChange={(patch) => edit(i, patch, false)} />
              ) : (
                <ReviewRow
                  key={d.row.importId}
                  draft={d}
                  categories={categories}
                  names={names}
                  targetId={targetId}
                  isLivret={isLivret}
                  onChange={(patch, same) => edit(i, patch, same)}
                  tilt={i % 2 ? 0.2 : -0.2}
                />
              ),
            )}
            {shown.length === 0 && <li className="py-8 text-center text-[var(--mn-muted)]">Rien ici.</li>}
          </ul>
        )}
      </div>

      <form
        action={commitAction}
        className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-4 border-[3px] border-[var(--mn-ink)] bg-white p-4 text-[var(--mn-ink)] shadow-[6px_6px_0_var(--mn-ink)]"
      >
        <input type="hidden" name="rows" value={payload} />
        <input type="hidden" name="target" value={preview.target} />
        {plan.start !== null && <input type="hidden" name="start" value={plan.start} />}
        <p className="font-semibold">
          <b className="mn-punch text-xl">{added.length}</b> à ajouter · <b className="mn-punch text-xl">{linked.length}</b> à rattacher · {ignored.length} ignorée
          {ignored.length > 1 ? "s" : ""} · {rules} règle{rules > 1 ? "s" : ""} à retenir
        </p>
        {state.error && <p className="w-full font-bold text-[var(--mn-red)]">{state.error}</p>}
        <button disabled={committing || added.length + linked.length === 0} className={buttonClass()}>
          <span>{committing ? "Import…" : "Importer ▸"}</span>
        </button>
      </form>
    </section>
  );
}

const shortDate = (date: string) => `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(2, 4)}`;

function Count({ label, value, tone }: { label: string; value: number; tone?: "accent" | "blue" }) {
  const color = tone === "accent" ? "bg-[var(--mn-accent)] text-[var(--mn-ink)]" : tone === "blue" ? "bg-[#7cc4ff] text-[var(--mn-ink)]" : "bg-white/10";
  return (
    <span className={`mn-punch -rotate-1 px-3 pb-1 pt-1.5 text-lg ${color}`}>
      {value} {label}
    </span>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-[var(--mn-muted)]">{label}</div>
      <div className={`mn-punch text-2xl ${accent ? "text-[var(--mn-accent)]" : ""}`}>{value}</div>
    </div>
  );
}

/** Where the account lands after the import, checked against the balance the export gives. */
function BalanceCheck({
  after,
  gap,
  plan,
  checks,
  isMain,
}: {
  after: number | null;
  gap: number | null;
  plan: Required<PreviewState>["plan"];
  checks: { date: string; before: number; after: number }[];
  isMain: boolean;
}) {
  const verdict = gap ?? (checks.length ? checks.reduce((n, c) => n + Math.abs(c.after), 0) : null);
  const tone = verdict === null ? "var(--mn-panel)" : verdict === 0 ? "color-mix(in srgb, #5ee08a 22%, var(--mn-panel))" : "color-mix(in srgb, var(--mn-red) 25%, var(--mn-panel))";
  return (
    <div className="mn-shape grid gap-2 p-6" style={{ "--mn-shape": tone } as CSSProperties}>
      <span className="text-sm font-semibold tracking-wide text-[var(--mn-muted)]">[Contrôle du solde]</span>
      {plan.start !== null && (
        <p className="text-sm">
          Premier import de ce compte : il avait <b>{formatMoney(plan.start)}</b> avant le {formatDay(plan.from)}.
        </p>
      )}
      {after === null ? (
        <p className="text-sm text-[var(--mn-muted)]">Solde inconnu : ajoute un pointage du solde (Réglages) pour le suivre.</p>
      ) : (
        <>
          <p className="flex justify-between gap-3">
            <span>Monnaie après import, le {formatDay(plan.to)}</span>
            <b className="mn-punch text-xl">{formatMoney(after)}</b>
          </p>
          {checks.map((c) => (
            <p key={c.date} className="flex justify-between gap-3 text-sm">
              <span>Pointage du {formatDay(c.date)}</span>
              <b>
                {c.before === c.after ? "" : `écart ${formatSigned(c.before)} → `}
                {c.after === 0 ? "✓ pile" : `écart ${formatSigned(c.after)}`}
              </b>
            </p>
          ))}
          {plan.fileBalance !== null ? (
            <>
              <p className="flex justify-between gap-3">
                <span>Solde du relevé</span>
                <b className="mn-punch text-xl">{formatMoney(plan.fileBalance)}</b>
              </p>
              <p className="mn-punch text-lg">{gap === 0 ? "✓ Tout colle au centime" : `Écart de ${formatSigned(gap ?? 0)} : une ligne ignorée qui ne devait pas l'être ?`}</p>
            </>
          ) : (
            <p className="text-sm text-[var(--mn-muted)]">
              {isMain
                ? checks.length
                  ? "D'après tes pointages, et les lignes ajoutées après le dernier."
                  : "Ce relevé ne donne pas le solde : compare avec ton appli bancaire, et ajoute un pointage pour vérifier."
                : "Ce relevé ne donne pas le solde."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const fieldClass = "!px-2 !py-1.5 text-sm";

function ReviewRow({
  draft: d,
  categories: all,
  names,
  targetId,
  isLivret,
  onChange,
  tilt,
}: {
  draft: Draft;
  categories: Categories;
  names: AccountNames;
  targetId: string;
  isLivret: boolean;
  onChange: (patch: Partial<Draft>, sameLabel?: boolean) => void;
  tilt: number;
}) {
  const off = d.action === "ignore";
  const kinds: Kind[] = isLivret ? ["savings"] : (Object.keys(KIND_LABELS) as Kind[]);
  const categories = isLivret ? all.savings : all[d.kind];
  const others = names.accounts.filter((a) => a.id !== targetId).map((a) => ({ value: a.id, label: a.name, emoji: a.emoji }));
  return (
    <li
      className={`mn-shape grid items-center gap-3 px-4 py-3 focus-within:z-30 lg:grid-cols-[auto_minmax(0,1.3fr)_7rem_minmax(0,2.6fr)] ${off ? "opacity-45" : ""}`}
      style={{ "--mn-shape": "var(--mn-panel-2)", transform: `rotate(${tilt}deg)` } as CSSProperties}
    >
      <label className="flex items-center gap-2 text-sm font-bold" title={off ? "Ignorée" : "Ajoutée"}>
        <input type="checkbox" checked={!off} onChange={(e) => onChange({ action: e.target.checked ? "add" : "ignore" }, false)} className="h-5 w-5 accent-[var(--mn-accent)]" />
        <span className="w-16 text-[var(--mn-muted)]">{shortDate(d.row.date)}</span>
      </label>

      <div className="min-w-0">
        <p className="truncate font-bold" title={d.row.detail}>
          {d.row.label}
        </p>
        <p className="truncate text-xs text-[var(--mn-muted)]" title={d.row.detail}>
          <span className={d.row.suggestion.source === "default" ? "font-bold text-[var(--mn-yellow)]" : ""}>{SOURCES[d.row.suggestion.source]}</span>
          {d.row.type && ` · ${d.row.type}`}
          {d.remember && " · règle à retenir"}
        </p>
        {d.row.twin && (
          <button type="button" onClick={() => onChange({ action: "link" }, false)} className="text-xs font-bold text-[#7cc4ff] underline underline-offset-2">
            🔗 Finalement, rattacher à « {d.row.twin.label} »
          </button>
        )}
      </div>

      <span className={`mn-punch text-right text-xl ${d.row.amount < 0 ? "text-[var(--mn-accent)]" : "text-white"}`}>{formatSigned(d.row.amount)}</span>

      <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Picker
          ariaLabel="Type"
          size="sm"
          value={d.kind}
          disabled={off || isLivret}
          onChange={(v) => onChange({ kind: v as Kind, category: all[v as Kind][0].id, other: "" })}
          options={kindOptions(kinds)}
        />
        <Picker
          ariaLabel="Catégorie"
          size="sm"
          value={d.category}
          disabled={off || d.kind === "transfer"}
          onChange={(v) => onChange({ category: v })}
          options={categoryOptions(categories)}
        />
        {d.kind === "debt" ? (
          <input aria-label="Avec qui" value={d.person} disabled={off} onChange={(e) => onChange({ person: e.target.value })} placeholder="Prénom" className={fieldClass} />
        ) : (
          <input aria-label="Libellé" value={d.label} disabled={off} onChange={(e) => onChange({ label: e.target.value }, false)} className={`${fieldClass} uppercase`} />
        )}
        {d.kind === "transfer" ? (
          <Picker
            ariaLabel={d.row.amount < 0 ? "Vers" : "Depuis"}
            size="sm"
            placeholder={d.row.amount < 0 ? "Vers…" : "Depuis…"}
            value={d.other}
            disabled={off}
            onChange={(v) => onChange({ other: v })}
            options={others}
          />
        ) : d.kind === "savings" && !isLivret ? (
          <Picker
            ariaLabel="Livret"
            size="sm"
            placeholder="Livret…"
            value={d.other}
            disabled={off}
            onChange={(v) => onChange({ other: v })}
            options={names.livrets.map((a) => ({ value: a.id, label: a.name, emoji: a.emoji }))}
          />
        ) : !isLivret && (d.kind === "income" || d.kind === "expense" || d.kind === "charge") && others.length > 0 ? (
          <Picker
            ariaLabel="Pour le compte"
            size="sm"
            value={d.other}
            disabled={off}
            onChange={(v) => onChange({ other: v })}
            options={[{ value: "", label: "Ce compte", emoji: "·" }, ...others.map((o) => ({ ...o, label: `Pour ${o.label}` }))]}
          />
        ) : (
          <span />
        )}
      </div>
    </li>
  );
}

/** An operation already recorded from the other account: linked, unless the user says it is other money. */
function TwinRow({ draft: d, names, onChange }: { draft: Draft; names: AccountNames; onChange: (patch: Partial<Draft>) => void }) {
  const twin = d.row.twin!;
  const name = (id?: string) => [...names.accounts, ...names.livrets].find((a) => a.id === id)?.name ?? "?";
  const where =
    twin.kind === "transfer" ? `${name(twin.account)} → ${name(twin.to)}` : twin.kind === "savings" ? `${name(twin.account)} ↔ ${twin.livret ? name(twin.livret) : "livret"}` : name(twin.account);
  return (
    <li
      className="mn-shape grid items-center gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto]"
      style={{ "--mn-shape": "var(--mn-panel-2)" } as CSSProperties}
    >
      <span className="w-16 text-sm font-bold text-[var(--mn-muted)]">{shortDate(d.row.date)}</span>
      <div className="min-w-0">
        <p className="truncate font-bold" title={d.row.detail}>
          {d.row.label}
        </p>
        <p className="truncate text-xs text-[#7cc4ff]">
          🔗 même opération que « {twin.label} » du {shortDate(twin.date)} · {where}
        </p>
      </div>
      <span className={`mn-punch text-right text-xl ${d.row.amount < 0 ? "text-[var(--mn-accent)]" : "text-white"}`}>{formatSigned(d.row.amount)}</span>
      <button
        type="button"
        onClick={() => onChange({ action: "add" })}
        className="text-sm font-bold underline decoration-[#7cc4ff] decoration-2 underline-offset-4 hover:text-white"
        title="Ce n'est pas la même opération : l'ajouter comme une nouvelle ligne"
      >
        Pas la même
      </button>
    </li>
  );
}
