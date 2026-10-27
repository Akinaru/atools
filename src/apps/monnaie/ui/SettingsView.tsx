import type { CSSProperties } from "react";
import { categoriesOf, checkpointChecks, formatDay, formatMoney, formatSigned, getCategory, KIND_LABELS, type Ledger } from "../money";
import { removeCategory, removeCheckpoint, removeRecurring, removeRule } from "../server/actions";
import { CategoryBudgetsForm, CategoryForm, CheckpointForm, RecurringForm, RestoreForm, SettingsForm } from "./forms";
import { PendingButton } from "./motion";
import { buttonClass, Panel, PanelTitle, Paper, Screen, squareClass, Tag } from "./kit";

export function SettingsView({ ledger, today }: { ledger: Ledger; today: string }) {
  const checks = checkpointChecks(ledger).reverse();
  const categories = categoriesOf(ledger);
  return (
    <Screen section="reglages" title="Réglages" subtitle="Ton budget plaisir et ce qui revient chaque mois (salaire, loyer, factures…).">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
        <Paper tilt={-1}>
          <Tag className="!text-zinc-500">Le cadre</Tag>
          <h2 className="mn-punch mb-6 mt-2 text-4xl">Budget</h2>
          <SettingsForm settings={ledger.settings} />
        </Paper>

        <Paper tilt={0.8}>
          <Tag className="!text-zinc-500">Chaque mois</Tag>
          <h2 className="mn-punch mb-2 mt-2 text-4xl">Récurrents</h2>
          <p className="mb-6 text-zinc-600">Salaire, loyer, électricité, assurances, abonnements… Sur la page du mois, un bouton les ajoute tous d&apos;un coup.</p>
          <RecurringForm categories={categories} />
        </Paper>
      </div>

      <Panel className="mt-14">
        <div id="pointages" className="scroll-mt-6" />
        <PanelTitle aside={<Tag>{ledger.checkpoints.length}</Tag>}>Pointages du solde</PanelTitle>
        <p className="mb-5 max-w-3xl text-zinc-400">
          Note de temps en temps le solde de ton compte courant (le soir, opérations du jour passées). L&apos;app s&apos;en sert pour afficher ton vrai solde
          chaque mois, et compare chaque pointage au précédent : un écart veut dire qu&apos;une opération manque ou est en double entre les deux dates.
        </p>
        <CheckpointForm today={today} />
        {checks.length > 0 && (
          <ul className="mt-6 divide-y divide-white/10">
            {checks.map(({ checkpoint, expected, gap }) => (
              <li key={checkpoint.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold capitalize">{formatDay(checkpoint.date)}</span>
                  <span className="block text-sm text-zinc-500">
                    {expected === null
                      ? "Premier pointage : la référence."
                      : gap === 0
                        ? "Pile ce que prévoyaient tes opérations."
                        : `Attendu ${formatMoney(expected)} d'après tes opérations depuis le pointage précédent.`}
                  </span>
                </span>
                <span className="mn-punch text-2xl">{formatMoney(checkpoint.balance)}</span>
                {gap !== null && (
                  <span
                    className={`mn-punch -rotate-2 border-2 px-2 pt-1 text-sm ${gap === 0 ? "border-emerald-400 text-emerald-400" : "border-[var(--mn-red)] text-[var(--mn-red)]"}`}
                  >
                    {gap === 0 ? "✓ OK" : `Écart ${formatSigned(gap)}`}
                  </span>
                )}
                <form action={removeCheckpoint.bind(null, checkpoint.id)}>
                  <PendingButton className={squareClass()} label={`Supprimer le pointage du ${checkpoint.date}`}>
                    ✕
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>{ledger.customCategories.length}</Tag>}>Tes catégories</PanelTitle>
        <p className="mb-5 max-w-3xl text-zinc-400">
          Crée tes propres catégories pour des stats plus fines (ex. « Domaine &amp; VPS » avec les mots-clés CONTABO, OVH). Elles apparaissent partout :
          saisie, import, graphiques.
        </p>
        <CategoryForm />
        {ledger.customCategories.length > 0 && (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ledger.customCategories.map((c) => {
              const count = ledger.entries.filter((e) => e.kind === c.kind && e.category === c.id).length;
              const keywords = ledger.rules.filter((r) => r.contains && r.category === c.id).map((r) => r.match);
              return (
                <li key={c.id} className="mn-shape flex items-center gap-3 px-4 py-3" style={{ "--mn-shape": "var(--mn-panel-2)" } as CSSProperties}>
                  <span className="flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center bg-white text-xl shadow-[3px_3px_0_var(--mn-ink)]" aria-hidden>
                    {c.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mn-punch block truncate text-lg">{c.label}</span>
                    <span className="block truncate text-sm text-zinc-500">
                      {KIND_LABELS[c.kind]} · {count} ligne{count > 1 ? "s" : ""}
                      {keywords.length > 0 && ` · ${keywords.join(", ")}`}
                    </span>
                  </span>
                  <form action={removeCategory.bind(null, c.id)}>
                    <PendingButton className={squareClass()} label={`Supprimer la catégorie ${c.label}`} title="Supprimer (ses lignes passent en « Autre »)">
                      ✕
                    </PendingButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>€ / mois</Tag>}>Budgets par catégorie</PanelTitle>
        <p className="mb-5 max-w-3xl text-zinc-400">
          Un plafond par catégorie plaisir (ex. Restau 80 €). Sur la page du mois, la barre montre le plafond et passe au rouge s&apos;il est dépassé. Vide = pas
          de plafond.
        </p>
        <CategoryBudgetsForm categories={categories.expense} budgets={ledger.categoryBudgets} />
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>{ledger.recurring.length}</Tag>}>Tes récurrents</PanelTitle>
        {ledger.recurring.length ? (
          <ul className="divide-y divide-white/10">
            {ledger.recurring.map((r) => {
              const category = getCategory(r.kind, r.category, categories);
              return (
                <li key={r.id} className="flex items-center gap-4 py-3">
                  <span className="text-2xl" aria-hidden>
                    {category.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-bold">{r.label}</span>
                    <span className="block text-sm text-zinc-500">
                      {KIND_LABELS[r.kind]} · {category.label} · le {r.day}
                    </span>
                  </span>
                  <span className={`mn-punch text-xl ${r.kind === "expense" ? "text-[var(--mn-accent)]" : ""}`}>{formatMoney(r.amount)}</span>
                  <form action={removeRecurring.bind(null, r.id)}>
                    <PendingButton className={squareClass()} label={`Supprimer ${r.label}`}>
                      ✕
                    </PendingButton>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-zinc-500">Aucun récurrent pour l&apos;instant.</p>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelTitle aside={<Tag>{ledger.rules.length}</Tag>}>Règles d&apos;import</PanelTitle>
        {ledger.rules.length ? (
          <ul className="divide-y divide-white/10">
            {[...ledger.rules]
              .sort((a, b) => a.match.localeCompare(b.match))
              .map((rule) => (
                <li key={rule.match} className="flex items-center gap-4 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{rule.match}</span>
                    <span className="block truncate text-sm text-zinc-500">
                      {rule.ignore
                        ? "Ignorée à l'import"
                        : [rule.kind && KIND_LABELS[rule.kind], rule.kind && rule.category && getCategory(rule.kind, rule.category, categories).label, rule.person, rule.label]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <form action={removeRule.bind(null, rule.match)}>
                    <PendingButton className={squareClass()} label={`Supprimer la règle ${rule.match}`}>
                      ✕
                    </PendingButton>
                  </form>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-zinc-500">Aucune règle. Elles se créent quand tu corriges une ligne pendant un import.</p>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelTitle>Exporter & sauvegarder</PanelTitle>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <p className="text-zinc-400">Toutes tes lignes en CSV (Excel, Numbers, Google Sheets), ou une sauvegarde complète à restaurer ailleurs (ex. passer du local à la prod).</p>
            <div className="flex flex-wrap gap-4">
              <a href="/api/monnaie/export.csv" className={buttonClass("dark", "sm")}>
                <span>CSV</span>
              </a>
              <a href="/api/monnaie/backup.json" className={buttonClass("accent", "sm")}>
                <span>Sauvegarde</span>
              </a>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <p className="text-zinc-400">Restaurer une sauvegarde remplace tout. Les données actuelles sont gardées dans un fichier à part, au cas où.</p>
            <RestoreForm />
          </div>
        </div>
      </Panel>
    </Screen>
  );
}
