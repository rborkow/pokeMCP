import type { TeamPokemon } from "@/types/pokemon";

// Use local proxy to avoid CORS issues with MCP server
const MCP_PROXY_URL = "/api/mcp";

/**
 * Format fallback map for VGC formats that may not have stats yet.
 * Maps newer formats to the most recent format with available data.
 */
const FORMAT_FALLBACKS: Record<string, string> = {
  // VGC 2026 formats fall back to VGC 2024 Reg H (most recent with data)
  "gen9vgc2026regf": "gen9vgc2024regh",
  "gen9vgc2026regfbo3": "gen9vgc2024regh",
  // VGC 2025 formats also fall back
  "gen9vgc2025regi": "gen9vgc2024regh",
};

/**
 * Get the effective format to use for stats queries.
 * Returns the original format if it has stats, or a fallback format.
 */
export function getEffectiveStatsFormat(format: string): { format: string; isFallback: boolean } {
  const fallback = FORMAT_FALLBACKS[format.toLowerCase()];
  if (fallback) {
    return { format: fallback, isFallback: true };
  }
  return { format, isFallback: false };
}

interface MCPResponse {
  jsonrpc: string;
  id: string | number;
  result?: {
    content: { type: string; text: string }[];
  };
  error?: {
    code: number;
    message: string;
  };
}

class MCPClient {
  private proxyUrl: string;

  constructor(proxyUrl: string = MCP_PROXY_URL) {
    this.proxyUrl = proxyUrl;
  }

  private async callTool<T = string>(tool: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(this.proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: tool, arguments: args },
        id: crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const data: MCPResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.result?.content?.[0]?.text;
    if (!text) {
      throw new Error("No content in MCP response");
    }

    // Try to parse as JSON, otherwise return as string
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as T;
    }
  }

  // Pokemon lookup
  async lookupPokemon(pokemon: string, generation?: string) {
    return this.callTool("lookup_pokemon", { pokemon, generation });
  }

  // Validation
  async validateMoveset(pokemon: string, moves: string[], generation?: string) {
    return this.callTool("validate_moveset", { pokemon, moves, generation });
  }

  async validateTeam(team: TeamPokemon[], format?: string) {
    return this.callTool("validate_team", { team, format });
  }

  // Coverage analysis
  async suggestTeamCoverage(currentTeam: string[], format?: string) {
    return this.callTool("suggest_team_coverage", { current_team: currentTeam, format });
  }

  // Usage statistics
  async getPopularSets(pokemon: string, format?: string) {
    return this.callTool("get_popular_sets", { pokemon, format });
  }

  async getMetaThreats(format?: string, limit: number = 20) {
    return this.callTool("get_meta_threats", { format, limit });
  }

  async getTeammates(pokemon: string, format?: string, limit: number = 10) {
    return this.callTool("get_teammates", { pokemon, format, limit });
  }

  async getChecksCounters(pokemon: string, format?: string, limit: number = 10) {
    return this.callTool("get_checks_counters", { pokemon, format, limit });
  }

  async getMetagameStats(format?: string) {
    return this.callTool("get_metagame_stats", { format });
  }

  // RAG strategy search
  async queryStrategy(query: string, format?: string, limit: number = 5) {
    return this.callTool("query_strategy", { query, format, limit });
  }
}

// Singleton instance
export const mcpClient = new MCPClient();

// React Query hooks
import { useQuery, useMutation } from "@tanstack/react-query";

export function usePokemonLookup(pokemon: string, enabled = true) {
  return useQuery({
    queryKey: ["pokemon", pokemon],
    queryFn: () => mcpClient.lookupPokemon(pokemon),
    enabled: enabled && !!pokemon,
    staleTime: Infinity, // Pokemon data doesn't change
  });
}

export function usePopularSets(pokemon: string, format: string, enabled = true) {
  return useQuery({
    queryKey: ["popular-sets", pokemon, format],
    queryFn: () => mcpClient.getPopularSets(pokemon, format),
    enabled: enabled && !!pokemon && !!format,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useMetaThreats(format: string, limit = 20) {
  const { format: effectiveFormat, isFallback } = getEffectiveStatsFormat(format);

  const query = useQuery({
    queryKey: ["meta-threats", effectiveFormat, limit],
    queryFn: () => mcpClient.getMetaThreats(effectiveFormat, limit),
    enabled: !!format,
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return {
    ...query,
    effectiveFormat,
    isFallback,
    fallbackFrom: isFallback ? format : undefined,
  };
}

export function useTeammates(pokemon: string, format: string, limit = 10, enabled = true) {
  return useQuery({
    queryKey: ["teammates", pokemon, format, limit],
    queryFn: () => mcpClient.getTeammates(pokemon, format, limit),
    enabled: enabled && !!pokemon && !!format,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useValidateTeam() {
  return useMutation({
    mutationFn: ({ team, format }: { team: TeamPokemon[]; format: string }) =>
      mcpClient.validateTeam(team, format),
  });
}

export function useQueryStrategy() {
  return useMutation({
    mutationFn: ({ query, format, limit }: { query: string; format?: string; limit?: number }) =>
      mcpClient.queryStrategy(query, format, limit),
  });
}
