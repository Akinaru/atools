import growth from "../data/growth.json";

/** Level matching an EXP total, for formats that do not store the level of boxed Pokémon. */
export function levelFromExp(dex: number, exp: number): number | undefined {
  const table = growth.expByRate[String(growth.rateByDex[dex]) as keyof typeof growth.expByRate];
  if (!table) return undefined;
  let level = 1;
  while (level < 100 && exp >= table[level + 1]) level++;
  return level;
}
