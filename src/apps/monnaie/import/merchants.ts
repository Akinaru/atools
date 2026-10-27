// Built-in category of a shop from its name, for exports without the bank's own categories (Revolut, Crédit Mutuel).
// Only a starting point: rules and the history of the ledger come first.

import type { Kind } from "../money";

const SHOPS: [kind: Kind, category: string, words: string[]][] = [
  ["charge", "courses", ["INTERMARCH", "MONOPRIX", "MONOP", "CARREFOUR", "AUCHAN", "CASINO", "LIDL", "ALDI", "LECLERC", "FRANPRIX", "SUPER U", "CONAD", "PANIERE", "BOULANGERIE"]],
  ["charge", "transport", ["UBER *TRIP", "UBER BV", "SIBRA", "SNCF", "KEOLIS", "SEMITAG", "RATP", "AREA", "TOTAL", "BLABLACAR", "MISTER AUTO"]],
  ["charge", "essence", ["ESSO", "STATION AVIA", "SHELL", "BP ", "DAC "]],
  ["charge", "sante", ["PHARMACIE", "PHIE", "DOCTOLIB", "SELARL"]],
  ["charge", "sport", ["GYM", "BASIC FIT", "FITNESS"]],
  ["expense", "resto", ["BURGER", "MCDONALD", "KFC", "UBER EATS", "UBER *EATS", "DELIVEROO", "TACOS", "PIZZA", "SUSHI", "KEBAB", "CAFE", "BARIST", "CROUS", "IZLY", "RESTO", "BRASSERIE", "TOO GOOD TO GO", "SEGAFREDO", "CREPE", "GELATO"]],
  ["expense", "sorties", ["SHOTGUN", "XCEED", "WEEZEVENT", "BILLET", "YURPLAN", "BOWL", "BAR ", "PUB", "CINEMA", "PATHE", "UGC"]],
  ["expense", "abonnements", ["SPOTIFY", "NETFLIX", "DEEZER", "DISNEY", "YOUTUBE", "APPLE COM/BILL", "ITUNES", "PRIME", "CHATGPT", "OPENAI", "CLAUDE", "PATREON"]],
  ["expense", "jeux", ["STEAM", "ENEB", "NINTENDO", "PLAYSTATION", "XBOX", "RIOT", "INSTANT GAMING", "HELLCASE"]],
  ["expense", "shopping", ["AMAZON", "FNAC", "BOULANGER", "IKEA", "VINTED", "DECATHLON", "ZARA", "H&M", "SEPHORA", "NOCIB", "CARHARTT", "PAYPAL", "ALIEXPRESS", "SHEIN"]],
];

/** Each shop word starts a word of the label ("ESSO" is not in "SEPTESSOR", "INTERMARCH" is in "INTERMARCHE"). */
const PATTERNS = SHOPS.map(([kind, category, words]) => ({
  kind,
  category,
  pattern: new RegExp(`(^|[^A-Z0-9])(${words.map((w) => w.trim().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})`),
}));

export function guessFromShop(label: string): { kind: Kind; category: string } | undefined {
  const upper = label.toUpperCase();
  const found = PATTERNS.find((p) => p.pattern.test(upper));
  return found && { kind: found.kind, category: found.category };
}
