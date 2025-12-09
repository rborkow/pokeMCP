import type { SearchResult, RankedResult, QueryOptions } from './types.js';

/**
 * Rerank search results with metadata boosts and diversity
 */
export function rerankResults(
  results: SearchResult[],
  options: QueryOptions
): RankedResult[] {
  console.log(`Reranking ${results.length} results`);

  // Step 1: Apply metadata boosts
  const boosted = results.map(result => applyBoosts(result, options));

  // Step 2: Apply diversity penalty (penalize duplicate Pokemon)
  const diverse = applyDiversityPenalty(boosted);

  // Step 3: Sort by final score
  diverse.sort((a, b) => b.finalScore - a.finalScore);

  // Step 4: Limit to requested count
  const limited = diverse.slice(0, options.limit || 5);

  console.log(`Reranked to ${limited.length} results`);
  return limited;
}

/**
 * Apply metadata-based score boosts
 */
function applyBoosts(result: SearchResult, options: QueryOptions): RankedResult {
  const boosts: RankedResult['boosts'] = {};
  let finalScore = result.score;

  // Boost for format match
  if (options.format && result.metadata.format === options.format) {
    boosts.formatMatch = 0.1;
    finalScore += 0.1;
  }

  // Boost for Pokemon match
  if (options.pokemon && result.metadata.pokemon.toLowerCase() === options.pokemon.toLowerCase()) {
    boosts.pokemonMatch = 0.05;
    finalScore += 0.05;
  }

  // Boost for recency (documents from last 30 days)
  const age = Date.now() - new Date(result.metadata.timestamp).getTime();
  const daysOld = age / (1000 * 60 * 60 * 24);
  if (daysOld < 30) {
    const recencyBoost = 0.02 * (1 - daysOld / 30);
    boosts.recency = recencyBoost;
    finalScore += recencyBoost;
  }

  return {
    ...result,
    finalScore,
    boosts
  };
}

/**
 * Apply diversity penalty to avoid too many results from same Pokemon
 */
function applyDiversityPenalty(results: RankedResult[]): RankedResult[] {
  const pokemonCount: Record<string, number> = {};

  return results.map(result => {
    const pokemon = result.metadata.pokemon.toLowerCase();
    const count = pokemonCount[pokemon] || 0;

    // Apply penalty for duplicate Pokemon (diminishing returns)
    if (count > 0) {
      const penalty = 0.05 * count; // -5% per duplicate
      result.finalScore = Math.max(0, result.finalScore - penalty);
    }

    pokemonCount[pokemon] = count + 1;
    return result;
  });
}

/**
 * Filter results by minimum score threshold
 */
export function filterByScore(
  results: RankedResult[],
  minScore: number = 0.5
): RankedResult[] {
  return results.filter(r => r.finalScore >= minScore);
}
