import { Statistics, UsageStatistics, MovesetStatistics } from 'smogon';
import { toID } from './data-loader.js';

/**
 * Fetch usage statistics for a format
 */
async function fetchStats(format: string): Promise<UsageStatistics | null> {
  try {
    // Get the latest date for this format
    const latest = await Statistics.latestDate(format);
    if (!latest) {
      return null;
    }

    // Get the URL for chaos.json (most detailed stats)
    const url = Statistics.url(latest.date, format, true, 'chaos');

    // Fetch the raw data
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw = await response.text();

    // Process into UsageStatistics
    return Statistics.process(raw);
  } catch (error) {
    console.error(`Error fetching stats for ${format}:`, error);
    return null;
  }
}

/**
 * Get the most popular sets for a Pokémon from usage stats
 */
export async function getPopularSets(args: {
  pokemon: string;
  format?: string;
}): Promise<string> {
  const format = args.format || 'gen9ou';
  const pokemonId = toID(args.pokemon);

  const stats = await fetchStats(format);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const pokemonStats = stats.data[pokemonId];
  if (!pokemonStats) {
    return `No usage statistics found for ${args.pokemon} in ${format}.`;
  }

  const results: string[] = [];
  results.push(`**Popular Sets for ${args.pokemon} in ${format.toUpperCase()}**\n`);

  // Usage percentage
  const usagePercent = (pokemonStats.usage * 100).toFixed(2);
  results.push(`**Usage:** ${usagePercent}% (${pokemonStats['Raw count']} uses)\n`);

  // Most used abilities
  if (pokemonStats.Abilities) {
    results.push('**Most Used Abilities:**');
    const abilities = Object.entries(pokemonStats.Abilities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [ability, weight] of abilities) {
      const percentage = (weight * 100).toFixed(1);
      results.push(`- ${ability}: ${percentage}%`);
    }
    results.push('');
  }

  // Most used items
  if (pokemonStats.Items) {
    results.push('**Most Used Items:**');
    const items = Object.entries(pokemonStats.Items)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [item, weight] of items) {
      const percentage = (weight * 100).toFixed(1);
      results.push(`- ${item}: ${percentage}%`);
    }
    results.push('');
  }

  // Most used moves
  if (pokemonStats.Moves) {
    results.push('**Most Used Moves:**');
    const moves = Object.entries(pokemonStats.Moves)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    for (const [move, weight] of moves) {
      const percentage = (weight * 100).toFixed(1);
      results.push(`- ${move}: ${percentage}%`);
    }
    results.push('');
  }

  // Most common spreads
  if (pokemonStats.Spreads) {
    results.push('**Most Common EV Spreads:**');
    const spreads = Object.entries(pokemonStats.Spreads)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    for (const [spread, weight] of spreads) {
      const percentage = (weight * 100).toFixed(1);
      results.push(`- ${spread}: ${percentage}%`);
    }
    results.push('');
  }

  // Tera Types
  if (pokemonStats['Tera Types']) {
    results.push('**Most Common Tera Types:**');
    const teraTypes = Object.entries(pokemonStats['Tera Types'])
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    for (const [type, weight] of teraTypes) {
      const percentage = (weight * 100).toFixed(1);
      results.push(`- ${type}: ${percentage}%`);
    }
  }

  return results.join('\n');
}

/**
 * Get top threats in the metagame by usage
 */
export async function getMetaThreats(args: { format?: string; limit?: number }): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 20;

  const stats = await fetchStats(format);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const results: string[] = [];
  results.push(`**Top ${limit} Threats in ${format.toUpperCase()}**\n`);
  results.push(`Based on ${stats.info['number of battles'].toLocaleString()} battles\n`);

  // Sort Pokémon by usage
  const sorted = Object.entries(stats.data)
    .sort(([, a], [, b]) => b.usage - a.usage)
    .slice(0, limit);

  results.push('| Rank | Pokémon | Usage % | Raw Count |');
  results.push('|------|---------|---------|-----------|');

  sorted.forEach(([name, data], index) => {
    const usage = (data.usage * 100).toFixed(2);
    results.push(`| ${index + 1} | ${name} | ${usage}% | ${data['Raw count']} |`);
  });

  return results.join('\n');
}

/**
 * Get common teammates for a Pokémon
 */
export async function getTeammates(args: {
  pokemon: string;
  format?: string;
  limit?: number;
}): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 10;
  const pokemonId = toID(args.pokemon);

  const stats = await fetchStats(format);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const pokemonStats = stats.data[pokemonId];
  if (!pokemonStats) {
    return `No usage statistics found for ${args.pokemon} in ${format}.`;
  }

  if (!pokemonStats.Teammates) {
    return `No teammate data available for ${args.pokemon}.`;
  }

  const results: string[] = [];
  results.push(`**Common Teammates for ${args.pokemon} in ${format.toUpperCase()}**\n`);

  // Sort teammates by correlation
  const teammates = Object.entries(pokemonStats.Teammates)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);

  results.push('**Note:** Values show P(X|Y) - P(X), meaning how much more likely this Pokémon appears on teams with your Pokémon.\n');
  results.push('| Pokémon | Correlation |');
  results.push('|---------|-------------|');

  for (const [teammate, correlation] of teammates) {
    const percent = (correlation * 100).toFixed(2);
    const sign = correlation >= 0 ? '+' : '';
    results.push(`| ${teammate} | ${sign}${percent}% |`);
  }

  return results.join('\n');
}

/**
 * Get checks and counters for a Pokémon
 */
export async function getChecksCounters(args: {
  pokemon: string;
  format?: string;
  limit?: number;
}): Promise<string> {
  const format = args.format || 'gen9ou';
  const limit = args.limit || 15;
  const pokemonId = toID(args.pokemon);

  const stats = await fetchStats(format);

  if (!stats) {
    return `No usage statistics found for format "${format}".`;
  }

  const pokemonStats = stats.data[pokemonId];
  if (!pokemonStats) {
    return `No usage statistics found for ${args.pokemon} in ${format}.`;
  }

  if (!pokemonStats['Checks and Counters']) {
    return `No counter data available for ${args.pokemon}.`;
  }

  const results: string[] = [];
  results.push(`**Checks & Counters for ${args.pokemon} in ${format.toUpperCase()}**\n`);

  // Sort by number of encounters (first value in array)
  const counters = Object.entries(pokemonStats['Checks and Counters'])
    .sort(([, a], [, b]) => b[0] - a[0])
    .slice(0, limit);

  results.push('| Pokémon | Encounters | KO Rate | Switch Rate |');
  results.push('|---------|------------|---------|-------------|');

  for (const [counter, data] of counters) {
    const [encounters, koRate, switchRate] = data;
    results.push(
      `| ${counter} | ${encounters.toFixed(0)} | ${(koRate * 100).toFixed(1)}% | ${(switchRate * 100).toFixed(1)}% |`
    );
  }

  results.push('\n**Legend:**');
  results.push('- **Encounters**: Number of times faced in battle');
  results.push('- **KO Rate**: % of encounters where counter KO\'d your Pokémon');
  results.push('- **Switch Rate**: % of encounters where you switched out');

  return results.join('\n');
}

/**
 * Get metagame overview statistics
 */
export async function getMetagameStats(args: { format?: string }): Promise<string> {
  const format = args.format || 'gen9ou';

  const stats = await fetchStats(format);

  if (!stats) {
    return `No statistics found for format "${format}".`;
  }

  const results: string[] = [];
  results.push(`**Metagame Statistics for ${format.toUpperCase()}**\n`);

  // Battle info
  results.push(`**Total Battles:** ${stats.info['number of battles'].toLocaleString()}`);
  results.push(`**Cutoff Rating:** ${stats.info.cutoff}\n`);

  // Count unique Pokémon and total usage
  const pokemonCount = Object.keys(stats.data).length;
  const totalUsage = Object.values(stats.data).reduce(
    (sum, p) => sum + p['Raw count'],
    0
  );

  results.push(`**Unique Pokémon Used:** ${pokemonCount}`);
  results.push(`**Total Pokémon Counted:** ${totalUsage.toLocaleString()}\n`);

  // Top 10 most used
  results.push('**Top 10 Most Used:**');
  const top10 = Object.entries(stats.data)
    .sort(([, a], [, b]) => b.usage - a.usage)
    .slice(0, 10);

  for (const [name, data] of top10) {
    const usage = (data.usage * 100).toFixed(2);
    results.push(`${name}: ${usage}%`);
  }

  return results.join('\n');
}
