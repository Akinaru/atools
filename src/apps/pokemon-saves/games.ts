/** Save formats with an automatic parser. Games without one still store their saves. */
export type SaveFormat =
  | "gen1" | "gen2-gs" | "gen2-c" | "gen3-rs" | "gen3-e" | "gen3-frlg"
  | "gen5-bw" | "gen6-xy" | "gen6-oras" | "gen7b" | "gen8-swsh" | "gen8-la";

export type Game = {
  id: string;
  name: string;
  gen: number;
  platform: string;
  year: number;
  /** Two colors for the game's gradient. */
  colors: [string, string];
  format?: SaveFormat;
  /** Nintendo Switch title ID, so a Switch homebrew can upload without knowing our game ids. */
  switchTitleId?: string;
};

export const GAMES: Game[] = [
  { id: "red", name: "Rouge", gen: 1, platform: "Game Boy", year: 1996, colors: ["#e3350d", "#8b1a06"], format: "gen1" },
  { id: "blue", name: "Bleu", gen: 1, platform: "Game Boy", year: 1996, colors: ["#3b6fd9", "#1b3a80"], format: "gen1" },
  { id: "yellow", name: "Jaune", gen: 1, platform: "Game Boy", year: 1998, colors: ["#f8d030", "#c79a00"], format: "gen1" },
  { id: "gold", name: "Or", gen: 2, platform: "Game Boy Color", year: 1999, colors: ["#d4af37", "#8a6d12"], format: "gen2-gs" },
  { id: "silver", name: "Argent", gen: 2, platform: "Game Boy Color", year: 1999, colors: ["#c0c6cf", "#6b7280"], format: "gen2-gs" },
  { id: "crystal", name: "Cristal", gen: 2, platform: "Game Boy Color", year: 2000, colors: ["#7dd3fc", "#2c7fb8"], format: "gen2-c" },
  { id: "ruby", name: "Rubis", gen: 3, platform: "Game Boy Advance", year: 2002, colors: ["#c8102e", "#6e0a1a"], format: "gen3-rs" },
  { id: "sapphire", name: "Saphir", gen: 3, platform: "Game Boy Advance", year: 2002, colors: ["#0f52ba", "#082c66"], format: "gen3-rs" },
  { id: "emerald", name: "Émeraude", gen: 3, platform: "Game Boy Advance", year: 2004, colors: ["#10b981", "#065f46"], format: "gen3-e" },
  { id: "firered", name: "Rouge Feu", gen: 3, platform: "Game Boy Advance", year: 2004, colors: ["#f97316", "#b91c1c"], format: "gen3-frlg" },
  { id: "leafgreen", name: "Vert Feuille", gen: 3, platform: "Game Boy Advance", year: 2004, colors: ["#84cc16", "#166534"], format: "gen3-frlg" },
  { id: "diamond", name: "Diamant", gen: 4, platform: "Nintendo DS", year: 2006, colors: ["#93c5fd", "#3b5998"] },
  { id: "pearl", name: "Perle", gen: 4, platform: "Nintendo DS", year: 2006, colors: ["#f9a8d4", "#9d4b73"] },
  { id: "platinum", name: "Platine", gen: 4, platform: "Nintendo DS", year: 2008, colors: ["#a1a1aa", "#3f3f46"] },
  { id: "heartgold", name: "HeartGold", gen: 4, platform: "Nintendo DS", year: 2009, colors: ["#fbbf24", "#b45309"] },
  { id: "soulsilver", name: "SoulSilver", gen: 4, platform: "Nintendo DS", year: 2009, colors: ["#cbd5e1", "#475569"] },
  { id: "black", name: "Noir", gen: 5, platform: "Nintendo DS", year: 2010, colors: ["#3f3f46", "#09090b"], format: "gen5-bw" },
  { id: "white", name: "Blanc", gen: 5, platform: "Nintendo DS", year: 2010, colors: ["#f4f4f5", "#a1a1aa"], format: "gen5-bw" },
  { id: "black2", name: "Noir 2", gen: 5, platform: "Nintendo DS", year: 2012, colors: ["#27272a", "#1e3a8a"] },
  { id: "white2", name: "Blanc 2", gen: 5, platform: "Nintendo DS", year: 2012, colors: ["#fafafa", "#f87171"] },
  { id: "x", name: "X", gen: 6, platform: "Nintendo 3DS", year: 2013, colors: ["#2563eb", "#1e1b4b"], format: "gen6-xy" },
  { id: "y", name: "Y", gen: 6, platform: "Nintendo 3DS", year: 2013, colors: ["#dc2626", "#4c0519"], format: "gen6-xy" },
  { id: "omegaruby", name: "Rubis Oméga", gen: 6, platform: "Nintendo 3DS", year: 2014, colors: ["#b91c1c", "#450a0a"], format: "gen6-oras" },
  { id: "alphasapphire", name: "Saphir Alpha", gen: 6, platform: "Nintendo 3DS", year: 2014, colors: ["#1d4ed8", "#172554"], format: "gen6-oras" },
  { id: "sun", name: "Soleil", gen: 7, platform: "Nintendo 3DS", year: 2016, colors: ["#f59e0b", "#c2410c"] },
  { id: "moon", name: "Lune", gen: 7, platform: "Nintendo 3DS", year: 2016, colors: ["#6366f1", "#312e81"] },
  { id: "ultrasun", name: "Ultra-Soleil", gen: 7, platform: "Nintendo 3DS", year: 2017, colors: ["#fb923c", "#9a3412"] },
  { id: "ultramoon", name: "Ultra-Lune", gen: 7, platform: "Nintendo 3DS", year: 2017, colors: ["#8b5cf6", "#4c1d95"] },
  { id: "letsgopikachu", name: "Let's Go Pikachu", gen: 7, platform: "Nintendo Switch", year: 2018, colors: ["#facc15", "#ca8a04"], format: "gen7b", switchTitleId: "010003F003A34000" },
  { id: "letsgoeevee", name: "Let's Go Évoli", gen: 7, platform: "Nintendo Switch", year: 2018, colors: ["#d6a36b", "#8b5a2b"], format: "gen7b", switchTitleId: "0100187003A36000" },
  { id: "sword", name: "Épée", gen: 8, platform: "Nintendo Switch", year: 2019, colors: ["#38bdf8", "#0369a1"], format: "gen8-swsh", switchTitleId: "0100ABF008968000" },
  { id: "shield", name: "Bouclier", gen: 8, platform: "Nintendo Switch", year: 2019, colors: ["#e11d48", "#881337"], format: "gen8-swsh", switchTitleId: "01008DB008C2C000" },
  { id: "brilliantdiamond", name: "Diamant Étincelant", gen: 8, platform: "Nintendo Switch", year: 2021, colors: ["#60a5fa", "#1e40af"], switchTitleId: "0100000011D90000" },
  { id: "shiningpearl", name: "Perle Scintillante", gen: 8, platform: "Nintendo Switch", year: 2021, colors: ["#f472b6", "#9d174d"], switchTitleId: "010018E011D92000" },
  { id: "legendsarceus", name: "Légendes Arceus", gen: 8, platform: "Nintendo Switch", year: 2022, colors: ["#d6c7a1", "#6b5b3e"], format: "gen8-la", switchTitleId: "01001F5010DFA000" },
  { id: "scarlet", name: "Écarlate", gen: 9, platform: "Nintendo Switch", year: 2022, colors: ["#ef4444", "#7f1d1d"], switchTitleId: "0100A3D008C5C000" },
  { id: "violet", name: "Violet", gen: 9, platform: "Nintendo Switch", year: 2022, colors: ["#a855f7", "#4c1d95"], switchTitleId: "01008F6008C5E000" },
  { id: "legendsza", name: "Légendes Z-A", gen: 9, platform: "Nintendo Switch", year: 2025, colors: ["#22d3ee", "#155e75"] },
];

export function getGame(id: string): Game | undefined {
  return GAMES.find((game) => game.id === id);
}

// Gym badges in order, images in public/assets/pokemon-saves/badges (from Bulbapedia).
const KANTO = ["boulder", "cascade", "thunder", "rainbow", "soul", "marsh", "volcano", "earth"];
const JOHTO = ["zephyr", "hive", "plain", "fog", "storm", "mineral", "glacier", "rising"];
const HOENN = ["stone", "knuckle", "dynamo", "heat", "balance", "feather", "mind", "rain"];
const SINNOH = ["coal", "forest", "cobble", "fen", "relic", "mine", "icicle", "beacon"];
const UNOVA = ["trio", "basic", "insect", "bolt", "quake", "jet", "freeze", "legend"];
const UNOVA2 = ["basic", "toxic", "insect", "bolt", "quake", "jet", "legend", "wave"];
const KALOS = ["bug", "cliff", "rumble", "plant", "voltage", "fairy", "psychic", "iceberg"];
const BADGES: Record<string, string[]> = {
  red: KANTO, blue: KANTO, yellow: KANTO, firered: KANTO, leafgreen: KANTO, letsgopikachu: KANTO, letsgoeevee: KANTO,
  gold: [...JOHTO, ...KANTO], silver: [...JOHTO, ...KANTO], crystal: [...JOHTO, ...KANTO],
  heartgold: [...JOHTO, ...KANTO], soulsilver: [...JOHTO, ...KANTO],
  ruby: HOENN, sapphire: HOENN, emerald: HOENN, omegaruby: HOENN, alphasapphire: HOENN,
  diamond: SINNOH, pearl: SINNOH, platinum: SINNOH, brilliantdiamond: SINNOH, shiningpearl: SINNOH,
  black: UNOVA, white: UNOVA, black2: UNOVA2, white2: UNOVA2,
  x: KALOS, y: KALOS,
  sword: ["grass", "water", "fire", "fighting", "fairy", "rock", "dark", "dragon"],
  shield: ["grass", "water", "fire", "ghost", "fairy", "ice", "dark", "dragon"],
};

/** Badge image paths of a game, in the order they are earned (empty when the game has no gym badges). */
export function badgeImages(game: Game): string[] {
  return (BADGES[game.id] ?? []).map((name) => `/assets/pokemon-saves/badges/${name}.png`);
}

/** Box art, stored in public/assets/pokemon-saves/boxart (from Bulbapedia). */
export function boxart(game: Game): string {
  return `/assets/pokemon-saves/boxart/${game.id}.jpg`;
}

export function getGameBySwitchTitleId(titleId: string): Game | undefined {
  return GAMES.find((game) => game.switchTitleId?.toLowerCase() === titleId.trim().toLowerCase());
}

export function gradient(game: Game): string {
  return `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})`;
}
