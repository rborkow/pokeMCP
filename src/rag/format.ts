import type { RankedResult, FormattedResult, QueryResponse } from './types.js';

/**
 * Format search results for MCP tool output
 */
export function formatResults(
  results: RankedResult[],
  query: string,
  processingTimeMs: number
): QueryResponse {
  return {
    results: results.map(formatResult),
    query,
    totalResults: results.length,
    processingTimeMs
  };
}

/**
 * Format a single result
 */
function formatResult(result: RankedResult): FormattedResult {
  return {
    pokemon: capitalizeWords(result.metadata.pokemon),
    format: result.metadata.format.toUpperCase(),
    sectionType: result.metadata.section_type,
    setName: result.metadata.set_name,
    content: cleanContent(result.content),
    sourceUrl: result.metadata.source_url,
    relevanceScore: Math.round(result.finalScore * 100) / 100
  };
}

/**
 * Clean content for display
 */
function cleanContent(content: string): string {
  // Trim whitespace
  let cleaned = content.trim();

  // Limit length if too long (keep first 1000 chars)
  if (cleaned.length > 1000) {
    cleaned = cleaned.substring(0, 1000) + '...';
  }

  return cleaned;
}

/**
 * Capitalize each word (for Pokemon names)
 */
function capitalizeWords(text: string): string {
  return text
    .split(/[-\s]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('-');
}

/**
 * Format results as human-readable text
 */
export function formatAsText(response: QueryResponse): string {
  if (response.results.length === 0) {
    return `No results found for query: "${response.query}"`;
  }

  const lines: string[] = [
    `Found ${response.results.length} result(s) for: "${response.query}"`,
    `Processing time: ${response.processingTimeMs}ms`,
    ''
  ];

  response.results.forEach((result, index) => {
    lines.push(`--- Result ${index + 1} (Relevance: ${result.relevanceScore}) ---`);
    lines.push(`Pokemon: ${result.pokemon}`);
    lines.push(`Format: ${result.format}`);
    lines.push(`Section: ${result.sectionType}${result.setName ? ` - ${result.setName}` : ''}`);
    lines.push('');
    lines.push(result.content);
    lines.push('');
    lines.push(`Source: ${result.sourceUrl}`);
    lines.push('');
  });

  return lines.join('\n');
}
