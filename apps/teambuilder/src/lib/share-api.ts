import type { TeamPokemon } from "@/types/pokemon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.pokemcp.com";

export interface SharedTeam {
    id: string;
    team: TeamPokemon[];
    format: string;
    createdAt: string;
}

/**
 * New persistent share records were retired with the Prep launch. Existing
 * `/t/:id` records remain readable through `fetchSharedTeam`.
 */
export async function createSharedTeam(
    _team: TeamPokemon[],
    _format: string,
): Promise<{ id: string; url: string }> {
    void [_team, _format];
    throw new Error("New persistent team links are retired. Use the portable link or export instead.");
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
