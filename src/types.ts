// Type definitions for Pokémon Showdown data

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface GenderRatio {
  M: number;
  F: number;
}

export interface SpeciesAbilities {
  0: string;
  1?: string;
  H?: string; // Hidden ability
  S?: string; // Special ability
}

export interface PokemonSpecies {
  num: number;
  name: string;
  types: string[];
  baseStats: BaseStats;
  abilities: SpeciesAbilities;
  heightm?: number;
  weightkg?: number;
  color?: string;
  genderRatio?: GenderRatio;
  gender?: 'M' | 'F' | 'N';
  eggGroups?: string[];
  prevo?: string;
  evos?: string[];
  evoLevel?: number;
  evoType?: string;
  evoCondition?: string;
  baseSpecies?: string;
  forme?: string;
  otherFormes?: string[];
  formeOrder?: string[];
  // Gen-specific mechanics
  canGigantamax?: string;      // Gen 8: G-Max move name
  requiredTeraType?: string;   // Gen 9: Required Tera Type (e.g., Ogerpon forms)
  battleOnly?: string;         // Indicates in-battle forme change
  requiredItem?: string;       // Required held item for forme
  isNonstandard?: string;
  tier?: string;
}

export interface Move {
  num: number;
  name: string;
  type: string;
  category: 'Physical' | 'Special' | 'Status';
  basePower: number;
  accuracy: number | true;
  pp: number;
  priority?: number;
  flags?: { [key: string]: number };
  secondary?: any;
  target?: string;
  isNonstandard?: string;
  isZ?: string;
  [key: string]: any;
}

export interface LearnsetMove {
  [move: string]: string[];
}

export interface Learnset {
  learnset?: LearnsetMove;
  eventData?: any[];
  eventOnly?: boolean;
  encounters?: any[];
}

export interface FormatData {
  tier?: string;
  doublesTier?: string;
  natDexTier?: string;
  isNonstandard?: string;
}

export interface Ability {
  num: number;
  name: string;
  desc?: string;
  shortDesc?: string;
  isNonstandard?: string;
  [key: string]: any;
}

export interface Item {
  num: number;
  name: string;
  desc?: string;
  shortDesc?: string;
  isNonstandard?: string;
  [key: string]: any;
}

export interface TypeEffectiveness {
  damageTaken: { [type: string]: number };
  HPivs?: { [stat: string]: number };
  HPdvs?: { [stat: string]: number };
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
  // Gen 9 specific
  teraType?: string;
  // Gen 8 specific (forms are handled via pokemon name, e.g., "Urshifu-Gmax")
  gigantamax?: boolean;
  // Gen 6-7 specific (Mega Stones are items, forms are separate entries)
  // Z-Moves are handled via items (Z crystals)
}

// Data table types
export type PokedexTable = { [id: string]: PokemonSpecies };
export type MovesTable = { [id: string]: Move };
export type LearnsetsTable = { [id: string]: Learnset };
export type FormatsDataTable = { [id: string]: FormatData };
export type AbilitiesTable = { [id: string]: Ability };
export type ItemsTable = { [id: string]: Item };
export type TypeChartTable = { [type: string]: TypeEffectiveness };
