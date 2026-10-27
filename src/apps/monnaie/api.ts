import { apiError, json, type ApiRoute } from "@/lib/api";
import { byDateDesc, categoriesOf, getCategory, KIND_LABELS, MONTH_PATTERN, monthStats, signedAmount, type Categories, type CategoryTotal, type Entry } from "./money";
import { parseBankFile } from "./import/banks";
import { BankFileError, decodeBankFile } from "./import/csv";
import { planImport, resolveTarget, rowsAsSuggested } from "./import/plan";
import {
  addEntry,
  deleteEntry,
  applyImport,
  LedgerError,
  ledgerVersion,
  patchEntry,
  readLedger,
  refreshBookedDates,
  restoreLedger,
  VersionConflictError,
} from "./server/store";

/** Reads a JSON object body, or returns the 400 response to send. */
async function jsonBody(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) return body;
  } catch {}
  return apiError(400, "Corps JSON invalide.");
}

/** "abc" or W/"abc" from If-Match (the backup's ETag), or the X-Ledger-Version header. */
const expectedVersion = (request: Request) =>
  (request.headers.get("if-match") ?? request.headers.get("x-ledger-version") ?? "").replace(/^W\//, "").replace(/"/g, "").trim();

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
      const body = await jsonBody(request);
      if (body instanceof Response) return body;
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
    method: "PATCH",
    path: "entries/:id",
    description: "Modifie une ligne : seuls les champs envoyés changent (kind, amount en centimes, label, category, date, note, regret, person).",
    handler: async ({ request, params }) => {
      const body = await jsonBody(request);
      if (body instanceof Response) return body;
      try {
        const entry = await patchEntry(params.id, body);
        return json(entryJson(entry, categoriesOf(await readLedger())));
      } catch (error) {
        if (error instanceof LedgerError) return apiError(error.message === "Ligne introuvable." ? 404 : 400, error.message);
        throw error;
      }
    },
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
      "Importe un export bancaire (corps brut : CSV Caisse d'Épargne, Revolut ou Crédit Mutuel) tel que suggéré : nouvelles lignes ajoutées, virements déjà vus de l'autre compte rattachés. ?account=account:<id> ou livret:<id> (sinon deviné d'après la banque). ?dryRun=1 : renvoie seulement le plan.",
    handler: async ({ request, url }) => {
      try {
        const bank = parseBankFile(decodeBankFile(new Uint8Array(await request.arrayBuffer())));
        const dryRun = !!url.searchParams.get("dryRun");
        const target = resolveTarget(await readLedger(), bank, url.searchParams.get("account") ?? "");
        if (!dryRun && bank.bank === "caisse-epargne" && target.type === "account") await refreshBookedDates(bank.operations);
        const plan = planImport(await readLedger(), bank, target);
        const count = (status: string) => plan.rows.filter((r) => r.status === status).length;
        const summary = { bank: bank.bankName, target, from: plan.from, to: plan.to, known: count("known"), twins: count("twin"), new: count("new"), balanceBefore: plan.balanceBefore, fileBalance: plan.fileBalance };
        if (dryRun) {
          return json({
            ...summary,
            rows: plan.rows.filter((r) => r.status !== "known").map((r) => ({ date: r.date, bankLabel: r.label, match: r.match, amount: r.amount, status: r.status, twin: r.twin, ...r.suggestion })),
          });
        }
        return json({ ...summary, ...(await applyImport(target, rowsAsSuggested(plan), plan.start ?? undefined)) });
      } catch (error) {
        if (error instanceof BankFileError || error instanceof LedgerError) return apiError(400, error.message);
        throw error;
      }
    },
  },
  {
    method: "GET",
    path: "backup.json",
    description: "Sauvegarde complète (lignes, récurrents, objectifs, règles, réglages). En-tête ETag = version, à renvoyer en If-Match pour la remplacer.",
    handler: async () => {
      const ledger = await readLedger();
      return new Response(JSON.stringify(ledger, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="monnaie-${new Date().toISOString().slice(0, 10)}.json"`,
          ETag: `"${ledgerVersion(ledger)}"`,
        },
      });
    },
  },
  {
    method: "PUT",
    path: "backup.json",
    description:
      "Remplace toute la base par le JSON envoyé. If-Match (ETag lu) obligatoire : 412 si la base a changé entre-temps. L'ancienne base est gardée sur le serveur.",
    handler: async ({ request }) => {
      const version = expectedVersion(request);
      if (!version) return apiError(428, "En-tête If-Match requis : l'ETag de la sauvegarde que tu as lue (GET /backup.json).");
      try {
        const count = await restoreLedger(await request.text(), version);
        return json({ status: "replaced", entries: count, version: ledgerVersion(await readLedger()) });
      } catch (error) {
        if (error instanceof VersionConflictError) return apiError(412, error.message);
        if (error instanceof LedgerError) return apiError(400, error.message);
        throw error;
      }
    },
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
