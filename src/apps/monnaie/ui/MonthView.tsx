import Link from "next/link";
import type { CSSProperties } from "react";
import {
  budgetMood,
  daysInMonth,
  formatMoney,
  formatSigned,
  monthName,
  monthStats,
  pendingRecurring,
  shiftMonth,
  type Ledger,
} from "../money";
import { addRecurringToMonth } from "../server/actions";
import { BudgetGauge, CategoryBars, SpendingCurve } from "./charts";
import { EntryDialog } from "./EntryDialog";
import { EntryList } from "./EntryList";
import { KeyNav } from "./KeyNav";
import { BASE, ButtonLink, buttonClass, Diamond, Panel, PanelTitle, Paper, Screen, Slab, squareClass, Stamp, Tag } from "./kit";

/** Dashboard of one month. `today` is YYYY-MM-DD. */
export function MonthView({ ledger, month, today }: { ledger: Ledger; month: string; today: string }) {
  const stats = monthStats(ledger, month);
  const previous = monthStats(ledger, shiftMonth(month, -1));
  const days = daysInMonth(month);
  const isCurrent = today.startsWith(month);
  const isFuture = month > today.slice(0, 7);
  // Day reached in the month: today for the current month, the whole month for a past one.
  const day = isCurrent ? Number(today.slice(8)) : isFuture ? 0 : days;
  const pending = pendingRecurring(ledger, month);
  const budgetLeft = stats.budget - stats.spent;
  const perDayLeft = isCurrent && budgetLeft > 0 ? Math.floor(budgetLeft / (days - day + 1)) : null;
  const projection = isCurrent && day > 0 ? Math.round((stats.spent / day) * days) : null;
  const spentDelta = previous.spent ? (stats.spent - previous.spent) / previous.spent : null;
  const defaultDate = isCurrent ? today : `${month}-01`;
  const year = month.slice(0, 4);

  return (
    <Screen
      section="mois"
      title={
        <>
          {monthName(month)} <span className="text-[var(--mn-accent)]">{year}</span>
        </>
      }
      subtitle={<p className="mn-punch text-2xl text-white">{budgetMood(stats.spent, stats.budget)}</p>}
      hints={["← → changer de mois", "X ajouter"]}
      actions={
        <>
          <KeyNav prev={`${BASE}/mois/${shiftMonth(month, -1)}`} next={`${BASE}/mois/${shiftMonth(month, 1)}`} />
          <div className="flex items-center gap-2">
            <Link href={`${BASE}/mois/${shiftMonth(month, -1)}`} className={squareClass()} aria-label="Mois précédent">
              ◀
            </Link>
            <Link href={`${BASE}/mois/${shiftMonth(month, 1)}`} className={squareClass()} aria-label="Mois suivant">
              ▶
            </Link>
          </div>
          {!isCurrent && (
            <ButtonLink href={BASE} variant="dark" size="sm">
              Aujourd&apos;hui
            </ButtonLink>
          )}
          <EntryDialog defaultDate={defaultDate} hotkey />
        </>
      }
    >
      {pending.length > 0 && (
        <div className="mn-drop mb-12 flex flex-wrap items-center justify-between gap-4 border-2 border-dashed border-[var(--mn-accent)]/60 px-5 py-4" style={{ "--mn-tilt": "-0.6deg" } as CSSProperties}>
          <p className="text-[var(--mn-muted)]">
            <span className="mn-punch mr-2 text-xl text-[var(--mn-accent)]">⟳ {pending.length} récurrent{pending.length > 1 ? "s" : ""}</span>
            pas encore dans ce mois : {pending.map((r) => r.label).join(", ")}.
          </p>
          <form action={addRecurringToMonth.bind(null, month)}>
            <button className={buttonClass("accent", "sm")}>
              <span>Ajouter</span>
            </button>
          </form>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
        <Paper tilt={-1.2}>
          {stats.left < 0 && <Stamp className="right-6 top-8 text-2xl">Dans le rouge</Stamp>}
          <Tag className="!text-zinc-500">Il te reste</Tag>
          <p className={`mn-punch mt-2 text-6xl sm:text-7xl ${stats.left < 0 ? "text-[var(--mn-red)]" : ""}`}>{formatSigned(stats.left, true)}</p>
          <ul className="mn-punch mt-7 grid gap-3 text-xl">
            <Diamond>
              Encaissé <span className="ml-auto">{formatMoney(stats.income)}</span>
            </Diamond>
            <Diamond>
              Cramé pour le plaisir <span className="ml-auto">{formatMoney(stats.spent)}</span>
            </Diamond>
            {stats.fixedCosts > 0 && (
              <Diamond className="text-zinc-500">
                Charges fixes <span className="ml-auto">{formatMoney(stats.fixedCosts)}</span>
              </Diamond>
            )}
            <Diamond>
              Taux d&apos;épargne{" "}
              <span className="ml-auto">{stats.savingsRate === null ? "—" : `${Math.round(stats.savingsRate * 100)} %`}</span>
            </Diamond>
            {stats.regret > 0 && (
              <Diamond className="text-[var(--mn-red)]">
                Regretté 😬 <span className="ml-auto">{formatMoney(stats.regret)}</span>
              </Diamond>
            )}
          </ul>
        </Paper>

        <Paper tilt={1.4}>
          {stats.budget > 0 && stats.spent > stats.budget && <Stamp className="right-6 top-6 text-2xl" tilt={8}>Budget explosé</Stamp>}
          {stats.budget > 0 && !isFuture && !isCurrent && stats.spent <= stats.budget && stats.entries.length > 0 && (
            <Stamp tone="ink" className="right-6 top-6 text-2xl" tilt={7}>Tenu ✓</Stamp>
          )}
          <Tag className="!text-zinc-500">Budget plaisir</Tag>
          {stats.budget ? (
            <>
              <p className="mn-punch mb-8 mt-2 text-4xl">
                {budgetLeft >= 0 ? `${formatMoney(budgetLeft, true)} dispo` : `${formatMoney(-budgetLeft, true)} de trop`}
              </p>
              <BudgetGauge spent={stats.spent} budget={stats.budget} pace={isCurrent ? day / days : undefined} />
            </>
          ) : (
            <p className="mt-3 text-lg">
              Fixe un budget mensuel pour tes dépenses plaisir dans les{" "}
              <Link href={`${BASE}/reglages`} className="font-bold underline decoration-[var(--mn-accent)] decoration-4 underline-offset-4">
                réglages
              </Link>
              .
            </p>
          )}
          <ul className="mt-7 grid gap-2 text-base">
            {perDayLeft !== null && (
              <Diamond>
                <span>
                  Tu peux encore cramer <b>{formatMoney(perDayLeft)}</b> / jour
                </span>
              </Diamond>
            )}
            {projection !== null && stats.spent > 0 && (
              <Diamond>
                <span>
                  À ce rythme : <b>{formatMoney(projection, true)}</b> fin {monthName(month)}
                </span>
              </Diamond>
            )}
            {spentDelta !== null && (
              <Diamond>
                <span>
                  <b>{spentDelta > 0 ? `+${Math.round(spentDelta * 100)} %` : `${Math.round(spentDelta * 100)} %`}</b> vs {monthName(previous.month)} (
                  {formatMoney(previous.spent, true)})
                </span>
              </Diamond>
            )}
            {stats.biggest && (
              <Diamond>
                <span>
                  Plus grosse folie : <b>{stats.biggest.label}</b> ({formatMoney(stats.biggest.amount)})
                </span>
              </Diamond>
            )}
          </ul>
        </Paper>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelTitle aside={<Tag>Courbe</Tag>}>Le mois au jour le jour</PanelTitle>
          <SpendingCurve stats={stats} today={isCurrent ? day : undefined} />
        </Panel>
        <Panel>
          <PanelTitle aside={<Tag>{stats.byCategory.length} catégories</Tag>}>Où part le fric</PanelTitle>
          {stats.byCategory.length ? <CategoryBars totals={stats.byCategory} dark /> : <p className="text-zinc-500">Aucune dépense plaisir ce mois-ci.</p>}
          {stats.incomeByCategory.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-500">D&apos;où vient l&apos;argent</p>
              <ul className="grid gap-1.5">
                {stats.incomeByCategory.map((t) => (
                  <li key={t.category.id} className="flex justify-between font-semibold">
                    <span>
                      {t.category.emoji} {t.category.label}
                    </span>
                    <span>{formatMoney(t.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>{stats.entries.length} lignes</Tag>}>Le journal</PanelTitle>
        {stats.entries.length ? (
          <EntryList entries={stats.entries} />
        ) : (
          <div className="flex flex-col items-center gap-6 py-12 text-center">
            <Slab tilt={-3} className="text-4xl">
              Rien ici
            </Slab>
            <p className="max-w-sm text-zinc-400">Ajoute ce que tu as gagné et ce que tu as cramé ce mois-ci. Raccourci : touche X.</p>
          </div>
        )}
      </Panel>
    </Screen>
  );
}
