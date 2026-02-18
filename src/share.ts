import type { TeamPokemon } from "./types.js";

/** Stored representation of a shared team */
export interface SharedTeam {
    id: string;
    team: TeamPokemon[];
    format: string;
    createdAt: string;
}

const SHARE_ID_LENGTH = 8;
const SHARE_TTL_SECONDS = 365 * 24 * 60 * 60; // 1 year
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Generate a URL-safe random ID using crypto.getRandomValues
 */
export function generateShareId(length = SHARE_ID_LENGTH): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/**
 * Validate team data before storing
 */
export function validateTeamForSharing(
    team: unknown,
    format: unknown,
): { valid: true; team: TeamPokemon[]; format: string } | { valid: false; error: string } {
    if (!Array.isArray(team) || team.length === 0 || team.length > 6) {
        return { valid: false, error: "Team must have 1-6 Pokemon" };
    }

    for (const member of team) {
        if (!member || typeof member !== "object") {
            return { valid: false, error: "Invalid team member" };
        }
        if (typeof member.pokemon !== "string" || member.pokemon.trim().length === 0) {
            return { valid: false, error: "Each team member must have a pokemon name" };
        }
        if (!Array.isArray(member.moves)) {
            return { valid: false, error: "Each team member must have a moves array" };
        }
    }

    if (typeof format !== "string" || format.trim().length === 0) {
        return { valid: false, error: "Format is required" };
    }

    return { valid: true, team: team as TeamPokemon[], format: format as string };
}

/**
 * Store a shared team in KV, returning the generated ID
 */
export async function storeSharedTeam(
    kv: KVNamespace,
    team: TeamPokemon[],
    format: string,
): Promise<string> {
    // Generate ID and check for collision (extremely unlikely with 62^8 space)
    let id = generateShareId();
    let existing = await kv.get(`team:${id}`);
    if (existing) {
        id = generateShareId();
        existing = await kv.get(`team:${id}`);
        if (existing) {
            // Two collisions in a row is astronomically unlikely
            throw new Error("Failed to generate unique share ID");
        }
    }

    const sharedTeam: SharedTeam = {
        id,
        team,
        format,
        createdAt: new Date().toISOString(),
    };

    await kv.put(`team:${id}`, JSON.stringify(sharedTeam), {
        expirationTtl: SHARE_TTL_SECONDS,
    });

    return id;
}

/**
 * Retrieve a shared team from KV by ID
 */
export async function getSharedTeam(kv: KVNamespace, id: string): Promise<SharedTeam | null> {
    const data = await kv.get(`team:${id}`, "json");
    return data as SharedTeam | null;
}

/**
 * Refresh the TTL on a shared team (call in background on access)
 */
export async function refreshSharedTeamTtl(kv: KVNamespace, id: string): Promise<void> {
    const data = await kv.get(`team:${id}`);
    if (data) {
        await kv.put(`team:${id}`, data, {
            expirationTtl: SHARE_TTL_SECONDS,
        });
    }
}

/**
 * Simple IP-based rate limiting using KV
 * Returns true if the request should be allowed, false if rate limited
 */
export async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
    const key = `rate:share:${ip}`;
    const current = await kv.get(key, "json");
    const count = (current as number) || 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    await kv.put(key, JSON.stringify(count + 1), {
        expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    });

    return true;
}
