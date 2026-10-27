import { apiError, json, type ApiRoute } from "@/lib/api";
import { byDateDesc, getCategory, MONTH_PATTERN, monthStats, type CategoryTotal, type Entry } from "./money";
import { addEntry, deleteEntry, LedgerError, readLedger } from "./server/store";

// API of the app, served at /api/monnaie/... Amounts are integers in cents.

const entryJson = (entry: Entry) => ({ ...entry, categoryLabel: getCategory(entry.kind, entry.category).label });

/** CSV cell: quotes doubled, and a leading ' on text that a spreadsheet would run as a formula. */
const csvCell = (value: string | number) =>
  typeof value === "number" ? String(value).replace(".", ",") : `"${value.replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;

export const api: ApiRoute[] = [
  {
    method: "GET",
    path: "entries",
    description: "Lignes (revenus et dépenses), les plus récentes d'abord. Filtres : ?month=AAAA-MM, ?kind=income|expense.",
    handler: async ({ url }) => {
      const month = url.searchParams.get("month");
      const kind = url.searchParams.get("kind");
      if (month && !MONTH_PATTERN.test(month)) return apiError(400, "Mois invalide (AAAA-MM).");
      const { entries } = await readLedger();
      return json(entries.filter((e) => (!month || e.date.startsWith(month)) && (!kind || e.kind === kind)).sort(byDateDesc).map(entryJson));
    },
  },
  {
    method: "POST",
    path: "entries",
    description: "Ajoute une ligne. JSON : { kind, amount (centimes), label, category, date (AAAA-MM-JJ), note?, regret? }.",
    handler: async ({ request }) => {
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return apiError(400, "Corps JSON invalide.");
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return apiError(400, "Corps JSON invalide.");
      try {
        return json(entryJson(await addEntry(body as Parameters<typeof addEntry>[0])), { status: 201 });
      } catch (error) {
        if (error instanceof LedgerError) return apiError(400, error.message);
        throw error;
      }
    },
  },
  {
    method: "DELETE",
    path: "entries/:id",
    description: "Supprime une ligne.",
    handler: async ({ params }) => ((await deleteEntry(params.id)) ? new Response(null, { status: 204 }) : apiError(404, "Ligne introuvable.")),
  },
  {
    method: "GET",
    path: "months/:month",
    description: "Bilan d'un mois : encaissé, cramé, reste, budget, par catégorie.",
    handler: async ({ params }) => {
      if (!MONTH_PATTERN.test(params.month)) return apiError(400, "Mois invalide (AAAA-MM).");
      const stats = monthStats(await readLedger(), params.month);
      const categories = (totals: CategoryTotal[]) => totals.map((t) => ({ category: t.category.id, label: t.category.label, total: t.total, count: t.count }));
      return json({
        month: stats.month,
        income: stats.income,
        spent: stats.spent,
        regret: stats.regret,
        fixedCosts: stats.fixedCosts,
        left: stats.left,
        savingsRate: stats.savingsRate,
        budget: stats.budget,
        entries: stats.entries.length,
        biggest: stats.biggest ? entryJson(stats.biggest) : null,
        byCategory: categories(stats.byCategory),
        incomeByCategory: categories(stats.incomeByCategory),
      });
    },
  },
  {
    method: "GET",
    path: "export.csv",
    description: "Toutes les lignes en CSV (séparateur ;, montants en euros).",
    handler: async () => {
      const { entries } = await readLedger();
      const rows = [...entries].sort(byDateDesc).map((e) =>
        [
          csvCell(e.date),
          csvCell(e.kind === "income" ? "Revenu" : "Dépense"),
          csvCell(getCategory(e.kind, e.category).label),
          csvCell(e.label),
          csvCell((e.kind === "income" ? e.amount : -e.amount) / 100),
          csvCell(e.regret ? "oui" : ""),
          csvCell(e.note),
        ].join(";"),
      );
      // BOM so Excel reads the accents as UTF-8.
      const csv = "﻿" + ["Date;Type;Catégorie;Libellé;Montant (€);Regretté;Note", ...rows].join("\r\n");
      return new Response(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="monnaie.csv"' },
      });
    },
  },
];
