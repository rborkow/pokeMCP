import { DurableObject } from "cloudflare:workers";
import type { QueueItem, RunState, SliceResult } from "./coordinator-state.js";
import {
    createRunState,
    MAX_POKEMON_PER_ALARM,
    planNextStep,
    summarizeRun,
} from "./coordinator-state.js";
import { getTopPokemon, ingestFormat } from "./orchestrator.js";

const STATE_KEY = "ingestion-run";

/** Spacing between alarms, so consecutive formats don't hammer Smogon. */
const ALARM_SPACING_MS = 10_000;

/**
 * Durable Object that drives the weekly RAG ingestion as an alarm chain,
 * one format slice per alarm. The cron trigger only seeds the queue; each
 * alarm invocation gets a fresh subrequest/CPU budget, so the run can span
 * far more work than a single scheduled() invocation ever could.
 *
 * State machine lives in coordinator-state.ts (pure, unit-tested); this class
 * only wires it to DO storage, alarms, and the per-format ingestion.
 */
export class IngestionCoordinator extends DurableObject<Env> {
    /**
     * Start a new ingestion run. Called from scheduled() via RPC.
     * A leftover queue from a previous run is replaced — with a weekly
     * cadence, pending work from last week means that run stalled.
     */
    async seed(formats: string[]): Promise<void> {
        const existing = await this.ctx.storage.get<RunState>(STATE_KEY);
        if (existing && existing.queue.length > 0) {
            console.warn(
                `[IngestionCoordinator] Replacing stalled run from ${existing.startedAt} ` +
                    `(${existing.queue.length} formats were still pending)`,
            );
        }

        const state = createRunState(formats, new Date().toISOString());
        await this.ctx.storage.put(STATE_KEY, state);
        await this.ctx.storage.setAlarm(Date.now());
        console.log(
            `[IngestionCoordinator] Seeded run with ${formats.length} formats: ${formats.join(", ")}`,
        );
    }

    /**
     * Process one slice of the queue head, then chain the next alarm.
     * Per-format failures are captured in the slice result (never thrown),
     * so alarm() only throws on unexpected storage errors — where the DO
     * runtime's automatic alarm retry is exactly what we want.
     */
    async alarm(): Promise<void> {
        const state = await this.ctx.storage.get<RunState>(STATE_KEY);
        if (!state || state.queue.length === 0) {
            console.warn("[IngestionCoordinator] Alarm fired with no pending work — ignoring");
            return;
        }

        const result = await this.runSlice(state.queue[0]);
        const next = planNextStep(state, result);
        await this.ctx.storage.put(STATE_KEY, next.state);

        if (next.done) {
            this.logCompletion(next.state);
        } else {
            await this.ctx.storage.setAlarm(Date.now() + ALARM_SPACING_MS);
        }
    }

    /** Ingest up to MAX_POKEMON_PER_ALARM Pokemon of the given format. Never throws. */
    private async runSlice(item: QueueItem): Promise<SliceResult> {
        try {
            const pokemon = item.pendingPokemon ?? (await getTopPokemon(item.format, this.env));
            const slice = pokemon.slice(0, MAX_POKEMON_PER_ALARM);
            const remaining = pokemon.slice(MAX_POKEMON_PER_ALARM);

            console.log(
                `[IngestionCoordinator] ${item.format}: processing ${slice.length} Pokemon ` +
                    `(attempt ${item.attempts + 1}, ${remaining.length} deferred to next alarm)`,
            );

            const counts = await ingestFormat(item.format, slice, this.env);
            return { ok: true, ...counts, remainingPokemon: remaining };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(
                `[IngestionCoordinator] ${item.format} failed (attempt ${item.attempts + 1}):`,
                error,
            );
            return { ok: false, pokemonProcessed: 0, chunksIndexed: 0, error: message };
        }
    }

    /** Log a run summary (visible in wrangler tail) and record it in Analytics Engine. */
    private logCompletion(state: RunState): void {
        const summary = summarizeRun(state);
        console.log(
            `[IngestionCoordinator] Run complete: ${summary.succeeded}/${summary.formats} formats ` +
                `succeeded, ${summary.pokemonProcessed} Pokemon processed, ` +
                `${summary.chunksIndexed} chunks indexed (started ${summary.startedAt})`,
        );
        for (const result of state.results) {
            console.log(
                `[IngestionCoordinator]   ${result.format}: ${result.ok ? "ok" : "FAILED"} — ` +
                    `${result.pokemonProcessed} Pokemon, ${result.chunksIndexed} chunks, ` +
                    `${result.attempts} attempt(s)${result.error ? ` — ${result.error}` : ""}`,
            );
        }
        if (summary.failed > 0) {
            console.error(
                `[IngestionCoordinator] ${summary.failed} format(s) failed after retries: ` +
                    summary.failures.map((f) => `${f.format} (${f.error})`).join("; "),
            );
        }

        // Mirror analytics.ts: fire-and-forget datapoint, skip if binding missing.
        if (!this.env.ANALYTICS) {
            console.warn("[IngestionCoordinator] SKIP ingestion_run: ANALYTICS binding missing");
            return;
        }
        this.env.ANALYTICS.writeDataPoint({
            indexes: ["ingestion_run"],
            blobs: [summary.startedAt, summary.failures.map((f) => f.format).join(",")],
            doubles: [
                summary.formats,
                summary.succeeded,
                summary.failed,
                summary.pokemonProcessed,
                summary.chunksIndexed,
            ],
        });
    }
}
