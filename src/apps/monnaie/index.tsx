import { io } from "next/cache";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { App } from "../types";
import { api } from "./api";
import { MONTH_PATTERN, toDateString } from "./money";
import { readLedger } from "./server/store";
import { VIEW_COOKIES } from "./server/view";
import { GoalsView } from "./ui/GoalsView";
import { ImportView } from "./ui/ImportView";
import { OperationsView } from "./ui/OperationsView";
import { MonthView } from "./ui/MonthView";
import { SettingsView } from "./ui/SettingsView";
import { YearView } from "./ui/YearView";

async function Page({ path }: { path: string[] }) {
  const [section, ...rest] = path;
  if (rest.length) notFound();
  // The default month and year depend on today's date.
  await io();
  const today = toDateString(new Date());
  const ledger = await readLedger();
  // The month / year shown is remembered in a cookie by the ◀ ▶ buttons, so the URL stays the same.
  const jar = await cookies();
  const month = jar.get(VIEW_COOKIES.month)?.value;
  const year = jar.get(VIEW_COOKIES.year)?.value;

  if (!section) return <MonthView ledger={ledger} month={month && MONTH_PATTERN.test(month) ? month : today.slice(0, 7)} today={today} />;
  if (section === "annee") return <YearView ledger={ledger} year={year && /^\d{4}$/.test(year) ? Number(year) : Number(today.slice(0, 4))} today={today} />;
  if (section === "objectifs") return <GoalsView ledger={ledger} />;
  if (section === "reglages") return <SettingsView ledger={ledger} today={today} />;
  if (section === "import") return <ImportView />;
  if (section === "operations") return <OperationsView ledger={ledger} />;
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
