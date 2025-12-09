import {
  getPokemon,
  getMove,
  getPokemonLearnset,
  getPokemonFormatData,
  toID,
  getTypeChart,
  getPokedex,
} from './data-loader.js';
import type { TeamPokemon } from './types.js';

/**
 * Look up detailed information about a Pokémon
 */
export function lookupPokemon(args: { pokemon: string; generation?: string }): string {
  const species = getPokemon(args.pokemon);

  if (!species) {
    return `Pokémon "${args.pokemon}" not found.`;
  }

  const formatData = getPokemonFormatData(args.pokemon);

  let output = `**${species.name}** (${species.types.join('/')})\n`;
  output += `National Dex #${species.num}\n\n`;

  // Base Stats
  output += `**Base Stats:**\n`;
  output += `- HP: ${species.baseStats.hp}\n`;
  output += `- Attack: ${species.baseStats.atk}\n`;
  output += `- Defense: ${species.baseStats.def}\n`;
  output += `- Sp. Atk: ${species.baseStats.spa}\n`;
  output += `- Sp. Def: ${species.baseStats.spd}\n`;
  output += `- Speed: ${species.baseStats.spe}\n`;
  output += `- **BST: ${Object.values(species.baseStats).reduce((a, b) => a + b, 0)}**\n\n`;

  // Abilities
  output += `**Abilities:**\n`;
  if (species.abilities['0']) output += `- ${species.abilities['0']}\n`;
  if (species.abilities['1']) output += `- ${species.abilities['1']}\n`;
  if (species.abilities.H) output += `- ${species.abilities.H} (Hidden)\n`;
  output += '\n';

  // Tier info
  if (formatData) {
    output += `**Tier Information:**\n`;
    if (formatData.tier) output += `- Singles: ${formatData.tier}\n`;
    if (formatData.doublesTier) output += `- Doubles: ${formatData.doublesTier}\n`;
    if (formatData.natDexTier) output += `- National Dex: ${formatData.natDexTier}\n`;
    output += '\n';
  }

  // Physical characteristics
  if (species.heightm || species.weightkg) {
    output += `**Physical:**\n`;
    if (species.heightm) output += `- Height: ${species.heightm}m\n`;
    if (species.weightkg) output += `- Weight: ${species.weightkg}kg\n`;
    output += '\n';
  }

  // Evolution
  if (species.prevo) {
    output += `**Evolves from:** ${species.prevo}`;
    if (species.evoLevel) output += ` (Level ${species.evoLevel})`;
    output += '\n';
  }
  if (species.evos && species.evos.length > 0) {
    output += `**Evolves into:** ${species.evos.join(', ')}\n`;
  }

  return output;
}

/**
 * Parse a learnset method string (e.g., "9L1" -> {gen: 9, method: "L", level: 1})
 */
function parseLearnsetMethod(methodStr: string) {
  const gen = parseInt(methodStr[0], 10);
  const method = methodStr[1];
  const detail = methodStr.substring(2);

  const methods: { [key: string]: string } = {
    L: 'Level-up',
    M: 'TM/HM',
    T: 'Tutor',
    E: 'Egg',
    S: 'Event',
    D: 'Dream World',
    V: 'Virtual Console',
    R: 'Reminder',
  };

  return {
    gen,
    method: methods[method] || method,
    detail,
    raw: methodStr,
  };
}

/**
 * Validate if a Pokémon can learn a set of moves
 */
export function validateMoveset(args: {
  pokemon: string;
  moves: string[];
  generation?: string;
}): string {
  const species = getPokemon(args.pokemon);
  if (!species) {
    return `Pokémon "${args.pokemon}" not found.`;
  }

  const learnset = getPokemonLearnset(args.pokemon);
  if (!learnset?.learnset) {
    return `No learnset data found for ${species.name}.`;
  }

  const targetGen = args.generation ? parseInt(args.generation, 10) : 9;
  const results: string[] = [];
  const illegalMoves: string[] = [];

  results.push(`**Moveset Validation for ${species.name} (Gen ${targetGen})**\n`);

  for (const moveName of args.moves) {
    const move = getMove(moveName);
    if (!move) {
      results.push(`❌ **${moveName}**: Move not found`);
      illegalMoves.push(moveName);
      continue;
    }

    const moveId = toID(moveName);
    const learnMethods = learnset.learnset[moveId];

    if (!learnMethods) {
      results.push(`❌ **${move.name}**: Cannot be learned by ${species.name}`);
      illegalMoves.push(move.name);
      continue;
    }

    // Check if the move can be learned in the target generation
    const validMethods = learnMethods
      .map(parseLearnsetMethod)
      .filter((m) => m.gen <= targetGen);

    if (validMethods.length === 0) {
      results.push(
        `❌ **${move.name}**: Not available in Gen ${targetGen} (available in: ${learnMethods
          .map((m) => `Gen ${m[0]}`)
          .join(', ')})`
      );
      illegalMoves.push(move.name);
      continue;
    }

    // Get the most recent method
    const bestMethod = validMethods.reduce((best, current) =>
      current.gen > best.gen ? current : best
    );

    results.push(
      `✅ **${move.name}**: Legal (${bestMethod.method}${
        bestMethod.detail ? ' ' + bestMethod.detail : ''
      }, Gen ${bestMethod.gen})`
    );
  }

  results.push('');
  if (illegalMoves.length === 0) {
    results.push('✅ **All moves are legal!**');
  } else {
    results.push(`❌ **${illegalMoves.length} illegal move(s) detected**`);
  }

  return results.join('\n');
}

/**
 * Validate a team against format rules
 */
export function validateTeam(args: { team: TeamPokemon[]; format?: string }): string {
  const format = args.format || 'OU';
  const results: string[] = [];
  const errors: string[] = [];

  results.push(`**Team Validation for ${format} Format**\n`);

  // Check team size
  if (args.team.length === 0) {
    return 'Error: Team is empty.';
  }

  if (args.team.length > 6) {
    errors.push(`Team has ${args.team.length} Pokémon (max 6)`);
  }

  // Species Clause: Check for duplicate species
  const speciesCount = new Map<string, number>();
  const speciesNames: string[] = [];

  for (const member of args.team) {
    const species = getPokemon(member.pokemon);
    if (!species) {
      errors.push(`Pokémon "${member.pokemon}" not found`);
      continue;
    }

    speciesNames.push(species.name);

    // Get base species for forms
    const baseSpecies = species.baseSpecies || species.name;
    const count = (speciesCount.get(baseSpecies) || 0) + 1;
    speciesCount.set(baseSpecies, count);

    if (count > 1) {
      errors.push(`Species Clause violation: Multiple ${baseSpecies}`);
    }

    // Check tier legality
    const formatData = getPokemonFormatData(member.pokemon);
    if (formatData) {
      // For now, just report tier info - full tier checking would need format rules
      const tier = formatData.tier || 'Unknown';
      results.push(`- ${species.name}: ${tier} tier`);
    }

    // Validate moveset
    if (member.moves && member.moves.length > 0) {
      if (member.moves.length > 4) {
        errors.push(`${species.name} has ${member.moves.length} moves (max 4)`);
      }

      const learnset = getPokemonLearnset(member.pokemon);
      if (learnset?.learnset) {
        for (const moveName of member.moves) {
          const moveId = toID(moveName);
          if (!learnset.learnset[moveId]) {
            const move = getMove(moveName);
            errors.push(
              `${species.name} cannot learn ${move?.name || moveName}`
            );
          }
        }
      }
    }

    // Check ability legality
    if (member.ability) {
      const abilityList = Object.values(species.abilities);
      if (!abilityList.includes(member.ability)) {
        errors.push(
          `${species.name} cannot have ability "${member.ability}" (legal: ${abilityList.join(', ')})`
        );
      }
    }
  }

  results.push('\n**Team:**');
  results.push(speciesNames.join(', '));
  results.push('');

  if (errors.length > 0) {
    results.push('**❌ Validation Errors:**');
    errors.forEach((err) => results.push(`- ${err}`));
  } else {
    results.push('**✅ Team is valid!**');
  }

  return results.join('\n');
}

/**
 * Calculate type coverage for a team
 */
function calculateTypeCoverage(team: string[]): {
  offensiveCoverage: Set<string>;
  weaknesses: Map<string, number>;
  resistances: Map<string, number>;
} {
  const typeChart = getTypeChart();
  const allTypes = Object.keys(typeChart);

  const offensiveCoverage = new Set<string>();
  const weaknesses = new Map<string, number>();
  const resistances = new Map<string, number>();

  // Collect all types on the team
  for (const pokemonName of team) {
    const species = getPokemon(pokemonName);
    if (!species) continue;

    // Offensive coverage: which types this team can hit super-effectively
    for (const type of species.types) {
      const typeData = typeChart[type.toLowerCase()];
      if (typeData) {
        // Types this type is super-effective against
        for (const defendingType of allTypes) {
          const effectiveness = typeData.damageTaken?.[defendingType];
          // In Pokémon Showdown: 1 = super effective when defending (weak to)
          // We need to reverse this for offensive coverage
        }
      }
    }

    // Defensive analysis
    for (const attackingType of allTypes) {
      let totalEffectiveness = 1;

      for (const defenderType of species.types) {
        const typeData = typeChart[defenderType.toLowerCase()];
        if (!typeData) continue;

        const effectiveness = typeData.damageTaken?.[attackingType];
        // 0 = no effect, 1 = not very effective, 2 = neutral, 3 = super effective
        if (effectiveness === 0) totalEffectiveness = 0;
        else if (effectiveness === 1) totalEffectiveness *= 0.5;
        else if (effectiveness === 3) totalEffectiveness *= 2;
      }

      if (totalEffectiveness >= 2) {
        weaknesses.set(attackingType, (weaknesses.get(attackingType) || 0) + 1);
      } else if (totalEffectiveness <= 0.5) {
        resistances.set(attackingType, (resistances.get(attackingType) || 0) + 1);
      }
    }
  }

  return { offensiveCoverage, weaknesses, resistances };
}

/**
 * Suggest Pokémon to fill team gaps
 */
export function suggestTeamCoverage(args: {
  current_team: string[];
  format?: string;
}): string {
  const format = args.format || 'OU';
  const results: string[] = [];

  results.push(`**Team Coverage Analysis for ${format}**\n`);

  // Validate current team
  const validTeam: string[] = [];
  for (const pokemonName of args.current_team) {
    const species = getPokemon(pokemonName);
    if (species) {
      validTeam.push(species.name);
    } else {
      results.push(`⚠️ "${pokemonName}" not found, skipping...`);
    }
  }

  if (validTeam.length === 0) {
    return 'Error: No valid Pokémon in team.';
  }

  results.push(`**Current Team (${validTeam.length}/6):**`);
  results.push(validTeam.join(', '));
  results.push('');

  // Analyze type coverage
  const { weaknesses, resistances } = calculateTypeCoverage(validTeam);

  // Show weaknesses
  if (weaknesses.size > 0) {
    results.push('**⚠️ Team Weaknesses:**');
    const sortedWeaknesses = Array.from(weaknesses.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [type, count] of sortedWeaknesses) {
      results.push(`- ${type}: ${count} Pokémon weak`);
    }
    results.push('');
  }

  // Show resistances
  if (resistances.size > 0) {
    results.push('**✅ Team Resistances:**');
    const sortedResistances = Array.from(resistances.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    for (const [type, count] of sortedResistances.slice(0, 5)) {
      results.push(`- ${type}: ${count} Pokémon resist`);
    }
    results.push('');
  }

  // Type distribution
  const typeCount = new Map<string, number>();
  for (const pokemonName of validTeam) {
    const species = getPokemon(pokemonName);
    if (!species) continue;
    for (const type of species.types) {
      typeCount.set(type, (typeCount.get(type) || 0) + 1);
    }
  }

  results.push('**Type Distribution:**');
  const sortedTypes = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
  results.push(sortedTypes.map(([type, count]) => `${type} (${count})`).join(', '));
  results.push('');

  // Suggestions
  if (validTeam.length < 6) {
    results.push('**💡 Suggestions:**');

    // Find types that would cover weaknesses
    const coveringTypes = new Set<string>();
    for (const [weakType] of weaknesses) {
      // Types that resist this weakness
      const typeChart = getTypeChart();
      for (const [resistType, data] of Object.entries(typeChart)) {
        const effectiveness = data.damageTaken?.[weakType];
        if (effectiveness === 1 || effectiveness === 0) {
          coveringTypes.add(resistType.charAt(0).toUpperCase() + resistType.slice(1));
        }
      }
    }

    if (coveringTypes.size > 0) {
      results.push(
        `Consider adding: ${Array.from(coveringTypes).slice(0, 5).join(', ')} types`
      );
    }
  }

  return results.join('\n');
}
