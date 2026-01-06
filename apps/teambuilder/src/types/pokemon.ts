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

// Format category definitions
export type FormatCategory = "singles" | "doubles" | "gen8" | "gen7" | "other";

export interface FormatDefinition {
  id: string;
  name: string;
  gen: number;
  category: FormatCategory;
}

// Format definitions with categories
export const FORMATS: FormatDefinition[] = [
  // Current Gen Singles
  { id: "gen9ou", name: "Gen 9 OU", gen: 9, category: "singles" },
  { id: "gen9ubers", name: "Gen 9 Ubers", gen: 9, category: "singles" },
  { id: "gen9uu", name: "Gen 9 UU", gen: 9, category: "singles" },
  { id: "gen9ru", name: "Gen 9 RU", gen: 9, category: "singles" },
  { id: "gen9nu", name: "Gen 9 NU", gen: 9, category: "singles" },
  { id: "gen9pu", name: "Gen 9 PU", gen: 9, category: "singles" },
  { id: "gen9lc", name: "Gen 9 LC", gen: 9, category: "singles" },
  // Current Gen Doubles/VGC
  { id: "gen9vgc2024regh", name: "VGC 2024 Reg H", gen: 9, category: "doubles" },
  { id: "gen9vgc2024regf", name: "VGC 2024 Reg F", gen: 9, category: "doubles" },
  { id: "gen9doublesou", name: "Gen 9 Doubles OU", gen: 9, category: "doubles" },
  // Gen 8
  { id: "gen8ou", name: "Gen 8 OU", gen: 8, category: "gen8" },
  { id: "gen8ubers", name: "Gen 8 Ubers", gen: 8, category: "gen8" },
  { id: "gen8uu", name: "Gen 8 UU", gen: 8, category: "gen8" },
  { id: "gen8ru", name: "Gen 8 RU", gen: 8, category: "gen8" },
  { id: "gen8nu", name: "Gen 8 NU", gen: 8, category: "gen8" },
  { id: "gen8lc", name: "Gen 8 LC", gen: 8, category: "gen8" },
  // Gen 7
  { id: "gen7ou", name: "Gen 7 OU", gen: 7, category: "gen7" },
  { id: "gen7ubers", name: "Gen 7 Ubers", gen: 7, category: "gen7" },
  { id: "gen7uu", name: "Gen 7 UU", gen: 7, category: "gen7" },
  { id: "gen7ru", name: "Gen 7 RU", gen: 7, category: "gen7" },
  { id: "gen7nu", name: "Gen 7 NU", gen: 7, category: "gen7" },
  { id: "gen7lc", name: "Gen 7 LC", gen: 7, category: "gen7" },
];

export const FORMAT_CATEGORIES: { id: FormatCategory; label: string }[] = [
  { id: "singles", label: "Gen 9 Singles" },
  { id: "doubles", label: "Gen 9 Doubles/VGC" },
  { id: "gen8", label: "Gen 8 (Sword/Shield)" },
  { id: "gen7", label: "Gen 7 (Sun/Moon)" },
];

export type FormatId = (typeof FORMATS)[number]["id"];

// Game mode - determines which formats are shown and UI behavior
export type Mode = "singles" | "vgc";

export const MODE_INFO: Record<Mode, { label: string; description: string; defaultFormat: FormatId }> = {
  singles: {
    label: "Singles",
    description: "Smogon 6v6 formats",
    defaultFormat: "gen9ou",
  },
  vgc: {
    label: "VGC",
    description: "Official doubles formats",
    defaultFormat: "gen9vgc2024regh",
  },
};

/**
 * Get formats available for a given mode
 */
export function getFormatsForMode(mode: Mode): FormatDefinition[] {
  if (mode === "vgc") {
    return FORMATS.filter((f) => f.category === "doubles");
  }
  // Singles includes gen9 singles + older gens (which are all singles-focused)
  return FORMATS.filter((f) => f.category !== "doubles");
}

/**
 * Check if a format belongs to a mode
 */
export function isFormatValidForMode(formatId: string, mode: Mode): boolean {
  const format = FORMATS.find((f) => f.id === formatId);
  if (!format) return false;

  if (mode === "vgc") {
    return format.category === "doubles";
  }
  return format.category !== "doubles";
}

/**
 * Get the display-friendly name for a format ID
 * e.g., "gen9ou" → "Gen 9 OU", "gen9vgc2024regh" → "VGC 2024 Reg H"
 */
export function getFormatDisplayName(formatId: string): string {
  const format = FORMATS.find((f) => f.id === formatId);
  return format?.name ?? formatId.toUpperCase();
}
