export type Mon = {
  /** National Pokédex number. */
  dex: number;
  nickname: string;
  level?: number;
  shiny?: boolean;
  egg?: boolean;
  otName?: string;
};

export type Box = { name: string; mons: Mon[] };

export type ParsedSave = {
  trainer: string;
  trainerId: number;
  rival?: string;
  money: number;
  location?: string;
  playTime: { hours: number; minutes: number; seconds: number };
  badges?: number;
  pokedex?: { owned: number; seen: number };
  party: Mon[];
  boxes: Box[];
  /** Things that looked off while reading (bad checksum, unknown map...). */
  warnings: string[];
};
