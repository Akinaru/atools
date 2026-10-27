import Link from "next/link";
import { formatMoney, formatSigned, monthName, yearStats, type Ledger } from "../money";
import { CategoryBars, YearChart } from "./charts";
import { KeyNav } from "./KeyNav";
import { BASE, Diamond, Panel, PanelTitle, Paper, Screen, squareClass, Stamp, Tag } from "./kit";

/** Overview of a year: totals, month by month chart and table. `today` is YYYY-MM-DD. */
export function YearView({ ledger, year, today }: { ledger: Ledger; year: number; today: string }) {
  const stats = yearStats(ledger, year);
  const active = stats.months.filter((m) => m.entries.length > 0);
  const best = active.reduce<(typeof active)[number] | undefined>((b, m) => (!b || m.saved > b.saved ? m : b), undefined);
  const worst = active.reduce<(typeof active)[number] | undefined>((w, m) => (!w || m.spent > w.spent ? m : w), undefined);
  const averageSpent = active.length ? Math.round(stats.spent / active.length) : 0;
  const overBudget = stats.months.filter((m) => m.budget && m.spent > m.budget).length;
  const averageSaved = active.length ? Math.round(stats.saved / active.length) : 0;
  const endBalance = (active.at(-1) ?? stats.months[0]).savingsBalance;
  const savingsRate = stats.income > 0 ? Math.round((stats.saved / stats.income) * 100) : null;

  return (
    <Screen
      section="annee"
      title={year}
      subtitle={`${active.length} mois remplis sur 12`}
      hints={["← → changer d'année"]}
      actions={
        <div className="flex items-center gap-2">
          <KeyNav prev={`${BASE}/annee/${year - 1}`} next={`${BASE}/annee/${year + 1}`} />
          <Link href={`${BASE}/annee/${year - 1}`} className={squareClass()} aria-label={`Année ${year - 1}`}>
            ◀
          </Link>
          <Link href={`${BASE}/annee/${year + 1}`} className={squareClass()} aria-label={`Année ${year + 1}`}>
            ▶
          </Link>
        </div>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <Paper tilt={-1}>
          {stats.saved < 0 && <Stamp className="right-6 top-8 text-2xl">Pioché</Stamp>}
          <Tag className="!text-zinc-500">Bilan {year}</Tag>
          <p className={`mn-punch mt-2 text-6xl sm:text-7xl ${stats.saved < 0 ? "text-[var(--mn-red)]" : ""}`}>{formatSigned(stats.saved, true)}</p>
          <p className="mt-1 font-semibold text-zinc-500">
            mis sur le livret{savingsRate !== null && ` · ${savingsRate} % de ce que tu as gagné`}
          </p>
          <ul className="mn-punch mt-7 grid gap-3 text-xl">
            <Diamond>
              Encaissé <span className="ml-auto">{formatMoney(stats.income, true)}</span>
            </Diamond>
            <Diamond className="text-zinc-500">
              Charges <span className="ml-auto">{formatMoney(stats.charges, true)}</span>
            </Diamond>
            <Diamond>
              Cramé pour le plaisir <span className="ml-auto">{formatMoney(stats.spent, true)}</span>
            </Diamond>
            <Diamond>
              Resté sur le compte <span className="ml-auto">{formatSigned(stats.left, true)}</span>
            </Diamond>
            <Diamond className="text-[var(--mn-red)]">
              Regretté 😬 <span className="ml-auto">{formatMoney(stats.regret, true)}</span>
            </Diamond>
          </ul>
        </Paper>
        <Paper tilt={1.2}>
          <Tag className="!text-zinc-500">Les records</Tag>
          <ul className="mt-5 grid gap-4 text-lg">
            <Diamond>
              <span>
                Meilleur mois d&apos;épargne : <b>{best ? `${monthName(best.month)} (${formatSigned(best.saved, true)})` : "—"}</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Mois le plus dépensier : <b>{worst ? `${monthName(worst.month)} (${formatMoney(worst.spent, true)})` : "—"}</b>
              </span>
            </Diamond>
            <Diamond>
              <span>
                Moyenne cramée : <b>{formatMoney(averageSpent, true)} / mois</b> · épargnée : <b>{formatMoney(averageSaved, true)} / mois</b>
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
        <PanelTitle aside={<Tag>Livret : {formatMoney(endBalance, true)}</Tag>}>Où va l&apos;argent</PanelTitle>
        <YearChart months={stats.months} current={today.slice(0, 7)} />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel>
          <PanelTitle>Où part le fric</PanelTitle>
          {stats.byCategory.length ? <CategoryBars totals={stats.byCategory} dark /> : <p className="text-zinc-500">Aucune dépense cette année.</p>}
        </Panel>
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
                  <th className="pb-3 text-right font-bold">Livret</th>
                  <th className="pb-3 text-right font-bold">Reste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {stats.months.map((m) => (
                  <tr key={m.month} className={m.entries.length ? "" : "text-zinc-600"}>
                    <td className="py-2.5">
                      <Link href={`${BASE}/mois/${m.month}`} className="mn-punch text-base capitalize hover:text-[var(--mn-accent)]">
                        {monthName(m.month)}
                      </Link>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{formatMoney(m.income, true)}</td>
                    <td className="py-2.5 text-right font-semibold text-zinc-400">{formatMoney(m.charges, true)}</td>
                    <td className={`py-2.5 text-right font-semibold ${m.budget && m.spent > m.budget ? "text-[var(--mn-red)]" : ""}`}>{formatMoney(m.spent, true)}</td>
                    <td className={`py-2.5 text-right font-bold ${m.saved < 0 ? "text-[var(--mn-red)]" : m.saved > 0 ? "text-[var(--mn-yellow)]" : ""}`}>{formatSigned(m.saved, true)}</td>
                    <td className={`py-2.5 text-right font-bold ${m.left < 0 ? "text-[var(--mn-red)]" : m.left > 0 ? "text-[var(--mn-accent)]" : ""}`}>{formatSigned(m.left, true)}</td>
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
