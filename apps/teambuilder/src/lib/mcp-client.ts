import type { TeamPokemon } from "@/types/pokemon";

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

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
  private baseUrl: string;

  constructor(baseUrl: string = MCP_URL) {
    this.baseUrl = baseUrl;
  }

  private async callTool<T = string>(tool: string, args: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}/mcp`, {
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
  return useQuery({
    queryKey: ["meta-threats", format, limit],
    queryFn: () => mcpClient.getMetaThreats(format, limit),
    enabled: !!format,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
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
