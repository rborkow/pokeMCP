import type { TeamPokemon, BaseStats } from "@/types/pokemon";

/**
 * Parse a Pokemon Showdown team paste format into TeamPokemon array
 *
 * Example format:
 * Garchomp @ Life Orb
 * Ability: Rough Skin
 * Tera Type: Fire
 * EVs: 252 Atk / 4 SpD / 252 Spe
 * Jolly Nature
 * - Earthquake
 * - Dragon Claw
 * - Swords Dance
 * - Fire Fang
 */
export function parseShowdownTeam(paste: string): TeamPokemon[] {
  const blocks = paste
    .trim()
    .split(/\n\s*\n/)
    .filter((block) => block.trim());
  return blocks.map(parsePokemonBlock).filter((p): p is TeamPokemon => p !== null);
}

function parsePokemonBlock(block: string): TeamPokemon | null {
  const lines = block.trim().split("\n");
  if (lines.length === 0) return null;

  const pokemon: TeamPokemon = {
    pokemon: "",
    moves: [],
  };

  // Parse first line: "Nickname (Species) @ Item" or "Species @ Item"
  const firstLine = lines[0].trim();
  const firstLineMatch = firstLine.match(/^(.+?)(?:\s*@\s*(.+))?$/);

  if (firstLineMatch) {
    const nameOrNickname = firstLineMatch[1].trim();
    pokemon.item = firstLineMatch[2]?.trim();

    // Check for gender suffix first (single M or F in parentheses)
    const genderMatch = nameOrNickname.match(/^(.+?)\s*\(([MF])\)$/);
    if (genderMatch) {
      pokemon.pokemon = genderMatch[1].trim();
      pokemon.gender = genderMatch[2] as "M" | "F";
    } else {
      // Check for (Species) pattern indicating nickname
      const speciesMatch = nameOrNickname.match(/^(.+?)\s*\(([^)]+)\)$/);
      if (speciesMatch) {
        pokemon.nickname = speciesMatch[1].trim();
        pokemon.pokemon = speciesMatch[2].trim();
      } else {
        pokemon.pokemon = nameOrNickname;
      }
    }
  }

  if (!pokemon.pokemon) return null;

  // Parse remaining lines
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("Ability:")) {
      pokemon.ability = line.replace("Ability:", "").trim();
    } else if (line.startsWith("Tera Type:")) {
      pokemon.teraType = line.replace("Tera Type:", "").trim();
    } else if (line.startsWith("EVs:")) {
      pokemon.evs = parseStats(line.replace("EVs:", "").trim());
    } else if (line.startsWith("IVs:")) {
      pokemon.ivs = parseStats(line.replace("IVs:", "").trim());
    } else if (line.endsWith("Nature")) {
      pokemon.nature = line.replace("Nature", "").trim();
    } else if (line.startsWith("Level:")) {
      pokemon.level = parseInt(line.replace("Level:", "").trim(), 10);
    } else if (line.startsWith("Shiny:")) {
      pokemon.shiny = line.replace("Shiny:", "").trim().toLowerCase() === "yes";
    } else if (line.startsWith("-")) {
      const move = line.replace("-", "").trim();
      if (move && pokemon.moves.length < 4) {
        pokemon.moves.push(move);
      }
    }
  }

  return pokemon;
}

function parseStats(statsStr: string): Partial<BaseStats> {
  const stats: Partial<BaseStats> = {};
  const statMap: Record<string, keyof BaseStats> = {
    HP: "hp",
    Atk: "atk",
    Def: "def",
    SpA: "spa",
    SpD: "spd",
    Spe: "spe",
  };

  const parts = statsStr.split("/").map((s) => s.trim());
  for (const part of parts) {
    const match = part.match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const statName = match[2];
      // Find the matching stat key (case insensitive)
      for (const [key, stat] of Object.entries(statMap)) {
        if (key.toLowerCase() === statName.toLowerCase()) {
          stats[stat] = value;
          break;
        }
      }
    }
  }

  return stats;
}

/**
 * Export a team to Pokemon Showdown paste format
 */
export function exportShowdownTeam(team: TeamPokemon[]): string {
  return team.map(exportPokemonBlock).join("\n\n");
}

function exportPokemonBlock(pokemon: TeamPokemon): string {
  const lines: string[] = [];

  // First line: Nickname (Species) @ Item or Species @ Item
  let firstLine = "";
  if (pokemon.nickname) {
    firstLine = `${pokemon.nickname} (${pokemon.pokemon})`;
  } else if (pokemon.gender) {
    firstLine = `${pokemon.pokemon} (${pokemon.gender})`;
  } else {
    firstLine = pokemon.pokemon;
  }
  if (pokemon.item) {
    firstLine += ` @ ${pokemon.item}`;
  }
  lines.push(firstLine);

  // Ability
  if (pokemon.ability) {
    lines.push(`Ability: ${pokemon.ability}`);
  }

  // Level (if not 100)
  if (pokemon.level && pokemon.level !== 100) {
    lines.push(`Level: ${pokemon.level}`);
  }

  // Shiny
  if (pokemon.shiny) {
    lines.push("Shiny: Yes");
  }

  // Tera Type
  if (pokemon.teraType) {
    lines.push(`Tera Type: ${pokemon.teraType}`);
  }

  // EVs
  if (pokemon.evs && Object.keys(pokemon.evs).length > 0) {
    lines.push(`EVs: ${formatStats(pokemon.evs)}`);
  }

  // Nature
  if (pokemon.nature) {
    lines.push(`${pokemon.nature} Nature`);
  }

  // IVs (only if not all 31)
  if (pokemon.ivs && Object.keys(pokemon.ivs).length > 0) {
    lines.push(`IVs: ${formatStats(pokemon.ivs)}`);
  }

  // Moves
  for (const move of pokemon.moves) {
    lines.push(`- ${move}`);
  }

  return lines.join("\n");
}

function formatStats(stats: Partial<BaseStats>): string {
  const statNames: Record<keyof BaseStats, string> = {
    hp: "HP",
    atk: "Atk",
    def: "Def",
    spa: "SpA",
    spd: "SpD",
    spe: "Spe",
  };

  const parts: string[] = [];
  for (const [key, value] of Object.entries(stats)) {
    if (value !== undefined && value !== null) {
      parts.push(`${value} ${statNames[key as keyof BaseStats]}`);
    }
  }

  return parts.join(" / ");
}

/**
 * Convert Pokemon name to Showdown ID format
 * "Landorus-Therian" -> "landorustherian"
 */
export function toID(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
