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
    | { ok: false; message: string };

export function ok<T>(data: T, text: string): ToolOutcome<T> {
    return { ok: true, data, text };
}

export function fail(message: string): ToolOutcome<never> {
    return { ok: false, message };
}

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
