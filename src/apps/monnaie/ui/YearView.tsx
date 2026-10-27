import { formatMoney, formatSigned, KIND_LABELS, monthName, yearStats, type Ledger } from "../money";
import { detectRecurring } from "../insights";
import { openMonth, showYear } from "../server/actions";
import { CategoryBars, YearChart } from "./charts";
import { Diamond, Panel, PanelTitle, Paper, Screen, Stamp, Tag } from "./kit";
import { AnimatedMoney, PendingButton } from "./motion";
import { ViewNav } from "./ViewNav";

/** Overview of a year: totals, month by month chart and table. `today` is YYYY-MM-DD. */
export function YearView({ ledger, year, today }: { ledger: Ledger; year: number; today: string }) {
  const stats = yearStats(ledger, year);
  // Recurring lines as of the last month of the year with data (or this month for the current year).
  const refMonth = year === Number(today.slice(0, 4)) ? today.slice(0, 7) : `${year}-12`;
  const recurring = detectRecurring(ledger, refMonth);
  const recurringOut = recurring.filter((r) => r.kind !== "income").reduce((n, r) => n + r.amount, 0);
  // Put aside: on the livret.
  const aside = (m: { saved: number }) => m.saved;
  const yearAside = aside(stats);
  const active = stats.months.filter((m) => m.entries.length > 0);
  const best = active.reduce<(typeof active)[number] | undefined>((b, m) => (!b || aside(m) > aside(b) ? m : b), undefined);
  const worst = active.reduce<(typeof active)[number] | undefined>((w, m) => (!w || m.spent > w.spent ? m : w), undefined);
  const averageSpent = active.length ? Math.round(stats.spent / active.length) : 0;
  const overBudget = stats.months.filter((m) => m.budget && m.spent > m.budget).length;
  const averageSaved = active.length ? Math.round(yearAside / active.length) : 0;
  const endBalance = (active.at(-1) ?? stats.months[0]).savingsBalance;
  const savingsRate = stats.income > 0 ? Math.round((yearAside / stats.income) * 100) : null;

  return (
    <Screen
      section="annee"
      title={year}
      subtitle={`${active.length} mois remplis sur 12`}
      hints={["← → changer d'année"]}
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
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <Paper tilt={-1}>
          {yearAside < 0 && <Stamp className="right-6 top-8 text-2xl">Pioché</Stamp>}
          <Tag className="!text-zinc-500">Bilan {year}</Tag>
          <p className={`mn-punch mt-2 text-6xl sm:text-7xl ${yearAside < 0 ? "text-[var(--mn-red)]" : ""}`}><AnimatedMoney value={yearAside} signed /></p>
          <p className="mt-1 font-semibold text-zinc-500">
            mis sur le livret{savingsRate !== null && ` · ${savingsRate} % de ce que tu as gagné`}
          </p>
          <ul className="mn-punch mt-7 grid gap-3 text-xl">
            <Diamond>
              Encaissé <span className="ml-auto">{formatMoney(stats.income)}</span>
            </Diamond>
            <Diamond className="text-zinc-500">
              Charges <span className="ml-auto">{formatMoney(stats.charges)}</span>
            </Diamond>
            <Diamond>
              Cramé pour le plaisir <span className="ml-auto">{formatMoney(stats.spent)}</span>
            </Diamond>
            <Diamond>
              Gardé <span className="ml-auto">{formatSigned(stats.kept)}</span>
            </Diamond>
            <Diamond className="text-zinc-500">
              dont sur le compte <span className="ml-auto">{formatSigned(stats.left)}</span>
            </Diamond>
            <Diamond className="text-[var(--mn-red)]">
              Regretté 😬 <span className="ml-auto">{formatMoney(stats.regret)}</span>
            </Diamond>
          </ul>
        </Paper>
        <Paper tilt={1.2}>
          <Tag className="!text-zinc-500">Les records</Tag>
          <ul className="mt-5 grid gap-4 text-lg">
            <Diamond>
              <span>
                Meilleur mois d&apos;épargne : <b>{best ? `${monthName(best.month)} (${formatSigned(aside(best))})` : "—"}</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Mois le plus dépensier : <b>{worst ? `${monthName(worst.month)} (${formatMoney(worst.spent)})` : "—"}</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Moyenne cramée : <b>{formatMoney(averageSpent)} / mois</b> · épargnée : <b>{formatMoney(averageSaved)} / mois</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Budget explosé : <b>{overBudget} fois</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Catégorie n°1 : <b>{stats.byCategory[0] ? `${stats.byCategory[0].category.emoji} ${stats.byCategory[0].category.label}` : "—"}</b>
              </span>
            </Diamond>
          </ul>
        </Paper>
      </div>

      <Panel className="mt-12">
        <PanelTitle aside={<Tag>Livret : {formatMoney(endBalance)}</Tag>}>Où va l&apos;argent</PanelTitle>
        <YearChart months={stats.months} current={today.slice(0, 7)} />
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelTitle aside={<Tag>{formatMoney(stats.spent)}</Tag>}>Où part le fric (plaisir)</PanelTitle>
          {stats.byCategory.length ? <CategoryBars totals={stats.byCategory} dark /> : <p className="text-zinc-500">Aucune dépense cette année.</p>}
        </Panel>
        <Panel>
          <PanelTitle aside={<Tag>{formatMoney(stats.charges)}</Tag>}>Les charges</PanelTitle>
          {stats.chargesByCategory.length ? <CategoryBars totals={stats.chargesByCategory} dark /> : <p className="text-zinc-500">Aucune charge cette année.</p>}
        </Panel>
      </div>

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

      <div className="mt-6">
        <Panel>
          <PanelTitle>Mois par mois</PanelTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="pb-3 font-bold">Mois</th>
                  <th className="pb-3 text-right font-bold">Encaissé</th>
                  <th className="pb-3 text-right font-bold">Charges</th>
                  <th className="pb-3 text-right font-bold">Cramé</th>
                  <th className="pb-3 text-right font-bold">Gardé</th>
                  <th className="pb-3 text-right font-bold">→ Épargne</th>
                  <th className="pb-3 text-right font-bold">→ Compte</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {stats.months.map((m) => (
                  <tr key={m.month} className={m.entries.length ? "" : "text-zinc-600"}>
                    <td className="py-2.5">
                      <form action={openMonth.bind(null, m.month)}>
                        <PendingButton className="mn-punch text-base capitalize hover:text-[var(--mn-accent)]" title={`Voir ${monthName(m.month)}`}>
                          {monthName(m.month)}
                        </PendingButton>
                      </form>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(m.income)}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-400">{formatMoney(m.charges)}</td>
                    <td className={`py-2.5 text-right font-semibold ${m.budget && m.spent > m.budget ? "text-[var(--mn-red)]" : ""}`}>{formatMoney(m.spent)}</td>
                    <td className={`py-2.5 text-right font-bold ${m.kept < 0 ? "text-[var(--mn-red)]" : m.kept > 0 ? "text-[var(--mn-accent)]" : ""}`}>{formatSigned(m.kept)}</td>
                    <td className={`py-2.5 text-right font-semibold ${aside(m) < 0 ? "text-[var(--mn-red)]" : aside(m) > 0 ? "text-[var(--mn-yellow)]" : ""}`}>{formatSigned(aside(m))}</td>
                    <td className={`py-2.5 text-right font-semibold ${m.left < 0 ? "text-[var(--mn-red)]" : "text-zinc-400"}`}>{formatSigned(m.left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
