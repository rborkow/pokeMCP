/**
 * Pure queue/retry logic for the IngestionCoordinator Durable Object.
 *
 * Kept free of Workers runtime imports so it can be unit-tested under
 * `node --test` (see src/__tests__/ingestion-coordinator.test.ts).
 */

/** A format is retried once after its first failure, then recorded as failed. */
export const MAX_ATTEMPTS = 2;

/**
 * Max Pokemon processed in a single alarm invocation. A full format slice is
 * ~10 subrequests per Pokemon (1 Smogon fetch + 1-2 Workers AI embedding calls
 * + 1 Vectorize upsert + 1 KV put per chunk), so 50 Pokemon in one alarm could
 * approach the 1,000-subrequest cap on long analyses. 25 keeps worst-case
 * usage around half the budget.
 */
export const MAX_POKEMON_PER_ALARM = 25;

export interface QueueItem {
    format: string;
    /** Failed attempts so far for this format. */
    attempts: number;
    /**
     * Pokemon still to process in the current attempt. Undefined means the
     * attempt has not started yet (the top-Pokemon list is fetched lazily).
     */
    pendingPokemon?: string[];
    /** Counts accumulated across slices of the current attempt. */
    pokemonProcessed: number;
    chunksIndexed: number;
}

export interface FormatResult {
    format: string;
    ok: boolean;
    pokemonProcessed: number;
    chunksIndexed: number;
    /** Total attempts consumed (1 = succeeded first try). */
    attempts: number;
    error?: string;
}

export interface RunState {
    startedAt: string;
    queue: QueueItem[];
    results: FormatResult[];
}

/** Outcome of processing one slice of the queue head. */
export interface SliceResult {
    ok: boolean;
    pokemonProcessed: number;
    chunksIndexed: number;
    /** Pokemon left over after a capped slice; non-empty means requeue at head. */
    remainingPokemon?: string[];
    error?: string;
}

export interface NextStep {
    /** True when the queue is drained and the run is complete. */
    done: boolean;
    state: RunState;
}

export function createRunState(formats: string[], startedAt: string): RunState {
    return {
        startedAt,
        queue: formats.map((format) => ({
            format,
            attempts: 0,
            pokemonProcessed: 0,
            chunksIndexed: 0,
        })),
        results: [],
    };
}

/**
 * Decide what happens after processing one slice of the queue head:
 * - success with leftover Pokemon → requeue at the head with accumulated counts
 * - success with nothing left → record a successful FormatResult
 * - failure with attempts remaining → requeue at the tail with progress reset
 *   (indexing is idempotent, so the retry redoes the format from scratch)
 * - failure with no attempts remaining → record a failed FormatResult
 */
export function planNextStep(state: RunState, result: SliceResult): NextStep {
    const [current, ...rest] = state.queue;
    if (!current) {
        return { done: true, state };
    }

    const pokemonProcessed = current.pokemonProcessed + result.pokemonProcessed;
    const chunksIndexed = current.chunksIndexed + result.chunksIndexed;

    let queue = rest;
    const results = [...state.results];

    if (result.ok) {
        if (result.remainingPokemon && result.remainingPokemon.length > 0) {
            queue = [
                {
                    format: current.format,
                    attempts: current.attempts,
                    pendingPokemon: result.remainingPokemon,
                    pokemonProcessed,
                    chunksIndexed,
                },
                ...rest,
            ];
        } else {
            results.push({
                format: current.format,
                ok: true,
                pokemonProcessed,
                chunksIndexed,
                attempts: current.attempts + 1,
            });
        }
    } else {
        const attempts = current.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
            // Retry later, after the rest of the queue. Progress resets so the
            // retry re-ingests the whole format (upserts are idempotent).
            queue = [
                ...rest,
                {
                    format: current.format,
                    attempts,
                    pokemonProcessed: 0,
                    chunksIndexed: 0,
                },
            ];
        } else {
            results.push({
                format: current.format,
                ok: false,
                pokemonProcessed,
                chunksIndexed,
                attempts,
                error: result.error ?? "unknown error",
            });
        }
    }

    return {
        done: queue.length === 0,
        state: { startedAt: state.startedAt, queue, results },
    };
}

export interface RunSummary {
    startedAt: string;
    formats: number;
    succeeded: number;
    failed: number;
    pokemonProcessed: number;
    chunksIndexed: number;
    failures: { format: string; error?: string }[];
}

export function summarizeRun(state: RunState): RunSummary {
    const succeeded = state.results.filter((r) => r.ok);
    const failed = state.results.filter((r) => !r.ok);
    return {
        startedAt: state.startedAt,
        formats: state.results.length,
        succeeded: succeeded.length,
        failed: failed.length,
        pokemonProcessed: state.results.reduce((sum, r) => sum + r.pokemonProcessed, 0),
        chunksIndexed: state.results.reduce((sum, r) => sum + r.chunksIndexed, 0),
        failures: failed.map((r) => ({ format: r.format, error: r.error })),
    };
}
