import { formatMoney, getCategory, KIND_LABELS, type Ledger } from "../money";
import { removeRecurring } from "../server/actions";
import { RecurringForm, SettingsForm } from "./forms";
import { buttonClass, Panel, PanelTitle, Paper, Screen, squareClass, Tag } from "./kit";

export function SettingsView({ ledger }: { ledger: Ledger }) {
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
          <RecurringForm />
        </Paper>
      </div>

      <Panel className="mt-14">
        <PanelTitle aside={<Tag>{ledger.recurring.length}</Tag>}>Tes récurrents</PanelTitle>
        {ledger.recurring.length ? (
          <ul className="divide-y divide-white/10">
            {ledger.recurring.map((r) => {
              const category = getCategory(r.kind, r.category);
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
                    <button className={squareClass()} aria-label={`Supprimer ${r.label}`}>
                      ✕
                    </button>
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
        <PanelTitle>Exporter</PanelTitle>
        <p className="mb-4 text-zinc-400">Toutes tes lignes en CSV (Excel, Numbers, Google Sheets).</p>
        <a href="/api/monnaie/export.csv" className={buttonClass("dark", "sm")}>
          <span>Télécharger</span>
        </a>
      </Panel>
    </Screen>
  );
}
