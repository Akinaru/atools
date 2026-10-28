import { io } from "next/cache";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { App } from "../types";
import { api } from "./api";
import { monthName, MONTH_PATTERN, toDateString } from "./money";
import { readLedger } from "./server/store";
import { VIEW_COOKIES } from "./server/view";
import { GoalsView } from "./ui/GoalsView";
import { LinesView } from "./ui/LinesView";
import { MonthView } from "./ui/MonthView";
import { SETTINGS_TABS, SettingsView } from "./ui/SettingsView";
import { YearView } from "./ui/YearView";

async function Page({ path }: { path: string[] }) {
  const [section, sub, ...rest] = path;
  if (rest.length || (sub && section !== "reglages")) notFound();
  // The import moved into the settings.
  if (section === "import") redirect("/apps/monnaie/reglages/import");
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
  if (section === "lignes") return <LinesView ledger={ledger} />;
  if (section === "reglages") {
    const tab = SETTINGS_TABS.find((t) => t.key === (sub ?? ""));
    if (!tab) notFound();
    return <SettingsView ledger={ledger} today={today} tab={tab.key} />;
  }
  notFound();
}

/** "Octobre 2026 · Monnaie", "Réglages · Import · Monnaie"… The month and year shown are those of the page. */
async function title(path: string[]): Promise<string> {
  const [section, sub] = path;
  await io();
  const today = toDateString(new Date());
  const jar = await cookies();
  const name = (part: string) => `${part} · Monnaie`;
  if (!section) {
    const month = jar.get(VIEW_COOKIES.month)?.value;
    const shown = month && MONTH_PATTERN.test(month) ? month : today.slice(0, 7);
    const label = monthName(shown);
    return name(`${label.charAt(0).toUpperCase()}${label.slice(1)} ${shown.slice(0, 4)}`);
  }
  if (section === "annee") {
    const year = jar.get(VIEW_COOKIES.year)?.value;
    return name(`${year && /^\d{4}$/.test(year) ? year : today.slice(0, 4)} · L'année`);
  }
  if (section === "lignes") return name("Lignes");
  if (section === "objectifs") return name("Objectifs");
  if (section === "reglages") {
    const tab = SETTINGS_TABS.find((t) => t.key === (sub ?? ""));
    return name(tab ? `Réglages · ${tab.label}` : "Réglages");
  }
  return "Monnaie";
}

const app: App = {
  slug: "monnaie",
  name: "Monnaie",
  description: "Ce que je gagne, ce que je crame pour le plaisir, et ce qu'il me reste. Mois par mois.",
  icon: "💸",
  accent: "linear-gradient(135deg, #11121a, #272935 60%, #ff7a2f)",
  cover: "/assets/monnaie/tile.svg",
  Page,
  title,
  api,
  pwa: { manifest: "/assets/monnaie/manifest.webmanifest", appleIcon: "/assets/monnaie/apple-touch-icon.png" },
};

export default app;
