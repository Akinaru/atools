// What a bank operation becomes in Monnaie: the user's rules first, then the bank's own categories.
// Pure functions: shared by the import screen, the Server Actions and the API.

import { MAIN_ACCOUNT, type ImportRule, type Kind } from "../money";
import type { BankOperation } from "./caisse-epargne";

export type Suggestion = {
  ignore: boolean;
  kind: Kind;
  category: string;
  label: string;
  person?: string;
  /** Transfer: the accounts it goes from and to. */
  account?: string;
  to?: string;
  /** Where it comes from: a learned rule, the bank categories, or nothing better. */
  source: "rule" | "bank" | "default";
};

/** "VIR. VERS Thibaud  Evrard" -> "VERS THIBAUD EVRARD"; "Spotify P43135B" -> "SPOTIFY". Rules match on it. */
export function normalizeBankLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/^(VIREMENT|VIR\.?)\s+(VERS|DE)\s+/, "$2 ")
    .split(/\s+/)
    .filter((word, i) => i === 0 || !/\d/.test(word))
    .join(" ")
    .trim();
}

const TITLES = new Set(["M", "MR", "MME", "MLE", "MLLE", "MADAME", "MONSIEUR"]);

/** Public bodies and companies that send money with an "a categoriser" bank category. */
const ORGANIZATIONS = /^(DDFIP|DGFIP|CAF|CPAM|URSSAF|POLE EMPLOI|FRANCE TRAVAIL|TRESOR|SAS|SARL|SA|EURL|SCI)\b|\b(SAS|SARL|SA|SCI)\.?$/;

/**
 * "VERS THIBAUD EVRARD" or "MLE LENNIE ROLLIER" -> "Thibaud" / "Lennie"; undefined when it is not a name.
 * Money received needs a title or a first and last name, so a company name ("GENESII") is not taken for a person.
 */
function personOf(label: string): string | undefined {
  const normalized = normalizeBankLabel(label);
  const outgoing = normalized.startsWith("VERS ");
  const all = normalized.replace(/^(VERS|DE) /, "").split(" ");
  if (ORGANIZATIONS.test(all.join(" "))) return undefined;
  const words = all.filter((w) => !TITLES.has(w));
  const titled = words.length < all.length;
  if (words.length < 1 || words.length > 4 || !words.every((w) => /^[A-Z'-]+$/.test(w))) return undefined;
  if (!outgoing && !titled && words.length < 2) return undefined;
  return words[0].charAt(0) + words[0].slice(1).toLowerCase();
}

/** Subscriptions billed every month, among the bank's "Vidéo, musique et jeux". */
const SUBSCRIPTIONS = /SPOTIFY|APPLE|SOUNDCLOUD|NETFLIX|DEEZER|DISNEY|CANAL|PRIME|UBER ONE|YOUTUBE|CONTABO|CHATGPT|OPENAI/;

type Target = Pick<Suggestion, "kind" | "category"> & { ignore?: boolean };

/** Mapping of the Caisse d'Épargne categories ("Sous categorie", then "Categorie"). */
function fromBank(op: BankOperation): Target | undefined {
  const sub = op.bankSubcategory;
  const out = op.amount < 0;
  const label = normalizeBankLabel(op.label);

  // Bank fees and their refund cancel each other out: not worth a line.
  if (/^(REMISE )?COTISATIONS BANCAIRES|^REMISE COTISATIONS/.test(label)) return { ignore: true, kind: "charge", category: "banque" };
  if (op.type === "Frais bancaires") return { kind: "charge", category: "banque" };
  // Transfers between my own accounts at the bank: the livret.
  if (op.bankCategory === "Transaction exclue") return { kind: "savings", category: out ? "depot" : "retrait" };
  if (/^DDFIP|IMPOTS|TRESOR PUBLIC/.test(label) && !out) return { kind: "income", category: "remboursement" };

  const bySub: Record<string, Target> = {
    "Hyper/supermarche": { kind: "charge", category: "courses" },
    "Alimentation - autre": { kind: "charge", category: "courses" },
    "Petit commercant": { kind: "charge", category: "courses" },
    "Restauration rapide": { kind: "expense", category: "resto" },
    Restaurant: { kind: "expense", category: "resto" },
    Bar: { kind: "expense", category: "sorties" },
    "Expo, musee, cinema": { kind: "expense", category: "sorties" },
    "Loisirs et vacances - autre": { kind: "expense", category: "jeux" },
    "Video, Musique et jeux": { kind: "expense", category: SUBSCRIPTIONS.test(label) ? "abonnements" : "jeux" },
    "Sport, Gym et Equipement": op.type === "Prelevement" ? { kind: "charge", category: "sport" } : { kind: "expense", category: "jeux" },
    "Shopping et services - autre": { kind: "expense", category: SUBSCRIPTIONS.test(label) ? "abonnements" : "shopping" },
    "High-Tech/Electromenager": { kind: "expense", category: SUBSCRIPTIONS.test(label) ? "abonnements" : "tech" },
    "Vetements et chaussures": { kind: "expense", category: "shopping" },
    "Coiffeurs et soins du corps": { kind: "expense", category: "autre" },
    "Cadeaux et dons": { kind: "expense", category: "cadeaux" },
    "Peage et Stationnement": { kind: "charge", category: "transport" },
    "Transports en commun": { kind: "charge", category: "transport" },
    Carburant: { kind: "charge", category: "essence" },
    "Travaux - Entretien": { kind: "charge", category: "maison" },
    "Ameublement et appareil": { kind: "charge", category: "maison" },
    "Internet et telephonie": { kind: "charge", category: "internet" },
    "Energie eau, gaz, electricite, fioul": { kind: "charge", category: "electricite" },
    Salaires: { kind: "income", category: "salaire" },
    "Aides et allocations": { kind: "income", category: "aides" },
  };
  if (bySub[sub]) return bySub[sub];

  const byCategory: Record<string, Target> = {
    "Impots et taxes": { kind: "charge", category: "impots" },
    "Banque et assurances": { kind: "charge", category: "assurances" },
    Sante: { kind: "charge", category: "sante" },
    Transports: { kind: "charge", category: "transport" },
    "Logement - maison": { kind: "charge", category: "maison" },
    Alimentation: { kind: "charge", category: "courses" },
    "Loisirs et vacances": { kind: "expense", category: "jeux" },
    "Shopping et services": { kind: "expense", category: "shopping" },
    "Juridique et administratif": { kind: "charge", category: "autre" },
  };
  if (byCategory[op.bankCategory]) return byCategory[op.bankCategory];
  if (op.bankCategory === "Revenus et rentrees d'argent") return { kind: "income", category: out ? "autre" : "remboursement" };
  return undefined;
}

export function suggest(op: BankOperation, rules: ImportRule[]): Suggestion {
  const match = normalizeBankLabel(op.label);
  // An exact label rule wins over a keyword rule ("CONTABO" in "WWW CONTABO COM").
  const rule = rules.find((r) => !r.contains && r.match === match) ?? rules.find((r) => r.contains && match.includes(r.match));
  const out = op.amount < 0;

  if (rule) {
    if (rule.ignore) return { ignore: true, kind: out ? "expense" : "income", category: "autre", label: op.label, source: "rule" };
    if (rule.kind && rule.category) {
      // A pocket or a debt rule keeps the direction of the money: the rule tells which pocket/person.
      let category = rule.category;
      if (rule.kind === "savings") category = out ? "depot" : "retrait";
      if (rule.kind === "debt" && (rule.category === "rembourse" || rule.category === "recu")) category = out ? "rembourse" : "recu";
      // A transfer leaves the imported (main) account when the money goes out, and comes into it otherwise.
      if (rule.kind === "transfer" && rule.account) {
        const [account, to] = out ? [MAIN_ACCOUNT.id, rule.account] : [rule.account, MAIN_ACCOUNT.id];
        return { ignore: false, kind: "transfer", category: "virement", label: rule.label || op.label, account, to, source: "rule" };
      }
      return { ignore: false, kind: rule.kind, category, label: rule.label || op.label, person: rule.person, source: "rule" };
    }
  }

  // Money sent to / received from a person: a debt being settled, by default.
  const isTransfer = op.type === "Virement" || op.type === "Virement recu";
  if (isTransfer && op.bankCategory.startsWith("A categoriser")) {
    const person = personOf(op.label);
    if (person) return { ignore: false, kind: "debt", category: out ? "rembourse" : "recu", label: op.label, person, source: "bank" };
  }
  if (op.type === "Retrait d'especes") return { ignore: false, kind: "expense", category: "autre", label: "ESPÈCES", source: "bank" };

  const bank = fromBank(op);
  // A refund (money in) on a spending category is a refund, not a negative expense.
  if (bank && !bank.ignore && !out && bank.kind !== "income" && bank.kind !== "savings") {
    return { ignore: false, kind: "income", category: "remboursement", label: op.label, source: "bank" };
  }
  if (bank) return { ignore: !!bank.ignore, kind: bank.kind, category: bank.category, label: op.label, source: "bank" };
  return { ignore: false, kind: out ? "expense" : "income", category: "autre", label: op.label, source: "default" };
}
