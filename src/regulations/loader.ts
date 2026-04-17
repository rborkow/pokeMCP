import { toID } from "../data-loader.js";
import { getRegulation } from "./registry.js";
import type { LegalityKvBlob, LoadedRegulation, RegulationSet } from "./types.js";

/**
 * Thrown when a regulation's dynamic legality data is missing or malformed in
 * KV. Surfacing this as an error (rather than silently falling back to an
 * empty allow-list) is intentional: an empty list would make every team
 * "valid", which is the opposite of what the validator is for.
 */
export class LegalityNotIngestedError extends Error {
    constructor(regulationId: string, cause?: unknown) {
        super(
            `Legality data for regulation "${regulationId}" is not available in KV. ` +
                "Run scripts/fetch-champions-legality.ts to ingest it.",
        );
        this.name = "LegalityNotIngestedError";
        if (cause) (this as { cause?: unknown }).cause = cause;
    }
}

function isLegalityKvBlob(v: unknown): v is LegalityKvBlob {
    if (!v || typeof v !== "object") return false;
    const b = v as Record<string, unknown>;
    return (
        typeof b.regulationId === "string" &&
        typeof b.fetchedAt === "string" &&
        typeof b.sourceUrl === "string" &&
        typeof b.version === "number" &&
        Array.isArray(b.pokemon) &&
        b.pokemon.every((p) => typeof p === "string")
    );
}

/**
 * Load a regulation by id, hydrating the dynamic allow-list from KV.
 *
 * Throws LegalityNotIngestedError when the KV data is missing or malformed.
 * Callers should catch this and surface a clear error message so teams are
 * never silently passed through.
 */
export async function loadRegulation(
    regulation: RegulationSet | string,
    env: Env,
): Promise<LoadedRegulation> {
    const reg = typeof regulation === "string" ? getRegulation(regulation) : regulation;
    if (!reg) {
        throw new Error(`Unknown regulation id: ${regulation}`);
    }

    let blob: unknown;
    try {
        blob = await env.POKEMON_STATS.get(reg.legalityKvKey, "json");
    } catch (e) {
        throw new LegalityNotIngestedError(reg.id, e);
    }

    if (!isLegalityKvBlob(blob)) {
        throw new LegalityNotIngestedError(reg.id);
    }

    const allowedPokemonIds = new Set(blob.pokemon.map((p) => toID(p)));

    return {
        ...reg,
        allowedPokemonIds,
        allowedPokemonDisplay: blob.pokemon,
        fetchedAt: blob.fetchedAt,
        dataVersion: blob.version,
    };
}
