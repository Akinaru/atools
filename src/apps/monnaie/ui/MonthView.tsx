import Link from "next/link";
import type { CSSProperties } from "react";
import {
  budgetMood,
  categoriesOf,
  checkpointChecks,
  daysInMonth,
  debtBalances,
  formatMoney,
  formatSigned,
  monthDaily,
  monthName,
  monthStats,
  pendingRecurring,
  shiftMonth,
  type CategoryTotal,
  type Ledger,
  savingsAccountBalances,
  accountNamesOf,
  personalLedger,
  monthOf,
} from "../money";
import { categoryAverages, forecast } from "../insights";
import { addRecurringToMonth, showMonth } from "../server/actions";
import { CategoryBars } from "./charts";
import { MonthCompareChart } from "./MonthCompareChart";
import { EntryDialog } from "./EntryDialog";
import { JournalBrowser } from "./JournalBrowser";
import { ActionButton, AnimatedMoney } from "./motion";
import { ViewNav } from "./ViewNav";
import { BASE, buttonClass, Diamond, Panel, PanelTitle, Paper, Screen, Slab, Stamp, Tag } from "./kit";

/** Dashboard of one month. `today` is YYYY-MM-DD. */
export function MonthView({ ledger, month, today }: { ledger: Ledger; month: string; today: string }) {
  const stats = monthStats(ledger, month);
  // Balance of each livret at the end of the month.
  const livrets = savingsAccountBalances({ ...ledger, entries: ledger.entries.filter((e) => monthOf(e.date) <= month) });
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
  const defaultDate = isCurrent ? today : `${month}-01`;
  // Put aside this month, on the livret.
  const putAside = stats.saved;
  // The slate is all-time: what is still owed today, whatever the month shown.
  const debts = debtBalances(ledger.entries).filter((d) => d.iOwe || d.owesMe);
  const people = [...new Set(ledger.entries.flatMap((e) => (e.person ? [e.person] : [])))].sort((a, b) => a.localeCompare(b));
  const year = month.slice(0, 4);
  const categories = categoriesOf(ledger);
  const outlook = forecast(personalLedger(ledger), today);
  // The real balance: today for the current month, at the end of the month otherwise.
  const balance = isCurrent ? outlook.balance : stats.accountBalance;
  const lastCheck = checkpointChecks(ledger).at(-1);
  // The 5 previous months with data, to compare this month day by day.
  const compareMonths = Array.from({ length: 12 }, (_, i) => shiftMonth(month, -(i + 1)))
    .filter((m) => ledger.entries.some((e) => e.date.startsWith(m)))
    .slice(0, 5);
  const labelCounts: Record<string, number> = {};
  for (const e of ledger.entries) labelCounts[e.label] = (labelCounts[e.label] ?? 0) + 1;

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
          <ViewNav
            prev={showMonth.bind(null, shiftMonth(month, -1))}
            next={showMonth.bind(null, shiftMonth(month, 1))}
            today={showMonth.bind(null, null)}
            isToday={isCurrent}
            prevLabel="Mois précédent"
            nextLabel="Mois suivant"
          />
          <EntryDialog categories={categories} names={accountNamesOf(ledger)} defaultDate={defaultDate} hotkey people={people} />
        </>
      }
    >
      {pending.length > 0 && (
        <div className="mn-drop mb-12 flex flex-wrap items-center justify-between gap-4 border-2 border-dashed border-[var(--mn-accent)]/60 px-5 py-4" style={{ "--mn-tilt": "-0.6deg" } as CSSProperties}>
          <p className="text-[var(--mn-muted)]">
            <span className="mn-punch mr-2 text-xl text-[var(--mn-accent)]">⟳ {pending.length} récurrent{pending.length > 1 ? "s" : ""}</span>
            pas encore dans ce mois : {pending.map((r) => r.label).join(", ")}.
          </p>
          <ActionButton action={addRecurringToMonth.bind(null, month)} className={buttonClass("accent", "sm")}>
            <span>Ajouter</span>
          </ActionButton>
        </div>
      )}

      {/* Cockpit: the month's result, then the real balance, the budget and the savings next to it. */}
      <div className="grid items-start gap-8 xl:grid-cols-[1.35fr_1fr]">
        <Paper tilt={-1}>
          {stats.kept < 0 && <Stamp className="right-6 top-8 text-2xl">Dans le rouge</Stamp>}
          <Tag className="!text-zinc-500">Bilan {monthName(month).match(/^[aeiouy]/i) ? "d'" : "de "}{monthName(month)}</Tag>
          {/* Sentence under the number: only the number changes width while it rolls, nothing around it reflows. */}
          <div className="mt-2 grid gap-2">
            <p className={`mn-punch text-7xl sm:text-8xl ${stats.kept < 0 ? "text-[var(--mn-red)]" : ""}`}><AnimatedMoney value={stats.kept} signed /></p>
            <p className="font-semibold text-zinc-600">
              {stats.kept < 0 ? "dépensé en plus de ce que tu as gagné." : "gardé sur ce que tu as gagné."}
              {previous.entries.length > 0 && (
                <b className="block text-[var(--mn-ink)]">
                  {stats.kept >= previous.kept ? "Mieux" : "Moins bien"} qu&apos;en {monthName(previous.month)} ({formatSigned(previous.kept)}).
                </b>
              )}
            </p>
          </div>
          {/* Where the kept money went: the savings pockets, and what is left (or taken) on the account. */}
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="mn-punch -rotate-1 bg-[var(--mn-yellow)] px-3 pb-1 pt-1.5 text-lg text-[var(--mn-ink)] shadow-[3px_3px_0_var(--mn-ink)]">
              {formatSigned(putAside)} sur l&apos;épargne
            </span>
            <span
              className={`mn-punch rotate-1 px-3 pb-1 pt-1.5 text-lg shadow-[3px_3px_0_var(--mn-ink)] ${stats.left < 0 ? "bg-[var(--mn-red)] text-white" : "bg-[var(--mn-ink)] text-white"}`}
            >
              {formatSigned(stats.left)} sur le compte
            </span>
          </div>
          <div className={`mt-7 grid grid-cols-2 gap-4 border-t-2 border-dashed border-zinc-200 pt-5 ${stats.debtFlow ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            <MiniStat label="Encaissé" value={stats.income} />
            <MiniStat label="Charges" value={-stats.charges} signed muted />
            <MiniStat label="Plaisir" value={-stats.spent} signed accent />
            {stats.debtFlow !== 0 && <MiniStat label="Dettes" value={stats.debtFlow} signed muted />}
          </div>
          {(stats.biggest || stats.regret > 0) && (
            <ul className="mt-5 grid gap-1.5 text-sm text-zinc-600">
              {stats.biggest && (
                <Diamond>
                  <span>
                    Plus grosse folie : <b className="text-[var(--mn-ink)]">{stats.biggest.label}</b> ({formatMoney(stats.biggest.amount)})
                  </span>
                </Diamond>
              )}
              {stats.regret > 0 && (
                <Diamond className="text-[var(--mn-red)]">
                  <span>Regretté 😬 : {formatMoney(stats.regret)}</span>
                </Diamond>
              )}
            </ul>
          )}
        </Paper>

        <div className="grid gap-6">
          <Panel>
            <div className="flex items-baseline justify-between gap-3">
              <Tag>Solde réel</Tag>
              {lastCheck && (
                <Link href={`${BASE}/reglages/pointages`} className="text-sm font-semibold text-[var(--mn-muted)] hover:text-white">
                  [pointé le {lastCheck.checkpoint.date.slice(8)}/{lastCheck.checkpoint.date.slice(5, 7)}{" "}
                  {lastCheck.gap === null || lastCheck.gap === 0 ? "✓" : <span className="text-[var(--mn-red)]">⚠ {formatSigned(lastCheck.gap)}</span>}]
                </Link>
              )}
            </div>
            {balance === null ? (
              <p className="mt-3 text-lg">
                <Link href={`${BASE}/reglages/pointages`} className="font-bold underline decoration-[var(--mn-accent)] decoration-4 underline-offset-4">
                  Pointe ton solde
                </Link>{" "}
                pour suivre ton vrai compte et sa prévision au 31.
              </p>
            ) : (
              <>
                <p className={`mn-punch mt-2 text-5xl ${balance < 0 ? "text-[var(--mn-red)]" : ""}`}><AnimatedMoney value={balance} /></p>
                <p className="mt-1 text-[var(--mn-muted)]">
                  {isCurrent && outlook.endOfMonth !== null ? (
                    <>
                      aujourd&apos;hui · prévu au {days}/{month.slice(5)} : <b className="text-white">{formatMoney(outlook.endOfMonth)}</b>
                      {outlook.upcoming.length > 0 && ` (${outlook.upcoming.map((r) => r.label.split(" ")[0]).join(", ")} à venir)`}
                    </>
                  ) : (
                    <>fin {monthName(month)}</>
                  )}
                </p>
              </>
            )}
          </Panel>

          <Panel>
            <div className="flex items-baseline justify-between gap-3">
              <Tag>Budget plaisir</Tag>
              {stats.budget > 0 && (
                <span className={`mn-punch text-2xl ${stats.spent > stats.budget ? "text-[var(--mn-red)]" : "text-[var(--mn-accent)]"}`}>
                  {Math.round((stats.spent / stats.budget) * 100)} %
                </span>
              )}
            </div>
            {stats.budget > 0 ? (
              <>
                <div className="relative mb-3 mt-4 h-3 bg-black/30">
                  <div
                    className="mn-grow h-full"
                    style={{ width: `${Math.min(stats.spent / stats.budget, 1) * 100}%`, background: stats.spent > stats.budget ? "var(--mn-red)" : "var(--mn-accent)" }}
                  />
                  {isCurrent && <span className="absolute -bottom-1.5 -top-1.5 w-[3px] bg-white" style={{ left: `${(day / days) * 100}%` }} title="Rythme idéal aujourd'hui" />}
                </div>
                <p className="text-[var(--mn-muted)]">
                  {budgetLeft >= 0 ? `${formatMoney(budgetLeft)} dispo` : `${formatMoney(-budgetLeft)} de trop`}
                  {perDayLeft !== null && ` · ${formatMoney(perDayLeft)} / jour jusqu'au ${days}`}
                  {projection !== null && stats.spent > 0 && ` · à ce rythme ${formatMoney(projection)}`}
                </p>
              </>
            ) : (
              <p className="mt-3 text-[var(--mn-muted)]">
                {formatMoney(stats.spent)} cramés ·{" "}
                <Link href={`${BASE}/reglages`} className="font-bold text-white underline decoration-[var(--mn-accent)] decoration-4 underline-offset-4">
                  fixe un budget
                </Link>
              </p>
            )}
          </Panel>

          <Panel>
            <div className="flex items-baseline justify-between gap-3">
              <Tag>Épargne</Tag>
              {stats.savingsRate !== null && <span className="mn-punch text-2xl text-[var(--mn-yellow)]">{Math.round(stats.savingsRate * 100)} %</span>}
            </div>
            <p className={`mn-punch mt-2 text-4xl ${putAside < 0 ? "text-[var(--mn-red)]" : ""}`}>
              <AnimatedMoney value={putAside} signed /> <span className="text-lg text-[var(--mn-muted)]">mis de côté</span>
            </p>
            <p className="mt-1 text-[var(--mn-muted)]">
              {ledger.savingsAccounts.length > 1 ? "Livrets" : "Solde du livret"} : {formatMoney(stats.savingsBalance)}
              {stats.interest > 0 && ` · +${formatMoney(stats.interest)} d'intérêts`}
            </p>
            {ledger.savingsAccounts.length > 1 && (
              <ul className="mt-2 grid gap-1 text-sm">
                {ledger.savingsAccounts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3">
                    <span className="text-[var(--mn-muted)]">
                      {a.emoji} {a.name}
                    </span>
                    <b>{formatMoney(livrets.get(a.id) ?? 0)}</b>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-3">
        <Panel>
          <PanelTitle aside={<Tag>vs ta moyenne</Tag>}>Catégories</PanelTitle>
          {stats.byCategory.length ? (
            <CategoryBars totals={stats.byCategory} dark budgets={ledger.categoryBudgets} averages={categoryAverages(personalLedger(ledger), month, "expense")} />
          ) : (
            <p className="text-zinc-500">Aucune dépense plaisir ce mois-ci.</p>
          )}
          <TotalsList title="Les charges" totals={stats.chargesByCategory} total={stats.charges} empty="Aucune charge ce mois-ci." />
          <TotalsList title="D'où vient l'argent" totals={stats.incomeByCategory} total={stats.income} />
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelTitle aside={<Tag>cumulé, jour par jour</Tag>}>{monthName(month)} vs les autres mois</PanelTitle>
          <MonthCompareChart current={monthDaily(ledger, month)} others={compareMonths.map((m) => monthDaily(ledger, m))} today={isCurrent ? day : undefined} />
        </Panel>
      </div>

      {debts.length > 0 && (
        <Panel className="mt-6">
          <PanelTitle aside={<Tag>Toutes périodes</Tag>}>L&apos;ardoise</PanelTitle>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {debts.map((d, i) => (
              <li
                key={d.person}
                className="mn-shape flex items-center gap-4 px-4 py-3 drop-shadow-[0.3rem_0.35rem_0_rgba(0,0,0,0.45)] [transform:rotate(var(--mn-tilt))]"
                style={{ "--mn-shape": "var(--mn-panel-2)", "--mn-tilt": `${i % 2 ? 0.5 : -0.5}deg` } as CSSProperties}
              >
                <span className="mn-punch flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center bg-white pt-1 text-xl text-[var(--mn-ink)] shadow-[3px_3px_0_var(--mn-ink)]">
                  {d.person.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{d.person}</span>
                  <span className="block text-sm text-[var(--mn-muted)]">
                    {d.iOwe > 0 && d.owesMe > 0 ? "Vous vous devez des sous" : d.iOwe > 0 ? "Tu lui dois" : "Te doit"}
                  </span>
                </span>
                <span className="text-right">
                  {d.iOwe > 0 && <span className="mn-punch block text-2xl text-[var(--mn-red)]">−{formatMoney(d.iOwe)}</span>}
                  {d.owesMe > 0 && <span className="mn-punch block text-2xl text-white">+{formatMoney(d.owesMe)}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-[var(--mn-muted)]">Pour solder : ajoute une ligne « Dette » → « Je rembourse » ou « On me rembourse » avec le même prénom.</p>
        </Panel>
      )}

      <Panel className="mt-6 scroll-mt-6" id="journal">
        <PanelTitle aside={<Tag>{stats.entries.length} lignes</Tag>}>Le journal du mois</PanelTitle>
        {stats.entries.length ? (
          <JournalBrowser entries={stats.entries} categories={categories} names={accountNamesOf(ledger)} labelCounts={labelCounts} />
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

/** Small "category · amount" list under a dashed rule, with its total. */
function TotalsList({ title, totals, total, empty }: { title: string; totals: CategoryTotal[]; total: number; empty?: string }) {
  if (!totals.length && !empty) return null;
  return (
    <div className="mt-8 border-t border-white/10 pt-5">
      <p className="mb-3 flex justify-between text-sm font-bold uppercase tracking-wider text-zinc-500">
        <span>{title}</span>
        {totals.length > 0 && <span className="text-white">{formatMoney(total)}</span>}
      </p>
      {totals.length ? (
        <ul className="grid gap-1.5">
          {totals.map((t) => (
            <li key={t.category.id} className="flex justify-between font-semibold">
              <span>
                {t.category.emoji} {t.category.label}
              </span>
              <span>{formatMoney(t.total)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">{empty}</p>
      )}
    </div>
  );
}

/** Small label + number of the month's breakdown, under the big result. */
function MiniStat({ label, value, signed = false, muted = false, accent = false }: { label: string; value: number; signed?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mn-punch text-2xl ${accent ? "text-[var(--mn-accent)]" : muted ? "text-zinc-500" : ""}`}><AnimatedMoney value={value} signed={signed} /></div>
    </div>
  );
}
