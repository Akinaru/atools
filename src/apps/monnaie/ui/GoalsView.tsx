import { formatMoney, freeMoney, type Ledger } from "../money";
import { DeleteGoalButton, GoalMoneyForm, NewGoalForm } from "./forms";
import { Panel, PanelTitle, Paper, Screen, Slab, Stamp, Tag } from "./kit";

/** Savings goals: money put aside, taken from what is left. */
export function GoalsView({ ledger }: { ledger: Ledger }) {
  const free = freeMoney(ledger);
  const saved = ledger.goals.reduce((n, g) => n + g.saved, 0);
  const targets = ledger.goals.reduce((n, g) => n + g.target, 0);

  return (
    <Screen
      section="objectifs"
      title="Objectifs"
      subtitle={
        <p>
          {formatMoney(saved, true)} rangés sur {formatMoney(targets, true)} visés ·{" "}
          <span className={free < 0 ? "text-[var(--mn-red)]" : "text-[var(--mn-accent)]"}>{formatMoney(free, true)} du livret pas encore attribués</span>
        </p>
      }
    >
      {ledger.goals.length === 0 && (
        <div className="mb-12 flex flex-col items-center gap-5 py-6 text-center">
          <Slab tilt={2} className="text-4xl">
            Vise un truc
          </Slab>
          <p className="max-w-md text-zinc-400">Un voyage, une console, un matelas de sécurité… Crée un objectif et range de l&apos;argent dedans au fil des mois.</p>
        </div>
      )}

      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
        {ledger.goals.map((goal, i) => {
          const ratio = Math.min(goal.saved / goal.target, 1);
          const done = goal.saved >= goal.target;
          return (
            <Paper key={goal.id} tilt={[-1.5, 1, -0.6, 1.6][i % 4]}>
              {done && <Stamp className="right-16 top-20 text-3xl" tilt={-12}>Atteint</Stamp>}
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-14 w-14 -rotate-6 items-center justify-center bg-[var(--mn-ink)] text-3xl">{goal.emoji}</span>
                <DeleteGoalButton id={goal.id} name={goal.name} />
              </div>
              <h2 className="mn-punch mt-4 text-3xl">{goal.name}</h2>
              <p className="mt-1 font-semibold text-zinc-500">
                {formatMoney(goal.saved)} / {formatMoney(goal.target)}
              </p>
              <div className="relative mt-4 h-8 -rotate-1 border-[3px] border-[var(--mn-ink)] bg-zinc-100 shadow-[3px_3px_0_var(--mn-ink)]">
                <div className="mn-grow h-full bg-[var(--mn-accent)]" style={{ width: `${ratio * 100}%` }} />
                <span className="mn-punch absolute inset-0 flex items-center justify-center pt-0.5 text-sm">{Math.floor(ratio * 100)} %</span>
              </div>
              <p className="mn-punch mb-4 mt-3 text-lg">{done ? "Bien joué. Tu peux le dépenser sans regret." : `Encore ${formatMoney(goal.target - goal.saved, true)}`}</p>
              <GoalMoneyForm id={goal.id} />
            </Paper>
          );
        })}
      </div>

      <Panel className="mt-14">
        <PanelTitle aside={<Tag>Nouveau</Tag>}>Nouvel objectif</PanelTitle>
        <NewGoalForm />
      </Panel>
    </Screen>
  );
}
