import type { z } from "zod";

/**
 * Result of one connector tool call.
 *
 * `data` is returned to the client as `structuredContent` and must satisfy the
 * tool's `outputSchema`; `text` carries the same information as Markdown for
 * clients that only read `content`. A failure is reported to the client as a
 * tool error (`isError: true`), so `message` has to tell the caller what to do
 * next — never an internal detail.
 */
export type ToolOutcome<T = Record<string, unknown>> =
    | { ok: true; data: T; text: string }
    | { ok: false; message: string; reason: FailReason };

/**
 * Why a tool call failed, recorded with usage (never the arguments). Stored
 * as a string, so add values rather than renaming them.
 *
 * - unknown_pokemon: the name matched no Pokémon, or one outside the battle data
 * - unknown_name: a move, ability, item or nature that doesn't exist
 * - invalid_input: well-formed names but impossible values (stat points)
 * - no_usage: the Pokémon exists but the format has no usage data for what was asked
 * - data_gap: the bundled game data lacks the Pokémon's stats or moves
 * - data_unavailable: stats, history or the legality list couldn't be loaded
 * - insufficient_history: too few monthly snapshots for the requested analysis
 * - exception: the tool threw
 */
export type FailReason =
    | "unknown_pokemon"
    | "unknown_name"
    | "invalid_input"
    | "no_usage"
    | "data_gap"
    | "data_unavailable"
    | "insufficient_history"
    | "exception";

export function ok<T>(data: T, text: string): ToolOutcome<T> {
    return { ok: true, data, text };
}

export function fail(message: string, reason: FailReason): ToolOutcome<never> {
    return { ok: false, message, reason };
}

/** An internal lookup that failed, with the message the caller will see and why. */
export type Failure = { ok: false; error: string; reason: FailReason };

/** A tool on the public "VGC Teambuilder" connector surface. */
export interface ConnectorTool {
    /** Model-facing identifier. Unique, verb-first, 64 characters or fewer. */
    name: string;
    /** Human-readable name shown in client UIs. */
    title: string;
    /** What the tool does, when to use it, and its limits. */
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
    outputSchema: Record<string, z.ZodTypeAny>;
    // `any`: the MCP SDK validates arguments against inputSchema before run() is called.
    run: (args: any, env: Env) => Promise<ToolOutcome> | ToolOutcome;
}

/** Round to two decimal places (usage percentages, percentage-point deltas). */
export function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

/** Usage fraction (0..1) to a percentage rounded to two decimals. */
export function toPercent(fraction: number): number {
    return round2(fraction * 100);
}
