import type { TeamPokemon } from "@/types/pokemon";

// Product-facing semantic analysis endpoint. Internal service/tool names stay server-side.
const ANALYSIS_URL = "/api/analysis";

/**
 * Format fallback map for formats that have no stats data on Smogon.
 * Only includes formats that truly lack data — formats with real stats
 * (e.g., gen9vgc2026regf, gen9vgc2025regi) should NOT be listed here.
 */
const FORMAT_FALLBACKS: Record<string, string> = {
    // VGC regulation variants that Smogon doesn't track separately
    gen9vgc2026regg: "gen9vgc2026regf",
    gen9vgc2025regh: "gen9vgc2024regh",
    gen9vgc2025regg: "gen9vgc2024regh",
    // Battle Stadium formats
    gen9battlestadiumdoubles: "gen9vgc2024regh",
    gen9bsd: "gen9vgc2024regh",
};

/**
 * Get the effective format to use for stats queries.
 * Returns the original format if it has stats, or a fallback format.
 */
export function getEffectiveStatsFormat(format: string): {
    format: string;
    isFallback: boolean;
} {
    const normalized = format.toLowerCase();
    const fallback = FORMAT_FALLBACKS[normalized];
    if (fallback) {
        return { format: fallback, isFallback: true };
    }
    return { format: normalized, isFallback: false };
}

interface AnalysisResponse {
    data?: string;
    error?: string;
}

class MCPClient {
    private analysisUrl = ANALYSIS_URL;

    resetSession() {}

    private async analyze<T = string>(operation: string, input: Record<string, unknown>): Promise<T> {
        const response = await fetch(this.analysisUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operation, ...input }),
        });

        if (!response.ok) {
            throw new Error(`Analysis request failed: ${response.status} ${response.statusText}`);
        }

        const responseBody: AnalysisResponse = await response.json();
        if (responseBody.error) throw new Error(responseBody.error);
        if (!responseBody.data) throw new Error("No analysis returned");

        try {
            return JSON.parse(responseBody.data) as T;
        } catch {
            return responseBody.data as T;
        }
    }

    // Pokemon lookup
    async lookupPokemon(pokemon: string, generation?: string) {
        return this.analyze("pokemon", { pokemon, generation });
    }

    // Validation
    async validateMoveset(pokemon: string, moves: string[], generation?: string) {
        return this.analyze("moveset", { pokemon, moves, generation });
    }

    async validateTeam(team: TeamPokemon[], format?: string) {
        return this.analyze("team", { team, format });
    }

    // Coverage analysis
    async suggestTeamCoverage(currentTeam: string[], format?: string) {
        return this.analyze("coverage", {
            currentTeam,
            format,
        });
    }

    // Usage statistics (unified get_usage_stats tool)
    async getPopularSets(pokemon: string, format?: string) {
        return this.analyze("popular-sets", { pokemon, format });
    }

    async getMetaThreats(format?: string, limit = 20) {
        return this.analyze("threats", { format, limit });
    }

    async getTeammates(pokemon: string, format?: string, limit = 10) {
        return this.analyze("teammates", { pokemon, format, limit });
    }

    async getChecksCounters(pokemon: string, format?: string, limit = 10) {
        return this.analyze("counters", {
            pokemon,
            format,
            limit,
        });
    }

    async getMetagameStats(format?: string) {
        return this.analyze("metagame", { format });
    }

    // RAG strategy search
    async queryStrategy(query: string, format?: string, limit = 5) {
        return this.analyze("strategy", { query, format, limit });
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
        staleTime: Number.POSITIVE_INFINITY, // Pokemon data doesn't change
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
        mutationFn: ({
            query,
            format,
            limit,
        }: {
            query: string;
            format?: string;
            limit?: number;
        }) => mcpClient.queryStrategy(query, format, limit),
    });
}
