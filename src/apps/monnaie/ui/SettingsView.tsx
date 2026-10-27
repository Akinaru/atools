import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { accountBalanceAt, accountFlow, accountNamesOf, categoriesOf, checkpointChecks, formatDay, formatMoney, formatSigned, getCategory, KIND_LABELS, savingsAccountBalances, type Ledger } from "../money";
import { removeCategory, removeCheckpoint, removeCurrentAccount, removeRecurring, removeRule, removeSavingsAccount } from "../server/actions";
import { CategoryBudgetsForm, CategoryForm, CheckpointForm, CurrentAccountForm, RecurringForm, RestoreForm, SavingsAccountForm, SettingsForm } from "./forms";
import { ImportClient } from "./ImportClient";
import { LinkPending, PendingButton } from "./motion";
import { BASE, buttonClass, Panel, PanelTitle, Paper, Screen, squareClass, Tag } from "./kit";

/** Tabs of the settings, each at /reglages/<key> (the first one at /reglages). */
export const SETTINGS_TABS = [
  { key: "", label: "Budget", emoji: "🎯", hint: "Plafond plaisir, par catégorie" },
  { key: "comptes", label: "Comptes", emoji: "🏦", hint: "Tes comptes, tes livrets et leur solde" },
  { key: "import", label: "Import", emoji: "📥", hint: "Relevés bancaires, règles" },
  { key: "categories", label: "Catégories", emoji: "🏷️", hint: "Les tiennes" },
  { key: "recurrents", label: "Récurrents", emoji: "⟳", hint: "Ce qui revient chaque mois" },
  { key: "pointages", label: "Pointages", emoji: "📍", hint: "Le vrai solde du compte" },
  { key: "donnees", label: "Données", emoji: "💾", hint: "Export, sauvegarde" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["key"];

export function SettingsView({ ledger, today, tab }: { ledger: Ledger; today: string; tab: SettingsTab }) {
  const current = SETTINGS_TABS.find((t) => t.key === tab)!;
  return (
    <Screen section="reglages" title="Réglages" subtitle={`${current.emoji} ${current.label} · ${current.hint}`}>
      <div className="grid items-start gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:sticky lg:top-6 lg:grid lg:overflow-visible lg:pb-0" aria-label="Réglages">
          {SETTINGS_TABS.map((t) =>
            t.key === tab ? (
              <span
                key={t.key}
                aria-current="page"
                className="mn-punch flex shrink-0 -rotate-1 items-center gap-3 bg-white px-4 pb-2 pt-3 text-lg text-[var(--mn-ink)] shadow-[4px_4px_0_var(--mn-accent)]"
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
              </span>
            ) : (
              <Link
                key={t.key}
                href={t.key ? `${BASE}/reglages/${t.key}` : `${BASE}/reglages`}
                className="mn-punch relative flex shrink-0 items-center gap-3 px-4 pb-2 pt-3 text-lg text-[var(--mn-muted)] transition hover:translate-x-1 hover:text-white"
              >
                <span aria-hidden>{t.emoji}</span>
                {t.label}
                <LinkPending />
              </Link>
            ),
          )}
        </nav>
        <div className="grid min-w-0 gap-6">{TABS[tab](ledger, today)}</div>
      </div>
    </Screen>
  );
}

const TABS: Record<SettingsTab, (ledger: Ledger, today: string) => ReactNode> = {
  "": (ledger) => (
    <>
      <Paper tilt={-0.6}>
        <Tag className="!text-zinc-500">Le cadre</Tag>
        <h2 className="mn-punch mb-6 mt-2 text-4xl">Budget plaisir</h2>
        <SettingsForm settings={ledger.settings} />
      </Paper>
          <Panel>
            <PanelTitle aside={<Tag>€ / mois</Tag>}>Budgets par catégorie</PanelTitle>
            <p className="mb-5 max-w-3xl text-zinc-400">
              Un plafond par catégorie plaisir (ex. Restau 80 €). Sur la page du mois, la barre montre le plafond et passe au rouge s&apos;il est dépassé. Vide = pas
              de plafond.
            </p>
            <CategoryBudgetsForm categories={categoriesOf(ledger).expense} budgets={ledger.categoryBudgets} />
          </Panel>
    </>
  ),
  comptes: (ledger, today) => {
    const balances = savingsAccountBalances(ledger);
    const main = accountBalanceAt(ledger, today);
    const unassigned = (balances.get("") ?? 0) + ledger.settings.savingsStart;
    const total = [...balances.values()].reduce((n, b) => n + b, 0) + ledger.settings.savingsStart;
    return (
      <>
        <Panel>
          <PanelTitle aside={<Tag>{ledger.accounts.length + 1}</Tag>}>Tes comptes courants</PanelTitle>
          <p className="mb-5 max-w-3xl text-zinc-400">
            Le compte principal (Caisse d&apos;Épargne) suit tes pointages de solde. Chaque autre compte (Revolut, Crédit Mutuel…) a ses propres lignes, et les
            virements entre tes comptes sont neutres : ni dépense ni revenu. Un compte pro est affiché ici mais reste hors de tes stats perso.
          </p>
          <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AccountCard emoji="💳" name="Compte courant" hint="principal · d'après tes pointages" balance={main} />
            {ledger.accounts.map((a) => {
              const count = ledger.entries.filter((e) => e.account === a.id || e.to === a.id).length;
              return (
                <AccountCard
                  key={a.id}
                  emoji={a.emoji}
                  name={a.name}
                  hint={`${a.personal ? "" : "pro · "}${count} ligne${count > 1 ? "s" : ""}`}
                  balance={ledger.entries.reduce((n, e) => n + accountFlow(e, a.id), a.start ?? 0)}
                  remove={count ? undefined : removeCurrentAccount.bind(null, a.id)}
                />
              );
            })}
          </ul>
          <CurrentAccountForm />
        </Panel>

        <Panel>
          <PanelTitle aside={<Tag>{formatMoney(total)} en tout</Tag>}>Tes livrets</PanelTitle>
          <p className="mb-5 max-w-3xl text-zinc-400">
            Chaque virement vers ou depuis l&apos;épargne appartient à un livret. Importe le relevé d&apos;un livret (onglet Import) : ses virements sont
            rattachés aux lignes du compte courant, et ses intérêts ajoutés.
          </p>
          {ledger.savingsAccounts.length > 0 && (
            <ul className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ledger.savingsAccounts.map((a) => {
                const count = ledger.entries.filter((e) => e.kind === "savings" && e.livret === a.id).length;
                return (
                  <li key={a.id} className="mn-shape flex items-center gap-3 px-4 py-3" style={{ "--mn-shape": "var(--mn-panel-2)" } as CSSProperties}>
                    <span className="flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center bg-[var(--mn-yellow)] text-xl shadow-[3px_3px_0_var(--mn-ink)]" aria-hidden>
                      {a.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="mn-punch block text-lg leading-tight">{a.name}</span>
                      <span className="block truncate text-sm text-zinc-500">
                        {count} ligne{count > 1 ? "s" : ""}
                      </span>
                    </span>
                    <span className="mn-punch text-xl text-[var(--mn-yellow)]">{formatMoney(balances.get(a.id) ?? 0)}</span>
                    <form action={removeSavingsAccount.bind(null, a.id)}>
                      <PendingButton className={squareClass()} label={`Supprimer ${a.name}`} title="Supprimer (ses lignes restent, sans livret)">
                        ✕
                      </PendingButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
          {unassigned !== 0 && (
            <p className="mb-6 text-sm text-zinc-400">
              Pas encore rattaché à un livret : <b className="text-white">{formatMoney(unassigned)}</b>
            </p>
          )}
          <SavingsAccountForm />
        </Panel>
      </>
    );
  },
  import: (ledger) => (
    <>
      <ImportClient names={accountNamesOf(ledger)} />
          <Panel>
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
                            : [rule.kind && KIND_LABELS[rule.kind], rule.kind && rule.category && getCategory(rule.kind, rule.category, categoriesOf(ledger)).label, rule.person, rule.label]
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
    </>
  ),
  categories: (ledger) => (
        <Panel>
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
  ),
  recurrents: (ledger) => (
    <>
      <Paper tilt={0.5}>
        <Tag className="!text-zinc-500">Chaque mois</Tag>
        <h2 className="mn-punch mb-2 mt-2 text-4xl">Nouveau récurrent</h2>
        <p className="mb-6 text-zinc-600">Salaire, loyer, électricité, assurances, abonnements… Sur la page du mois, un bouton les ajoute tous d&apos;un coup.</p>
        <RecurringForm categories={categoriesOf(ledger)} />
      </Paper>
          <Panel>
            <PanelTitle aside={<Tag>{ledger.recurring.length}</Tag>}>Tes récurrents</PanelTitle>
            {ledger.recurring.length ? (
              <ul className="divide-y divide-white/10">
                {ledger.recurring.map((r) => {
                  const category = getCategory(r.kind, r.category, categoriesOf(ledger));
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
    </>
  ),
  pointages: (ledger, today) => (
        <Panel>
          <PanelTitle aside={<Tag>{ledger.checkpoints.length}</Tag>}>Pointages du solde</PanelTitle>
          <p className="mb-5 max-w-3xl text-zinc-400">
            Note de temps en temps le solde de ton compte courant (le soir, opérations du jour passées). L&apos;app s&apos;en sert pour afficher ton vrai solde
            chaque mois, et compare chaque pointage au précédent : un écart veut dire qu&apos;une opération manque ou est en double entre les deux dates.
          </p>
          <CheckpointForm today={today} />
          {checkpointChecks(ledger).length > 0 && (
            <ul className="mt-6 divide-y divide-white/10">
              {checkpointChecks(ledger).reverse().map(({ checkpoint, expected, gap }) => (
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
  ),
  donnees: () => (
        <Panel>
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
  ),
};

function AccountCard({ emoji, name, hint, balance, remove }: { emoji: string; name: string; hint: string; balance: number | null; remove?: () => Promise<void> }) {
  return (
    <li className="mn-shape flex items-center gap-3 px-4 py-3" style={{ "--mn-shape": "var(--mn-panel-2)" } as CSSProperties}>
      <span className="flex h-11 w-11 shrink-0 -rotate-6 items-center justify-center bg-white text-xl shadow-[3px_3px_0_var(--mn-ink)]" aria-hidden>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mn-punch block text-lg leading-tight">{name}</span>
        <span className="block truncate text-sm text-zinc-500">{hint}</span>
      </span>
      <span className={`mn-punch text-xl ${balance !== null && balance < 0 ? "text-[var(--mn-red)]" : ""}`}>{balance === null ? "—" : formatMoney(balance)}</span>
      {remove && (
        <form action={remove}>
          <PendingButton className={squareClass()} label={`Supprimer ${name}`}>
            ✕
          </PendingButton>
        </form>
      )}
    </li>
  );
}
