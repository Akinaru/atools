import { io } from "next/cache";
import { notFound } from "next/navigation";
import type { App } from "../types";
import { api } from "./api";
import { MONTH_PATTERN, toDateString } from "./money";
import { readLedger } from "./server/store";
import { GoalsView } from "./ui/GoalsView";
import { ImportView } from "./ui/ImportView";
import { OperationsView } from "./ui/OperationsView";
import { MonthView } from "./ui/MonthView";
import { SettingsView } from "./ui/SettingsView";
import { YearView } from "./ui/YearView";

async function Page({ path }: { path: string[] }) {
  const [section, param, ...rest] = path;
  if (rest.length) notFound();
  // The default month and year depend on today's date.
  await io();
  const today = toDateString(new Date());
  const ledger = await readLedger();

  if (!section) return <MonthView ledger={ledger} month={today.slice(0, 7)} today={today} />;
  if (section === "mois" && param && MONTH_PATTERN.test(param)) return <MonthView ledger={ledger} month={param} today={today} />;
  if (section === "annee" && (!param || /^\d{4}$/.test(param))) return <YearView ledger={ledger} year={Number(param ?? today.slice(0, 4))} today={today} />;
  if (section === "objectifs" && !param) return <GoalsView ledger={ledger} />;
  if (section === "reglages" && !param) return <SettingsView ledger={ledger} today={today} />;
  if (section === "import" && !param) return <ImportView />;
  if (section === "operations" && !param) return <OperationsView ledger={ledger} />;
  notFound();
}

const app: App = {
  slug: "monnaie",
  name: "Monnaie",
  description: "Ce que je gagne, ce que je crame pour le plaisir, et ce qu'il me reste. Mois par mois.",
  icon: "💸",
  accent: "linear-gradient(135deg, #11121a, #272935 60%, #ff7a2f)",
  Page,
  api,
};

export default app;
