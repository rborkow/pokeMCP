import { toID } from './data-loader.js';
import type { UsageStatistics } from 'smogon';

/**
 * Get cached stats for a format from KV
 */
async function getCachedStats(format: string, env: Env): Promise<UsageStatistics | null> {
  try {
    const cached = await env.POKEMON_STATS.get(format, 'json');
    if (!cached || typeof cached !== 'object' || !cached.data) {
      return null;
    }
    return cached.data;
  } catch (error) {
    console.error(`Error fetching stats from KV for ${format}:`, error);
    return null;
  }
}

/**
 * Find a Pokemon in stats data by trying different name formats.
 * Stats keys use display names like "Great Tusk" while we receive IDs like "greattusk".
 */
function findPokemonInStats(
  stats: UsageStatistics,
  pokemonName: string
): { key: string; data: any } | null {
  const pokemonId = toID(pokemonName);

  // First try direct ID match
  if (stats.data[pokemonId]) {
    return { key: pokemonId, data: stats.data[pokemonId] };
  }

  // Search through all keys and compare their IDs
  for (const key of Object.keys(stats.data)) {
    if (toID(key) === pokemonId) {
      return { key, data: stats.data[key] };
    }
  }

  return null;
}

/**
 * Get the most popular sets for a Pokémon from usage stats
 */
export async function getPopularSets(args: {
  pokemon: string;
  format?: string;
}, env: Env): Promise<string> {
  const format = args.format || 'gen9ou';

  const stats = await getCachedStats(format, env);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const found = findPokemonInStats(stats, args.pokemon);

  if (!found) {
    return `${args.pokemon} not found in ${format} usage statistics.`;
  }

  const pokemonStats = found.data;
  const displayName = found.key;

  let output = `**${args.pokemon} in ${format.toUpperCase()}**\n\n`;
  output += `**Usage:** ${(pokemonStats.usage * 100).toFixed(2)}%\n\n`;

  // Helper to normalize values (chaos format uses weighted counts, not percentages)
  const normalize = (data: Record<string, number>) => {
    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    return Object.entries(data)
      .map(([key, value]) => [key, (value / total) * 100] as [string, number])
      .sort(([, a], [, b]) => b - a);
  };

  // Abilities
  if (pokemonStats.Abilities) {
    output += `**Popular Abilities:**\n`;
    const abilities = normalize(pokemonStats.Abilities).slice(0, 3);
    for (const [ability, pct] of abilities) {
      output += `- ${ability}: ${pct.toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Items
  if (pokemonStats.Items) {
    output += `**Popular Items:**\n`;
    const items = normalize(pokemonStats.Items).slice(0, 5);
    for (const [item, pct] of items) {
      output += `- ${item}: ${pct.toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Moves
  if (pokemonStats.Moves) {
    output += `**Popular Moves:**\n`;
    const moves = normalize(pokemonStats.Moves).slice(0, 8);
    for (const [move, pct] of moves) {
      output += `- ${move}: ${pct.toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Spreads
  if (pokemonStats.Spreads) {
    output += `**Common EV Spreads:**\n`;
    const spreads = normalize(pokemonStats.Spreads).slice(0, 3);
    for (const [spread, pct] of spreads) {
      output += `- ${spread}: ${pct.toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Tera Types (Gen 9 only)
  if (pokemonStats['Tera Types'] && format.startsWith('gen9')) {
    const teraTypes = normalize(pokemonStats['Tera Types'])
      .filter(([type]) => type.toLowerCase() !== 'nothing')  // Filter out "nothing" entries
      .slice(0, 5);

    if (teraTypes.length > 0) {
      output += `**Popular Tera Types:**\n`;
      for (const [type, pct] of teraTypes) {
        // Capitalize first letter
        const displayType = type.charAt(0).toUpperCase() + type.slice(1);
        output += `- ${displayType}: ${pct.toFixed(1)}%\n`;
      }
    }
  }

  return output;
}

/**
 * Get the top threats in the metagame by usage
 */
export async function getMetaThreats(args: { format?: string; limit?: number }, env: Env): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 20;

  const stats = await getCachedStats(format, env);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const threats = Object.entries(stats.data)
    .map(([id, data]) => ({ name: id, usage: data.usage }))
    .sort((a, b) => b.usage - a.usage)
    .slice(0, limit);

  let output = `**Top ${limit} Threats in ${format.toUpperCase()}:**\n\n`;

  for (let i = 0; i < threats.length; i++) {
    const threat = threats[i];
    output += `${i + 1}. **${threat.name}** - ${(threat.usage * 100).toFixed(2)}% usage\n`;
  }

  return output;
}

/**
 * Get common teammates for a Pokémon
 */
export async function getTeammates(args: {
  pokemon: string;
  format?: string;
  limit?: number;
}, env: Env): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 10;

  const stats = await getCachedStats(format, env);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const found = findPokemonInStats(stats, args.pokemon);

  if (!found) {
    return `${args.pokemon} not found in ${format} usage statistics.`;
  }

  const pokemonStats = found.data;

  if (!pokemonStats.Teammates) {
    return `No teammate data available for ${args.pokemon} in ${format}.`;
  }

  // Normalize teammate values (chaos format uses weighted counts)
  const total = Object.values(pokemonStats.Teammates).reduce((sum: number, v: number) => sum + v, 0);
  const teammates = Object.entries(pokemonStats.Teammates)
    .map(([key, value]) => [key, total > 0 ? ((value as number) / total) * 100 : 0] as [string, number])
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  let output = `**Common Teammates for ${args.pokemon} in ${format.toUpperCase()}:**\n\n`;

  for (const [teammate, pct] of teammates) {
    output += `- **${teammate}**: ${pct.toFixed(1)}%\n`;
  }

  return output;
}

/**
 * Get checks and counters for a Pokémon
 */
export async function getChecksCounters(args: {
  pokemon: string;
  format?: string;
  limit?: number;
}, env: Env): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 15;

  const stats = await getCachedStats(format, env);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const found = findPokemonInStats(stats, args.pokemon);

  if (!found) {
    return `${args.pokemon} not found in ${format} usage statistics.`;
  }

  const pokemonStats = found.data;

  if (!pokemonStats['Checks and Counters']) {
    return `No checks and counters data available for ${args.pokemon} in ${format}.`;
  }

  const checksCounters = Object.entries(pokemonStats['Checks and Counters'])
    .map(([name, data]: [string, any]) => ({
      name,
      score: data[0],
      koed: data[1],
      switched: data[2],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  let output = `**Checks and Counters for ${args.pokemon} in ${format.toUpperCase()}:**\n\n`;
  output += `(Score: higher = more effective. KOed % = KO rate, Switched % = switch out rate)\n\n`;

  for (const check of checksCounters) {
    output += `- **${check.name}**: Score ${check.score.toFixed(2)} (${check.koed.toFixed(1)}% KOed, ${check.switched.toFixed(1)}% switched)\n`;
  }

  return output;
}

/**
 * Get overall metagame statistics
 */
export async function getMetagameStats(args: { format?: string }, env: Env): Promise<string> {
  const format = args.format || 'gen9ou';

  const stats = await getCachedStats(format, env);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const info = stats.info;
  const totalPokemon = Object.keys(stats.data).length;

  let output = `**Metagame Statistics for ${format.toUpperCase()}:**\n\n`;
  output += `- **Total Pokémon:** ${totalPokemon}\n`;
  output += `- **Total Battles:** ${info['number of battles'].toLocaleString()}\n`;
  output += `- **Average Weight/Team:** ${info['avg weight/team']}\n\n`;

  // Get usage tiers
  const usageTiers = {
    'S Tier (>10%)': 0,
    'A Tier (5-10%)': 0,
    'B Tier (2-5%)': 0,
    'C Tier (1-2%)': 0,
    'D Tier (<1%)': 0,
  };

  for (const [, data] of Object.entries(stats.data)) {
    const usage = data.usage * 100;
    if (usage > 10) usageTiers['S Tier (>10%)']++;
    else if (usage > 5) usageTiers['A Tier (5-10%)']++;
    else if (usage > 2) usageTiers['B Tier (2-5%)']++;
    else if (usage > 1) usageTiers['C Tier (1-2%)']++;
    else usageTiers['D Tier (<1%)']++;
  }

  output += `**Usage Tiers:**\n`;
  for (const [tier, count] of Object.entries(usageTiers)) {
    output += `- ${tier}: ${count} Pokémon\n`;
  }

  return output;
}
