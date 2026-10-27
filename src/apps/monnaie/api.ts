import { apiError, json, type ApiRoute } from "@/lib/api";
import { byDateDesc, categoriesOf, getCategory, KIND_LABELS, MONTH_PATTERN, monthStats, signedAmount, type Categories, type CategoryTotal, type Entry } from "./money";
import { BankFileError, decodeBankFile, parseCaisseEpargneCsv } from "./import/caisse-epargne";
import { normalizeBankLabel, suggest } from "./import/suggest";
import { addEntry, deleteEntry, importOperations, LedgerError, readLedger, refreshBookedDates } from "./server/store";

// API of the app, served at /api/monnaie/... Amounts are integers in cents.

const entryJson = (entry: Entry, categories: Categories) => ({ ...entry, categoryLabel: getCategory(entry.kind, entry.category, categories).label });

/** CSV cell: quotes doubled, and a leading ' on text that a spreadsheet would run as a formula. */
const csvCell = (value: string | number) =>
  typeof value === "number" ? String(value).replace(".", ",") : `"${value.replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;

export const api: ApiRoute[] = [
  {
    method: "GET",
    path: "entries",
    description: "Lignes (revenus et dépenses), les plus récentes d'abord. Filtres : ?month=AAAA-MM, ?kind=income|expense|charge|savings|debt.",
    handler: async ({ url }) => {
      const month = url.searchParams.get("month");
      const kind = url.searchParams.get("kind");
      if (month && !MONTH_PATTERN.test(month)) return apiError(400, "Mois invalide (AAAA-MM).");
      const ledger = await readLedger();
      const categories = categoriesOf(ledger);
      return json(
        ledger.entries
          .filter((e) => (!month || e.date.startsWith(month)) && (!kind || e.kind === kind))
          .sort(byDateDesc)
          .map((e) => entryJson(e, categories)),
      );
    },
  },
  {
    method: "POST",
    path: "entries",
    description: "Ajoute une ligne. JSON : { kind (income|expense|charge|savings|debt), amount (centimes), label, category, date (AAAA-MM-JJ), note?, regret?, person? }. Livret : category depot ou retrait. Dette : person requis, category dette, rembourse, pret ou recu.",
    handler: async ({ request }) => {
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return apiError(400, "Corps JSON invalide.");
      }
      if (typeof body !== "object" || body === null || Array.isArray(body)) return apiError(400, "Corps JSON invalide.");
      try {
        const entry = await addEntry(body as Parameters<typeof addEntry>[0]);
        return json(entryJson(entry, categoriesOf(await readLedger())), { status: 201 });
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
    description: "Bilan d'un mois : encaissé, charges, cramé, livret (net et solde), reste, budget, par catégorie.",
    handler: async ({ params }) => {
      if (!MONTH_PATTERN.test(params.month)) return apiError(400, "Mois invalide (AAAA-MM).");
      const ledger = await readLedger();
      const stats = monthStats(ledger, params.month);
      const categories = (totals: CategoryTotal[]) => totals.map((t) => ({ category: t.category.id, label: t.category.label, total: t.total, count: t.count }));
      return json({
        month: stats.month,
        income: stats.income,
        spent: stats.spent,
        regret: stats.regret,
        charges: stats.charges,
        saved: stats.saved,
        savingsBalance: stats.savingsBalance,
        accountBalance: stats.accountBalance,
        kept: stats.kept,
        left: stats.left,
        savingsRate: stats.savingsRate,
        budget: stats.budget,
        entries: stats.entries.length,
        biggest: stats.biggest ? entryJson(stats.biggest, categoriesOf(ledger)) : null,
        byCategory: categories(stats.byCategory),
        incomeByCategory: categories(stats.incomeByCategory),
        chargesByCategory: categories(stats.chargesByCategory),
      });
    },
  },
  {
    method: "POST",
    path: "import",
    description:
      "Importe un export CSV Caisse d'Épargne (corps brut) avec les règles et catégories de la banque. ?dryRun=1 : renvoie seulement ce qui serait importé.",
    handler: async ({ request, url }) => {
      try {
        const operations = parseCaisseEpargneCsv(decodeBankFile(new Uint8Array(await request.arrayBuffer())));
        if (!url.searchParams.get("dryRun")) await refreshBookedDates(operations);
        const ledger = await readLedger();
        const known = new Set(ledger.entries.map((e) => e.importId).filter(Boolean));
        const rows = operations
          .filter((op) => !known.has(op.importId))
          .map((op) => {
            const s = suggest(op, ledger.rules);
            return { op, s };
          });
        if (url.searchParams.get("dryRun")) {
          return json({
            alreadyImported: operations.length - rows.length,
            rows: rows.map(({ op, s }) => ({ date: op.date, bankLabel: op.label, match: normalizeBankLabel(op.label), amount: op.amount, ...s })),
          });
        }
        const result = await importOperations(
          rows.map(({ op, s }) => ({
            importId: op.importId,
            ignore: s.ignore,
            kind: s.kind,
            category: s.category,
            label: s.label,
            person: s.person,
            amount: Math.abs(op.amount),
            date: op.date,
            bookedDate: op.bookedDate,
          })),
        );
        return json({ ...result, alreadyImported: operations.length - rows.length });
      } catch (error) {
        if (error instanceof BankFileError || error instanceof LedgerError) return apiError(400, error.message);
        throw error;
      }
    },
  },
  {
    method: "GET",
    path: "backup.json",
    description: "Sauvegarde complète (lignes, récurrents, objectifs, règles, réglages), à restaurer depuis les Réglages.",
    handler: async () =>
      new Response(JSON.stringify(await readLedger(), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="monnaie-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      }),
  },
  {
    method: "GET",
    path: "export.csv",
    description: "Toutes les lignes en CSV (séparateur ;, montants en euros, effet sur le compte courant).",
    handler: async () => {
      const ledger = await readLedger();
      const categories = categoriesOf(ledger);
      const rows = [...ledger.entries].sort(byDateDesc).map((e) =>
        [
          csvCell(e.date),
          csvCell(KIND_LABELS[e.kind]),
          csvCell(getCategory(e.kind, e.category, categories).label),
          csvCell(e.label),
          csvCell(signedAmount(e) / 100),
          csvCell(e.regret ? "oui" : ""),
          csvCell(e.person ?? ""),
          csvCell(e.note),
        ].join(";"),
      );
      // BOM so Excel reads the accents as UTF-8.
      const csv = "﻿" + ["Date;Type;Catégorie;Libellé;Montant (€);Regretté;Personne;Note", ...rows].join("\r\n");
      return new Response(csv, {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="monnaie.csv"' },
      });
    },
  },
];
