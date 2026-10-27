import type { CSSProperties } from "react";
import { categoryYear, dailySpending, detectRecurring } from "../insights";
import { formatMoney, formatSigned, KIND_LABELS, monthName, yearStats, type Ledger } from "../money";
import { showYear } from "../server/actions";
import { Panel, PanelTitle, Paper, Screen, Stamp, Tag } from "./kit";
import { AnimatedMoney } from "./motion";
import { ViewNav } from "./ViewNav";
import { CategoryExplorer, SpendingCalendar, YearFlowChart, type YearMonth } from "./YearCharts";

/** Overview of a year: what was kept, the months, the categories, the days. `today` is YYYY-MM-DD. */
export function YearView({ ledger, year, today }: { ledger: Ledger; year: number; today: string }) {
  const stats = yearStats(ledger, year);
  // Recurring lines as of the last month of the year with data (or this month for the current year).
  const refMonth = year === Number(today.slice(0, 4)) ? today.slice(0, 7) : `${year}-12`;
  const recurring = detectRecurring(ledger, refMonth);
  const recurringOut = recurring.filter((r) => r.kind !== "income").reduce((n, r) => n + r.amount, 0);
  const active = stats.months.filter((m) => m.entries.length > 0);
  const bestKept = active.reduce<(typeof active)[number] | undefined>((b, m) => (!b || m.kept > b.kept ? m : b), undefined);
  const bestSaved = active.reduce<(typeof active)[number] | undefined>((b, m) => (!b || m.saved > b.saved ? m : b), undefined);
  const worst = active.reduce<(typeof active)[number] | undefined>((w, m) => (!w || m.spent > w.spent ? m : w), undefined);
  const averageSpent = active.length ? Math.round(stats.spent / active.length) : 0;
  const averageKept = active.length ? Math.round(stats.kept / active.length) : 0;
  const overBudget = stats.months.filter((m) => m.budget && m.spent > m.budget).length;
  const savingsRate = stats.income > 0 ? Math.round((stats.saved / stats.income) * 100) : null;
  const months: YearMonth[] = stats.months.map((m) => ({
    month: m.month,
    income: m.income,
    charges: m.charges,
    spent: m.spent,
    saved: m.saved,
    kept: m.kept,
    savingsBalance: m.savingsBalance,
    hasData: m.entries.length > 0,
  }));

  return (
    <Screen
      section="annee"
      title={year}
      subtitle={`${active.length} mois remplis sur 12`}
      hints={["← → changer d'année", "clic sur un mois pour l'ouvrir"]}
      actions={
        <ViewNav
          prev={showYear.bind(null, year - 1)}
          next={showYear.bind(null, year + 1)}
          today={showYear.bind(null, null)}
          isToday={year === Number(today.slice(0, 4))}
          prevLabel={`Année ${year - 1}`}
          nextLabel={`Année ${year + 1}`}
        />
      }
    >
      <div className="grid items-start gap-8 xl:grid-cols-[1.2fr_1fr]">
        <Paper tilt={-1}>
          {stats.kept < 0 && <Stamp className="right-6 top-8 text-2xl">Dans le rouge</Stamp>}
          <Tag className="!text-zinc-500">Gardé en {year}</Tag>
          <p className={`mn-punch mt-2 text-7xl sm:text-8xl ${stats.kept < 0 ? "text-[var(--mn-red)]" : ""}`}>
            <AnimatedMoney value={stats.kept} signed />
          </p>
          <p className="mt-2 font-semibold text-zinc-600">
            {stats.kept < 0 ? "dépensé en plus de ce que tu as gagné." : "gardé sur ce que tu as gagné."} Soit <b className="text-[var(--mn-ink)]">{formatSigned(averageKept)}</b> par
            mois.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="mn-punch -rotate-1 bg-[var(--mn-yellow)] px-3 pb-1 pt-1.5 text-lg text-[var(--mn-ink)] shadow-[3px_3px_0_var(--mn-ink)]">
              {formatSigned(stats.saved)} sur le livret
            </span>
            <span className={`mn-punch rotate-1 px-3 pb-1 pt-1.5 text-lg text-white shadow-[3px_3px_0_var(--mn-ink)] ${stats.left < 0 ? "bg-[var(--mn-red)]" : "bg-[var(--mn-ink)]"}`}>
              {formatSigned(stats.left)} sur le compte
            </span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 border-t-2 border-dashed border-zinc-200 pt-5 sm:grid-cols-4">
            <MiniStat label="Encaissé" value={stats.income} />
            <MiniStat label="Charges" value={-stats.charges} signed muted />
            <MiniStat label="Plaisir" value={-stats.spent} signed accent />
            <MiniStat label="Regretté 😬" value={stats.regret} red />
          </div>
        </Paper>

        <div className="grid gap-6 sm:grid-cols-2">
          <Sticker label="Taux d'épargne" value={savingsRate === null ? "—" : `${savingsRate} %`} hint="de ce que tu as gagné, mis sur le livret" tone="yellow" tilt={-1.5} />
          <Sticker label="Plaisir / mois" value={formatMoney(averageSpent)} hint={`en moyenne sur ${active.length} mois`} tone="accent" tilt={1.2} />
          <Sticker
            label="Meilleur mois"
            value={bestKept ? monthName(bestKept.month) : "—"}
            hint={bestKept ? `${formatSigned(bestKept.kept)} gardés` : ""}
            tone="paper"
            tilt={0.8}
          />
          <Sticker label="Plus dépensier" value={worst ? monthName(worst.month) : "—"} hint={worst ? `${formatMoney(worst.spent)} de plaisir` : ""} tone="dark" tilt={-0.8} />
          <Sticker
            label="Plus épargné"
            value={bestSaved && bestSaved.saved > 0 ? monthName(bestSaved.month) : "—"}
            hint={bestSaved && bestSaved.saved > 0 ? `${formatSigned(bestSaved.saved)} sur le livret` : ""}
            tone="dark"
            tilt={1}
          />
          <Sticker label="Budget explosé" value={`${overBudget} fois`} hint={ledger.settings.monthlyBudget ? `budget de ${formatMoney(ledger.settings.monthlyBudget)}` : "aucun budget fixé"} tone={overBudget ? "red" : "dark"} tilt={-1.2} />
        </div>
      </div>

      <Panel className="mt-10">
        <PanelTitle aside={<Tag>survole · clique pour ouvrir un mois</Tag>}>Mois par mois</PanelTitle>
        <YearFlowChart months={months} current={today.slice(0, 7)} />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>clique une catégorie</Tag>}>Les catégories</PanelTitle>
        <CategoryExplorer expense={categoryYear(ledger, year, "expense")} charge={categoryYear(ledger, year, "charge")} year={year} />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>plaisir, jour par jour</Tag>}>Le calendrier</PanelTitle>
        <SpendingCalendar year={year} days={dailySpending(ledger, year)} today={today} />
      </Panel>

      {recurring.length > 0 && (
        <Panel className="mt-6">
          <PanelTitle aside={<Tag>{formatMoney(recurringOut)} / mois · {formatMoney(recurringOut * 12)} / an</Tag>}>Ce qui revient chaque mois</PanelTitle>
          <ul className="grid gap-x-8 gap-y-2 md:grid-cols-2">
            {recurring.map((r) => (
              <li key={r.key} className="flex items-center gap-3 border-b border-white/10 py-2">
                <span className="text-xl" aria-hidden>
                  {r.category.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{r.label}</span>
                  <span className="block text-sm text-zinc-500">
                    {KIND_LABELS[r.kind]} · {r.category.label} · vers le {r.day} · {r.months} mois sur 6
                  </span>
                </span>
                <span className="text-right">
                  <span className={`mn-punch block text-xl ${r.kind === "income" ? "text-white" : "text-[var(--mn-accent)]"}`}>{formatMoney(r.amount)}</span>
                  <span className="block text-xs text-zinc-500">{formatMoney(r.amount * 12)} / an</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-zinc-500">Repéré automatiquement : même libellé, au moins 3 mois sur les 6 derniers, montant stable.</p>
        </Panel>
      )}
    </Screen>
  );
}

const STICKER_TONES = {
  paper: "bg-white text-[var(--mn-ink)]",
  dark: "bg-[var(--mn-panel)] text-white",
  accent: "bg-[var(--mn-accent)] text-[var(--mn-ink)]",
  yellow: "bg-[var(--mn-yellow)] text-[var(--mn-ink)]",
  red: "bg-[var(--mn-red)] text-white",
} as const;

/** One fact of the year on a tilted card. */
function Sticker({ label, value, hint, tone, tilt }: { label: string; value: string; hint: string; tone: keyof typeof STICKER_TONES; tilt: number }) {
  return (
    <div className="mn-drop" style={{ "--mn-tilt": `${tilt}deg` } as CSSProperties}>
      <div className={`h-full p-5 shadow-[5px_6px_0_rgba(0,0,0,0.55)] ${STICKER_TONES[tone]}`}>
        <div className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</div>
        <div className="mn-punch mt-2 text-3xl capitalize">{value}</div>
        {hint && <div className="mt-1 text-sm font-semibold opacity-75">{hint}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, signed = false, muted = false, accent = false, red = false }: { label: string; value: number; signed?: boolean; muted?: boolean; accent?: boolean; red?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mn-punch text-2xl ${accent ? "text-[var(--mn-accent)]" : red ? "text-[var(--mn-red)]" : muted ? "text-zinc-500" : ""}`}>
        <AnimatedMoney value={value} signed={signed} />
      </div>
    </div>
  );
}
