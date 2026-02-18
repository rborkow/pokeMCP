import type { TeamPokemon } from "@/types/pokemon";

const API_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export interface SharedTeam {
    id: string;
    team: TeamPokemon[];
    format: string;
    createdAt: string;
}

/**
 * Create a shared team via the API, returning a short URL
 */
export async function createSharedTeam(
    team: TeamPokemon[],
    format: string,
): Promise<{ id: string; url: string }> {
    const response = await fetch(`${API_URL}/api/team/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, format }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error((error as { error?: string }).error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ id: string; url: string }>;
}

/**
 * Fetch a shared team by ID
 */
export async function fetchSharedTeam(id: string): Promise<SharedTeam | null> {
    const response = await fetch(`${API_URL}/api/team/${id}`, {
        next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
    } as RequestInit);

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Failed to fetch team: ${response.status}`);

    return response.json() as Promise<SharedTeam>;
}
