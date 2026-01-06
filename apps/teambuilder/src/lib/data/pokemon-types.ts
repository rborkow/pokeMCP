// Pokemon type data for threat matrix calculations
// This maps common Pokemon to their types for quick lookup

export type PokemonType =
  | "Normal" | "Fire" | "Water" | "Electric" | "Grass" | "Ice"
  | "Fighting" | "Poison" | "Ground" | "Flying" | "Psychic" | "Bug"
  | "Rock" | "Ghost" | "Dragon" | "Dark" | "Steel" | "Fairy";

export const POKEMON_TYPES: Record<string, PokemonType[]> = {
  // Gen 9 OU Meta Pokemon
  "great tusk": ["Ground", "Fighting"],
  "greattusk": ["Ground", "Fighting"],
  "great-tusk": ["Ground", "Fighting"],
  "kingambit": ["Dark", "Steel"],
  "zamazenta": ["Fighting"],
  "zamazenta-crowned": ["Fighting", "Steel"],
  "zamazentacrowned": ["Fighting", "Steel"],
  "gholdengo": ["Steel", "Ghost"],
  "ogerpon": ["Grass"],
  "ogerpon-teal-mask": ["Grass"],
  "ogerpontealmask": ["Grass"],
  "ogerpon-wellspring": ["Grass", "Water"],
  "ogerponwellspring": ["Grass", "Water"],
  "ogerpon-wellspring-mask": ["Grass", "Water"],
  "ogerpon-hearthflame": ["Grass", "Fire"],
  "ogerponhearthflame": ["Grass", "Fire"],
  "ogerpon-hearthflame-mask": ["Grass", "Fire"],
  "ogerpon hearthflame": ["Grass", "Fire"],
  "ogerpon-hearthflame-tera": ["Grass", "Fire"],
  "ogerponhearthflametera": ["Grass", "Fire"],
  "ogerpon-cornerstone": ["Grass", "Rock"],
  "ogerponcornerstone": ["Grass", "Rock"],
  "ogerpon-cornerstone-mask": ["Grass", "Rock"],
  "dragonite": ["Dragon", "Flying"],
  "iron valiant": ["Fairy", "Fighting"],
  "ironvaliant": ["Fairy", "Fighting"],
  "raging bolt": ["Electric", "Dragon"],
  "ragingbolt": ["Electric", "Dragon"],
  "kyurem": ["Dragon", "Ice"],
  "dragapult": ["Dragon", "Ghost"],
  "landorus-therian": ["Ground", "Flying"],
  "landorustherian": ["Ground", "Flying"],
  "landorus": ["Ground", "Flying"],
  "garchomp": ["Dragon", "Ground"],
  "heatran": ["Fire", "Steel"],
  "toxapex": ["Poison", "Water"],
  "ferrothorn": ["Grass", "Steel"],
  "clefable": ["Fairy"],
  "corviknight": ["Flying", "Steel"],
  "tyranitar": ["Rock", "Dark"],
  "excadrill": ["Ground", "Steel"],
  "rotom-wash": ["Electric", "Water"],
  "rotomwash": ["Electric", "Water"],
  "weavile": ["Dark", "Ice"],
  "volcarona": ["Bug", "Fire"],
  "hydreigon": ["Dark", "Dragon"],
  "skeledirge": ["Fire", "Ghost"],
  "iron moth": ["Fire", "Poison"],
  "ironmoth": ["Fire", "Poison"],
  "gliscor": ["Ground", "Flying"],
  "cinderace": ["Fire"],
  "rillaboom": ["Grass"],
  "urshifu": ["Fighting", "Dark"],
  "urshifu-rapid-strike": ["Fighting", "Water"],
  "urshifurapidstrike": ["Fighting", "Water"],
  "slowking-galar": ["Poison", "Psychic"],
  "slowkinggalar": ["Poison", "Psychic"],
  "iron treads": ["Ground", "Steel"],
  "irontreads": ["Ground", "Steel"],
  "walking wake": ["Water", "Dragon"],
  "walkingwake": ["Water", "Dragon"],
  "roaring moon": ["Dragon", "Dark"],
  "roaringmoon": ["Dragon", "Dark"],
  "iron boulder": ["Rock", "Psychic"],
  "ironboulder": ["Rock", "Psychic"],
  "gouging fire": ["Fire", "Dragon"],
  "gougingfire": ["Fire", "Dragon"],
  "flutter mane": ["Ghost", "Fairy"],
  "fluttermane": ["Ghost", "Fairy"],
  "iron hands": ["Fighting", "Electric"],
  "ironhands": ["Fighting", "Electric"],
  "annihilape": ["Fighting", "Ghost"],
  "pelipper": ["Water", "Flying"],
  "barraskewda": ["Water"],
  "archaludon": ["Steel", "Dragon"],
  "dondozo": ["Water"],
  "tatsugiri": ["Dragon", "Water"],
  "chi-yu": ["Dark", "Fire"],
  "chiyu": ["Dark", "Fire"],
  "ting-lu": ["Dark", "Ground"],
  "tinglu": ["Dark", "Ground"],
  "wo-chien": ["Dark", "Grass"],
  "wochien": ["Dark", "Grass"],
  "chien-pao": ["Dark", "Ice"],
  "chienpao": ["Dark", "Ice"],
  "blissey": ["Normal"],
  "chansey": ["Normal"],
  "ditto": ["Normal"],
  "clodsire": ["Poison", "Ground"],
  "amoonguss": ["Grass", "Poison"],
  "tornadus-therian": ["Flying"],
  "tornadustherian": ["Flying"],
  "thundurus-therian": ["Electric", "Flying"],
  "thundurustherian": ["Electric", "Flying"],
  "enamorus-therian": ["Fairy", "Flying"],
  "enamorustherian": ["Fairy", "Flying"],
  "hatterene": ["Psychic", "Fairy"],
  "grimmsnarl": ["Dark", "Fairy"],
  "moltres": ["Fire", "Flying"],
  "zapdos": ["Electric", "Flying"],
  "articuno": ["Ice", "Flying"],
  "moltres-galar": ["Dark", "Flying"],
  "moltresgalar": ["Dark", "Flying"],
  "slowbro": ["Water", "Psychic"],
  "alomomola": ["Water"],
  "hippowdon": ["Ground"],
  "magnezone": ["Electric", "Steel"],
  "scizor": ["Bug", "Steel"],
  "garganacl": ["Rock"],
  "maushold": ["Normal"],
  "azumarill": ["Water", "Fairy"],
  "mimikyu": ["Ghost", "Fairy"],
  "polteageist": ["Ghost"],
  "meowscarada": ["Grass", "Dark"],
  "quaquaval": ["Water", "Fighting"],
  "terapagos": ["Normal"],
  // Additional common Pokemon
  "palafin": ["Water"],
  "palafin-hero": ["Water"],
  "palafinhero": ["Water"],
  "baxcalibur": ["Dragon", "Ice"],
  "armarouge": ["Fire", "Psychic"],
  "ceruledge": ["Fire", "Ghost"],
  "tinkaton": ["Fairy", "Steel"],
  "grafaiai": ["Poison", "Normal"],
  "brambleghast": ["Grass", "Ghost"],
  "scovillain": ["Grass", "Fire"],
  "bellibolt": ["Electric"],
  "kilowattrel": ["Electric", "Flying"],
  "bombirdier": ["Flying", "Dark"],
  "squawkabilly": ["Normal", "Flying"],
  "flamigo": ["Flying", "Fighting"],
  "klawf": ["Rock"],
  "nacli": ["Rock"],
  "naclstack": ["Rock"],
  "orthworm": ["Steel"],
  "cetitan": ["Ice"],
  "veluza": ["Water", "Psychic"],
  "farigiraf": ["Normal", "Psychic"],
  "dudunsparce": ["Normal"],
  "scream tail": ["Fairy", "Psychic"],
  "screamtail": ["Fairy", "Psychic"],
  "brute bonnet": ["Grass", "Dark"],
  "brutebonnet": ["Grass", "Dark"],
  "sandy shocks": ["Electric", "Ground"],
  "sandyshocks": ["Electric", "Ground"],
  "iron bundle": ["Ice", "Water"],
  "ironbundle": ["Ice", "Water"],
  "iron jugulis": ["Dark", "Flying"],
  "ironjugulis": ["Dark", "Flying"],
  "iron thorns": ["Rock", "Electric"],
  "ironthorns": ["Rock", "Electric"],
  "slither wing": ["Bug", "Fighting"],
  "slitherwing": ["Bug", "Fighting"],
  "cyclizar": ["Dragon", "Normal"],
  "pawmot": ["Electric", "Fighting"],
  "dachsbun": ["Fairy"],
  "arboliva": ["Grass", "Normal"],
  "espathra": ["Psychic"],
  "glimmora": ["Rock", "Poison"],
  "greavard": ["Ghost"],
  "houndstone": ["Ghost"],
  "revavroom": ["Steel", "Poison"],
  "varoom": ["Steel", "Poison"],
  "tornadus": ["Flying"],
  "thundurus": ["Electric", "Flying"],
  "enamorus": ["Fairy", "Flying"],
  "samurott-hisui": ["Water", "Dark"],
  "samurotthisui": ["Water", "Dark"],
  "lilligant-hisui": ["Grass", "Fighting"],
  "lilliganthisui": ["Grass", "Fighting"],
  "arcanine-hisui": ["Fire", "Rock"],
  "arcaninehisui": ["Fire", "Rock"],
  "electrode-hisui": ["Electric", "Grass"],
  "electrodehisui": ["Electric", "Grass"],
  "typhlosion-hisui": ["Fire", "Ghost"],
  "typhlosionhisui": ["Fire", "Ghost"],
  "decidueye-hisui": ["Grass", "Fighting"],
  "decidueyehisui": ["Grass", "Fighting"],
  "zoroark-hisui": ["Normal", "Ghost"],
  "zoroarkhisui": ["Normal", "Ghost"],
  "braviary-hisui": ["Psychic", "Flying"],
  "braviaryhisui": ["Psychic", "Flying"],
  "goodra-hisui": ["Steel", "Dragon"],
  "goodrahisui": ["Steel", "Dragon"],
  "avalugg-hisui": ["Ice", "Rock"],
  "avalugghisui": ["Ice", "Rock"],
  "sliggoo-hisui": ["Steel", "Dragon"],
  "sliggoohisui": ["Steel", "Dragon"],
  "sneasel-hisui": ["Fighting", "Poison"],
  "sneaselhisui": ["Fighting", "Poison"],
  "sneasler": ["Fighting", "Poison"],
  "overqwil": ["Dark", "Poison"],
  "basculegion": ["Water", "Ghost"],
  "wyrdeer": ["Normal", "Psychic"],
  "kleavor": ["Bug", "Rock"],
  "ursaluna": ["Ground", "Normal"],
  "ursaluna-bloodmoon": ["Ground", "Normal"],
  "ursalunabloodmoon": ["Ground", "Normal"],
  // Gen 8 Pokemon
  "zacian": ["Fairy"],
  "zacian-crowned": ["Fairy", "Steel"],
  "zaciancrowned": ["Fairy", "Steel"],
  "eternatus": ["Poison", "Dragon"],
  "calyrex": ["Psychic", "Grass"],
  "calyrex-ice": ["Psychic", "Ice"],
  "calyrexice": ["Psychic", "Ice"],
  "calyrex-shadow": ["Psychic", "Ghost"],
  "calyrexshadow": ["Psychic", "Ghost"],
  "spectrier": ["Ghost"],
  "glastrier": ["Ice"],
  "regieleki": ["Electric"],
  "regidrago": ["Dragon"],
  "kubfu": ["Fighting"],
  "urshifu-single-strike": ["Fighting", "Dark"],
  "urshifusinglestrike": ["Fighting", "Dark"],
  "zarude": ["Dark", "Grass"],
  "dracozolt": ["Electric", "Dragon"],
  "arctozolt": ["Electric", "Ice"],
  "dracovish": ["Water", "Dragon"],
  "arctovish": ["Water", "Ice"],
  "coalossal": ["Rock", "Fire"],
  "copperajah": ["Steel"],
  "duraludon": ["Steel", "Dragon"],
  "dragalge": ["Poison", "Dragon"],
  "clawitzer": ["Water"],
  "aegislash": ["Steel", "Ghost"],
  "gengar": ["Ghost", "Poison"],
  "alakazam": ["Psychic"],
  "machamp": ["Fighting"],
  "gyarados": ["Water", "Flying"],
  "lapras": ["Water", "Ice"],
  "snorlax": ["Normal"],
  "espeon": ["Psychic"],
  "umbreon": ["Dark"],
  "sylveon": ["Fairy"],
  "vaporeon": ["Water"],
  "jolteon": ["Electric"],
  "flareon": ["Fire"],
  "leafeon": ["Grass"],
  "glaceon": ["Ice"],
  "lucario": ["Fighting", "Steel"],
  "togekiss": ["Fairy", "Flying"],
  "blaziken": ["Fire", "Fighting"],
  "swampert": ["Water", "Ground"],
  "sceptile": ["Grass"],
  "infernape": ["Fire", "Fighting"],
  "empoleon": ["Water", "Steel"],
  "torterra": ["Grass", "Ground"],
  "serperior": ["Grass"],
  "samurott": ["Water"],
  "emboar": ["Fire", "Fighting"],
  "greninja": ["Water", "Dark"],
  "delphox": ["Fire", "Psychic"],
  "chesnaught": ["Grass", "Fighting"],
  "decidueye": ["Grass", "Ghost"],
  "primarina": ["Water", "Fairy"],
  "incineroar": ["Fire", "Dark"],
  "inteleon": ["Water"],
  "venusaur": ["Grass", "Poison"],
  "charizard": ["Fire", "Flying"],
  "blastoise": ["Water"],
  "pikachu": ["Electric"],
  "raichu": ["Electric"],
  "raichu-alola": ["Electric", "Psychic"],
  "raichualola": ["Electric", "Psychic"],
  "ninetales": ["Fire"],
  "ninetales-alola": ["Ice", "Fairy"],
  "ninetalesalola": ["Ice", "Fairy"],
  "sandslash-alola": ["Ice", "Steel"],
  "sandslashalola": ["Ice", "Steel"],
  "marowak-alola": ["Fire", "Ghost"],
  "marowakalola": ["Fire", "Ghost"],
  "exeggutor-alola": ["Grass", "Dragon"],
  "exeggutoralola": ["Grass", "Dragon"],
  "persian-alola": ["Dark"],
  "persianalola": ["Dark"],
  "dugtrio-alola": ["Ground", "Steel"],
  "dugtrioalola": ["Ground", "Steel"],
  "golem-alola": ["Rock", "Electric"],
  "golemalola": ["Rock", "Electric"],
  "muk-alola": ["Poison", "Dark"],
  "mukalola": ["Poison", "Dark"],
  // Porygon family
  "porygon": ["Normal"],
  "porygon2": ["Normal"],
  "porygon-z": ["Normal"],
  "porygonz": ["Normal"],
  // Additional Pokemon not already in the list
  "starmie": ["Water", "Psychic"],
  "chandelure": ["Ghost", "Fire"],
  "reuniclus": ["Psychic"],
  "conkeldurr": ["Fighting"],
  "jellicent": ["Water", "Ghost"],
  "whimsicott": ["Grass", "Fairy"],
  "bisharp": ["Dark", "Steel"],
  "mew": ["Psychic"],
  "mewtwo": ["Psychic"],
  "celebi": ["Psychic", "Grass"],
  "jirachi": ["Steel", "Psychic"],
  "deoxys": ["Psychic"],
  "deoxys-attack": ["Psychic"],
  "deoxysattack": ["Psychic"],
  "deoxys-defense": ["Psychic"],
  "deoxysdefense": ["Psychic"],
  "deoxys-speed": ["Psychic"],
  "deoxysspeed": ["Psychic"],
  "manaphy": ["Water"],
  "darkrai": ["Dark"],
  "shaymin": ["Grass"],
  "shaymin-sky": ["Grass", "Flying"],
  "shayminsky": ["Grass", "Flying"],
  "arceus": ["Normal"],
  "victini": ["Psychic", "Fire"],
  "keldeo": ["Water", "Fighting"],
  "meloetta": ["Normal", "Psychic"],
  "genesect": ["Bug", "Steel"],
  "diancie": ["Rock", "Fairy"],
  "hoopa": ["Psychic", "Ghost"],
  "hoopa-unbound": ["Psychic", "Dark"],
  "hoopaunbound": ["Psychic", "Dark"],
  "volcanion": ["Fire", "Water"],
  "marshadow": ["Fighting", "Ghost"],
  "zeraora": ["Electric"],
  "meltan": ["Steel"],
  "melmetal": ["Steel"],
};

// Type effectiveness chart
// Values: 0 = immune, 0.5 = resist, 1 = neutral, 2 = super effective
export const TYPE_EFFECTIVENESS: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug: { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock: { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

// Defensive type chart (what types deal super effective damage to this type)
export const TYPE_WEAKNESSES: Record<PokemonType, PokemonType[]> = {
  Normal: ["Fighting"],
  Fire: ["Water", "Ground", "Rock"],
  Water: ["Electric", "Grass"],
  Electric: ["Ground"],
  Grass: ["Fire", "Ice", "Poison", "Flying", "Bug"],
  Ice: ["Fire", "Fighting", "Rock", "Steel"],
  Fighting: ["Flying", "Psychic", "Fairy"],
  Poison: ["Ground", "Psychic"],
  Ground: ["Water", "Grass", "Ice"],
  Flying: ["Electric", "Ice", "Rock"],
  Psychic: ["Bug", "Ghost", "Dark"],
  Bug: ["Fire", "Flying", "Rock"],
  Rock: ["Water", "Grass", "Fighting", "Ground", "Steel"],
  Ghost: ["Ghost", "Dark"],
  Dragon: ["Ice", "Dragon", "Fairy"],
  Dark: ["Fighting", "Bug", "Fairy"],
  Steel: ["Fire", "Fighting", "Ground"],
  Fairy: ["Poison", "Steel"],
};

export const TYPE_RESISTANCES: Record<PokemonType, PokemonType[]> = {
  Normal: [],
  Fire: ["Fire", "Grass", "Ice", "Bug", "Steel", "Fairy"],
  Water: ["Fire", "Water", "Ice", "Steel"],
  Electric: ["Electric", "Flying", "Steel"],
  Grass: ["Water", "Electric", "Grass", "Ground"],
  Ice: ["Ice"],
  Fighting: ["Bug", "Rock", "Dark"],
  Poison: ["Grass", "Fighting", "Poison", "Bug", "Fairy"],
  Ground: ["Poison", "Rock"],
  Flying: ["Grass", "Fighting", "Bug"],
  Psychic: ["Fighting", "Psychic"],
  Bug: ["Grass", "Fighting", "Ground"],
  Rock: ["Normal", "Fire", "Poison", "Flying"],
  Ghost: ["Poison", "Bug"],
  Dragon: ["Fire", "Water", "Electric", "Grass"],
  Dark: ["Ghost", "Dark"],
  Steel: ["Normal", "Grass", "Ice", "Flying", "Psychic", "Bug", "Rock", "Dragon", "Steel", "Fairy"],
  Fairy: ["Fighting", "Bug", "Dark"],
};

export const TYPE_IMMUNITIES: Record<PokemonType, PokemonType[]> = {
  Normal: ["Ghost"],
  Fire: [],
  Water: [],
  Electric: [],
  Grass: [],
  Ice: [],
  Fighting: [],
  Poison: [],
  Ground: ["Electric"],
  Flying: ["Ground"],
  Psychic: [],
  Bug: [],
  Rock: [],
  Ghost: ["Normal", "Fighting"],
  Dragon: [],
  Dark: ["Psychic"],
  Steel: ["Poison"],
  Fairy: ["Dragon"],
};

/**
 * Get Pokemon types from name
 * Tries multiple name formats to handle variations like:
 * - "Great Tusk" vs "great-tusk" vs "greattusk"
 * - "Ogerpon-Wellspring" vs "ogerponwellspring"
 */
export function getPokemonTypes(pokemon: string): PokemonType[] {
  const lower = pokemon.toLowerCase();

  // Try several name formats
  const namesToTry = [
    lower.replace(/[^a-z0-9-]/g, ""),           // Keep hyphens: "great-tusk"
    lower.replace(/[^a-z0-9]/g, ""),            // No hyphens: "greattusk"
    lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""), // Spaces to hyphens: "great-tusk"
    lower.replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""),   // No spaces/hyphens: "greattusk"
  ];

  for (const name of namesToTry) {
    if (POKEMON_TYPES[name]) {
      return POKEMON_TYPES[name];
    }
  }

  // Log unknown Pokemon for debugging (only in dev)
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn(`Unknown Pokemon type: "${pokemon}" (tried: ${namesToTry.join(", ")})`);
  }

  // Return empty array for truly unknown Pokemon
  // This makes it clear in the UI that we don't have type data
  return [];
}

/**
 * Calculate type effectiveness multiplier for an attacking type against defending types
 */
export function getTypeEffectiveness(attackType: PokemonType, defenseTypes: PokemonType[]): number {
  let multiplier = 1;

  for (const defType of defenseTypes) {
    const effectiveness = TYPE_EFFECTIVENESS[attackType]?.[defType];
    if (effectiveness !== undefined) {
      multiplier *= effectiveness;
    }
  }

  return multiplier;
}

/**
 * Calculate defensive score for a Pokemon against an attacker's STAB types
 * Returns a score from -2 (very weak) to +2 (very strong)
 */
export function calculateMatchupScore(
  defenderTypes: PokemonType[],
  attackerTypes: PokemonType[]
): number {
  // Start at 0 so we properly track the worst (highest) effectiveness
  // Higher effectiveness = more damage taken = worse for defender
  let worstMatchup = 0;

  // Check each of attacker's STAB types
  for (const attackType of attackerTypes) {
    const effectiveness = getTypeEffectiveness(attackType, defenderTypes);
    if (effectiveness > worstMatchup) {
      worstMatchup = effectiveness;
    }
  }

  // Convert to score: 4x = -2, 2x = -1, 1x = 0, 0.5x = +1, 0.25x or 0x = +2
  if (worstMatchup === 0) return 2;  // Immunity
  if (worstMatchup <= 0.25) return 2; // Double resist
  if (worstMatchup <= 0.5) return 1;  // Single resist
  if (worstMatchup <= 1) return 0;    // Neutral
  if (worstMatchup <= 2) return -1;   // Weak
  return -2;                          // 4x weak
}

/**
 * Calculate offensive score for a Pokemon's STAB types against a target
 * Returns a score from -2 (ineffective) to +2 (super effective)
 */
export function calculateOffensiveScore(
  attackerTypes: PokemonType[],
  defenderTypes: PokemonType[]
): number {
  // Find best STAB effectiveness against target
  let bestMatchup = 0;

  for (const attackType of attackerTypes) {
    const effectiveness = getTypeEffectiveness(attackType, defenderTypes);
    if (effectiveness > bestMatchup) {
      bestMatchup = effectiveness;
    }
  }

  // Convert to score: 4x = +2, 2x = +1, 1x = 0, 0.5x = -1, 0.25x or 0x = -2
  if (bestMatchup >= 4) return 2;   // 4x super effective
  if (bestMatchup >= 2) return 1;   // Super effective
  if (bestMatchup >= 1) return 0;   // Neutral
  if (bestMatchup >= 0.5) return -1; // Resisted
  return -2;                         // Immune or double resisted
}

/**
 * Base stats interface
 */
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

/**
 * Pokemon base stats for speed calculations
 * Format: [HP, Atk, Def, SpA, SpD, Spe]
 */
const POKEMON_BASE_STATS: Record<string, BaseStats> = {
  // Gen 9 Meta Pokemon
  "great tusk": { hp: 115, atk: 131, def: 131, spa: 53, spd: 53, spe: 87 },
  "greattusk": { hp: 115, atk: 131, def: 131, spa: 53, spd: 53, spe: 87 },
  "kingambit": { hp: 100, atk: 135, def: 120, spa: 60, spd: 85, spe: 50 },
  "gholdengo": { hp: 87, atk: 60, def: 95, spa: 133, spd: 91, spe: 84 },
  "dragapult": { hp: 88, atk: 120, def: 75, spa: 100, spd: 75, spe: 142 },
  "iron valiant": { hp: 74, atk: 130, def: 90, spa: 120, spd: 60, spe: 116 },
  "ironvaliant": { hp: 74, atk: 130, def: 90, spa: 120, spd: 60, spe: 116 },
  "flutter mane": { hp: 55, atk: 55, def: 55, spa: 135, spd: 135, spe: 135 },
  "fluttermane": { hp: 55, atk: 55, def: 55, spa: 135, spd: 135, spe: 135 },
  "iron bundle": { hp: 56, atk: 80, def: 114, spa: 124, spd: 60, spe: 136 },
  "ironbundle": { hp: 56, atk: 80, def: 114, spa: 124, spd: 60, spe: 136 },
  "raging bolt": { hp: 125, atk: 73, def: 91, spa: 137, spd: 89, spe: 75 },
  "ragingbolt": { hp: 125, atk: 73, def: 91, spa: 137, spd: 89, spe: 75 },
  "ogerpon": { hp: 80, atk: 120, def: 84, spa: 60, spd: 96, spe: 110 },
  "ogerpontealmask": { hp: 80, atk: 120, def: 84, spa: 60, spd: 96, spe: 110 },
  "ogerponwellspring": { hp: 80, atk: 120, def: 84, spa: 60, spd: 96, spe: 110 },
  "ogerponhearthflame": { hp: 80, atk: 120, def: 84, spa: 60, spd: 96, spe: 110 },
  "ogerponcornerstone": { hp: 80, atk: 120, def: 84, spa: 60, spd: 96, spe: 110 },
  "garchomp": { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 },
  "landorus": { hp: 89, atk: 125, def: 90, spa: 115, spd: 80, spe: 101 },
  "landorustherian": { hp: 89, atk: 145, def: 90, spa: 105, spd: 80, spe: 91 },
  "urshifu": { hp: 100, atk: 130, def: 100, spa: 63, spd: 60, spe: 97 },
  "urshifurapidstrike": { hp: 100, atk: 130, def: 100, spa: 63, spd: 60, spe: 97 },
  "dragonite": { hp: 91, atk: 134, def: 95, spa: 100, spd: 100, spe: 80 },
  "roaring moon": { hp: 105, atk: 139, def: 71, spa: 55, spd: 101, spe: 119 },
  "roaringmoon": { hp: 105, atk: 139, def: 71, spa: 55, spd: 101, spe: 119 },
  "walking wake": { hp: 99, atk: 83, def: 91, spa: 125, spd: 83, spe: 109 },
  "walkingwake": { hp: 99, atk: 83, def: 91, spa: 125, spd: 83, spe: 109 },
  "gouging fire": { hp: 105, atk: 115, def: 121, spa: 65, spd: 93, spe: 91 },
  "gougingfire": { hp: 105, atk: 115, def: 121, spa: 65, spd: 93, spe: 91 },
  "iron hands": { hp: 154, atk: 140, def: 108, spa: 50, spd: 68, spe: 50 },
  "ironhands": { hp: 154, atk: 140, def: 108, spa: 50, spd: 68, spe: 50 },
  "iron treads": { hp: 90, atk: 112, def: 120, spa: 72, spd: 70, spe: 106 },
  "irontreads": { hp: 90, atk: 112, def: 120, spa: 72, spd: 70, spe: 106 },
  "annihilape": { hp: 110, atk: 115, def: 80, spa: 50, spd: 90, spe: 90 },
  "skeledirge": { hp: 104, atk: 75, def: 100, spa: 110, spd: 75, spe: 66 },
  "meowscarada": { hp: 76, atk: 110, def: 70, spa: 81, spd: 70, spe: 123 },
  "quaquaval": { hp: 85, atk: 120, def: 80, spa: 85, spd: 75, spe: 85 },
  "archaludon": { hp: 90, atk: 105, def: 130, spa: 125, spd: 65, spe: 85 },
  "chi-yu": { hp: 55, atk: 80, def: 80, spa: 135, spd: 120, spe: 100 },
  "chiyu": { hp: 55, atk: 80, def: 80, spa: 135, spd: 120, spe: 100 },
  "ting-lu": { hp: 155, atk: 110, def: 125, spa: 55, spd: 80, spe: 45 },
  "tinglu": { hp: 155, atk: 110, def: 125, spa: 55, spd: 80, spe: 45 },
  "chien-pao": { hp: 80, atk: 120, def: 80, spa: 90, spd: 65, spe: 135 },
  "chienpao": { hp: 80, atk: 120, def: 80, spa: 90, spd: 65, spe: 135 },
  "wo-chien": { hp: 85, atk: 85, def: 100, spa: 95, spd: 135, spe: 70 },
  "wochien": { hp: 85, atk: 85, def: 100, spa: 95, spd: 135, spe: 70 },
  // VGC Support Pokemon
  "incineroar": { hp: 95, atk: 115, def: 90, spa: 80, spd: 90, spe: 60 },
  "rillaboom": { hp: 100, atk: 125, def: 90, spa: 60, spd: 70, spe: 85 },
  "amoonguss": { hp: 114, atk: 85, def: 70, spa: 85, spd: 80, spe: 30 },
  "indeedee": { hp: 60, atk: 65, def: 55, spa: 105, spd: 95, spe: 95 },
  "indeedeef": { hp: 70, atk: 55, def: 65, spa: 95, spd: 105, spe: 85 },
  "tornadus": { hp: 79, atk: 115, def: 70, spa: 125, spd: 80, spe: 111 },
  "tornadustherian": { hp: 79, atk: 100, def: 80, spa: 110, spd: 90, spe: 121 },
  "whimsicott": { hp: 60, atk: 67, def: 85, spa: 77, spd: 75, spe: 116 },
  "grimmsnarl": { hp: 95, atk: 120, def: 65, spa: 95, spd: 75, spe: 60 },
  "hatterene": { hp: 57, atk: 90, def: 95, spa: 136, spd: 103, spe: 29 },
  "torkoal": { hp: 70, atk: 85, def: 140, spa: 85, spd: 70, spe: 20 },
  "pelipper": { hp: 60, atk: 50, def: 100, spa: 95, spd: 70, spe: 65 },
  "dondozo": { hp: 150, atk: 100, def: 115, spa: 65, spd: 65, spe: 35 },
  "tatsugiri": { hp: 68, atk: 50, def: 60, spa: 120, spd: 95, spe: 82 },
  "farigiraf": { hp: 120, atk: 90, def: 70, spa: 110, spd: 70, spe: 60 },
  "armarouge": { hp: 85, atk: 60, def: 100, spa: 125, spd: 80, spe: 75 },
  "ceruledge": { hp: 75, atk: 125, def: 80, spa: 60, spd: 100, spe: 85 },
  // Gen 9 Box Legends
  "koraidon": { hp: 100, atk: 135, def: 115, spa: 85, spd: 100, spe: 135 },
  "miraidon": { hp: 100, atk: 85, def: 100, spa: 135, spd: 115, spe: 135 },
  "terapagos": { hp: 90, atk: 65, def: 85, spa: 65, spd: 85, spe: 60 },
  // Fast Electric types
  "regieleki": { hp: 80, atk: 100, def: 50, spa: 100, spd: 50, spe: 200 },
  "zeraora": { hp: 88, atk: 112, def: 75, spa: 102, spd: 80, spe: 143 },
  "electrode": { hp: 60, atk: 50, def: 70, spa: 80, spd: 80, spe: 150 },
  // Gen 8 Meta Pokemon
  "zacian": { hp: 92, atk: 130, def: 115, spa: 80, spd: 115, spe: 138 },
  "zaciancrowned": { hp: 92, atk: 170, def: 115, spa: 80, spd: 115, spe: 148 },
  "zamazenta": { hp: 92, atk: 130, def: 115, spa: 80, spd: 115, spe: 138 },
  "zamazentacrowned": { hp: 92, atk: 130, def: 145, spa: 80, spd: 145, spe: 128 },
  "calyrex": { hp: 100, atk: 80, def: 80, spa: 80, spd: 80, spe: 80 },
  "calyrexshadow": { hp: 100, atk: 85, def: 80, spa: 165, spd: 100, spe: 150 },
  "calyrexice": { hp: 100, atk: 165, def: 150, spa: 85, spd: 130, spe: 50 },
  "spectrier": { hp: 100, atk: 65, def: 60, spa: 145, spd: 80, spe: 130 },
  "glastrier": { hp: 100, atk: 145, def: 130, spa: 65, spd: 110, spe: 30 },
  // Classic Pokemon
  "heatran": { hp: 91, atk: 90, def: 106, spa: 130, spd: 106, spe: 77 },
  "toxapex": { hp: 50, atk: 63, def: 152, spa: 53, spd: 142, spe: 35 },
  "ferrothorn": { hp: 74, atk: 94, def: 131, spa: 54, spd: 116, spe: 20 },
  "clefable": { hp: 95, atk: 70, def: 73, spa: 95, spd: 90, spe: 60 },
  "corviknight": { hp: 98, atk: 87, def: 105, spa: 53, spd: 85, spe: 67 },
  "tyranitar": { hp: 100, atk: 134, def: 110, spa: 95, spd: 100, spe: 61 },
  "excadrill": { hp: 110, atk: 135, def: 60, spa: 50, spd: 65, spe: 88 },
  "weavile": { hp: 70, atk: 120, def: 65, spa: 45, spd: 85, spe: 125 },
  "volcarona": { hp: 85, atk: 60, def: 65, spa: 135, spd: 105, spe: 100 },
  "hydreigon": { hp: 92, atk: 105, def: 90, spa: 125, spd: 90, spe: 98 },
  "kyurem": { hp: 125, atk: 130, def: 90, spa: 130, spd: 90, spe: 95 },
  "gliscor": { hp: 75, atk: 95, def: 125, spa: 45, spd: 75, spe: 95 },
  "rotomwash": { hp: 50, atk: 65, def: 107, spa: 105, spd: 107, spe: 86 },
  "hippowdon": { hp: 108, atk: 112, def: 118, spa: 68, spd: 72, spe: 47 },
  "azumarill": { hp: 100, atk: 50, def: 80, spa: 60, spd: 80, spe: 50 },
  "scizor": { hp: 70, atk: 130, def: 100, spa: 55, spd: 80, spe: 65 },
  "magnezone": { hp: 70, atk: 70, def: 115, spa: 130, spd: 90, spe: 60 },
  "gengar": { hp: 60, atk: 65, def: 60, spa: 130, spd: 75, spe: 110 },
  "alakazam": { hp: 55, atk: 50, def: 45, spa: 135, spd: 95, spe: 120 },
  "gyarados": { hp: 95, atk: 125, def: 79, spa: 60, spd: 100, spe: 81 },
  "garganacl": { hp: 100, atk: 100, def: 130, spa: 45, spd: 90, spe: 35 },
  "togekiss": { hp: 85, atk: 50, def: 95, spa: 120, spd: 115, spe: 80 },
  "sylveon": { hp: 95, atk: 65, def: 65, spa: 110, spd: 130, spe: 60 },
  "mimikyu": { hp: 55, atk: 90, def: 80, spa: 50, spd: 105, spe: 96 },
  "palafin": { hp: 100, atk: 70, def: 72, spa: 53, spd: 62, spe: 100 },
  "palafinhero": { hp: 100, atk: 160, def: 97, spa: 106, spd: 87, spe: 100 },
  "baxcalibur": { hp: 115, atk: 145, def: 92, spa: 75, spd: 86, spe: 87 },
  "ursaluna": { hp: 130, atk: 140, def: 105, spa: 45, spd: 80, spe: 50 },
  "ursalunabloodmoon": { hp: 113, atk: 70, def: 120, spa: 135, spd: 65, spe: 52 },
  "tinkaton": { hp: 85, atk: 75, def: 77, spa: 70, spd: 105, spe: 94 },
  "glimmora": { hp: 83, atk: 55, def: 90, spa: 130, spd: 81, spe: 86 },
  "espathra": { hp: 95, atk: 60, def: 60, spa: 101, spd: 60, spe: 105 },
  // Starters
  "charizard": { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
  "venusaur": { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
  "blastoise": { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 },
  "cinderace": { hp: 80, atk: 116, def: 75, spa: 65, spd: 75, spe: 119 },
  "greninja": { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
  "blaziken": { hp: 80, atk: 120, def: 70, spa: 110, spd: 70, spe: 80 },
  "lucario": { hp: 70, atk: 110, def: 70, spa: 115, spd: 70, spe: 90 },
};

/**
 * Get base stats for a Pokemon by name
 */
export function getPokemonBaseStats(pokemon: string): BaseStats | null {
  const lower = pokemon.toLowerCase();

  // Try several name formats
  const namesToTry = [
    lower.replace(/[^a-z0-9-]/g, ""),
    lower.replace(/[^a-z0-9]/g, ""),
    lower.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
    lower.replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""),
  ];

  for (const name of namesToTry) {
    if (POKEMON_BASE_STATS[name]) {
      return POKEMON_BASE_STATS[name];
    }
  }

  return null;
}
