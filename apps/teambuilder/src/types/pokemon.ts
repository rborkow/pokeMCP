// Core Pokemon types (matching src/types.ts from MCP server)

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface TeamPokemon {
  pokemon: string;
  moves: string[];
  ability?: string;
  item?: string;
  evs?: Partial<BaseStats>;
  ivs?: Partial<BaseStats>;
  nature?: string;
  level?: number;
  nickname?: string;
  shiny?: boolean;
  gender?: "M" | "F";
  teraType?: string;
}

export interface Team {
  id: string;
  name?: string;
  format: string;
  pokemon: TeamPokemon[];
  createdAt: Date;
  updatedAt: Date;
}

// Pokemon species data
export interface PokemonSpecies {
  num: number;
  name: string;
  types: string[];
  baseStats: BaseStats;
  abilities: {
    0: string;
    1?: string;
    H?: string;
  };
  tier?: string;
}

// Move data
export interface Move {
  num: number;
  name: string;
  type: string;
  category: "Physical" | "Special" | "Status";
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority?: number;
}

// Type effectiveness
export const TYPES = [
  "Normal",
  "Fire",
  "Water",
  "Electric",
  "Grass",
  "Ice",
  "Fighting",
  "Poison",
  "Ground",
  "Flying",
  "Psychic",
  "Bug",
  "Rock",
  "Ghost",
  "Dragon",
  "Dark",
  "Steel",
  "Fairy",
] as const;

export type PokemonType = (typeof TYPES)[number];

// Nature effects
export const NATURES: Record<string, { plus?: keyof BaseStats; minus?: keyof BaseStats }> = {
  Hardy: {},
  Lonely: { plus: "atk", minus: "def" },
  Brave: { plus: "atk", minus: "spe" },
  Adamant: { plus: "atk", minus: "spa" },
  Naughty: { plus: "atk", minus: "spd" },
  Bold: { plus: "def", minus: "atk" },
  Docile: {},
  Relaxed: { plus: "def", minus: "spe" },
  Impish: { plus: "def", minus: "spa" },
  Lax: { plus: "def", minus: "spd" },
  Timid: { plus: "spe", minus: "atk" },
  Hasty: { plus: "spe", minus: "def" },
  Serious: {},
  Jolly: { plus: "spe", minus: "spa" },
  Naive: { plus: "spe", minus: "spd" },
  Modest: { plus: "spa", minus: "atk" },
  Mild: { plus: "spa", minus: "def" },
  Quiet: { plus: "spa", minus: "spe" },
  Bashful: {},
  Rash: { plus: "spa", minus: "spd" },
  Calm: { plus: "spd", minus: "atk" },
  Gentle: { plus: "spd", minus: "def" },
  Sassy: { plus: "spd", minus: "spe" },
  Careful: { plus: "spd", minus: "spa" },
  Quirky: {},
};

// Format definitions
export const FORMATS = [
  { id: "gen9ou", name: "Gen 9 OU", gen: 9 },
  { id: "gen9ubers", name: "Gen 9 Ubers", gen: 9 },
  { id: "gen9uu", name: "Gen 9 UU", gen: 9 },
  { id: "gen9ru", name: "Gen 9 RU", gen: 9 },
  { id: "gen9nu", name: "Gen 9 NU", gen: 9 },
  { id: "gen9pu", name: "Gen 9 PU", gen: 9 },
  { id: "gen9lc", name: "Gen 9 LC", gen: 9 },
  { id: "gen9vgc2024regh", name: "Gen 9 VGC Reg H", gen: 9 },
  { id: "gen9vgc2024regf", name: "Gen 9 VGC Reg F", gen: 9 },
  { id: "gen8ou", name: "Gen 8 OU", gen: 8 },
  { id: "gen8ubers", name: "Gen 8 Ubers", gen: 8 },
  { id: "gen8uu", name: "Gen 8 UU", gen: 8 },
  { id: "gen7ou", name: "Gen 7 OU", gen: 7 },
  { id: "gen7ubers", name: "Gen 7 Ubers", gen: 7 },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];
