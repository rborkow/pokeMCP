import { z } from "zod";
import { CURRENT_REGULATION } from "../regulation.js";
import {
    assertRuntimeStable,
    currentFingerprints,
    getRun,
    listFindings,
    listRuns,
    recordFinding,
    saveReplay,
} from "../memory.js";
import { replayStoredRun } from "./simulate.js";
import type { ToolDefinition } from "./registry.js";

const id = z.string().uuid().describe("Durable run or finding ID.");
const normalize = (v: unknown): unknown =>
    Array.isArray(v)
        ? v.map(normalize)
        : v && typeof v === "object"
          ? Object.fromEntries(
                Object.entries(v as Record<string, unknown>)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, x]) => [k, normalize(x)]),
            )
          : v;
const stable = (v: unknown) => JSON.stringify(normalize(v));
/** Showdown emits wall-clock protocol `|t:|` lines; this is the only replay normalization. */
const withoutTimestamps = (v: unknown): unknown =>
    Array.isArray(v)
        ? v.filter((x) => !(typeof x === "string" && x.startsWith("|t:|"))).map(withoutTimestamps)
        : v && typeof v === "object"
          ? Object.fromEntries(
                Object.entries(v as Record<string, unknown>).map(([k, x]) => [
                    k,
                    withoutTimestamps(x),
                ]),
            )
          : v;

export const getRunTool: ToolDefinition = {
    name: "get_run",
    description: "Retrieve an integrity-verified durable experiment run.",
    schema: { runId: id },
    execute: async ({ runId }) => JSON.stringify(getRun(runId as string), null, 2),
};
export const listRunsTool: ToolDefinition = {
    name: "list_runs",
    description: "List runs and explicitly report corrupt entries and truncation.",
    schema: { limit: z.number().int().min(1).max(200).optional() },
    execute: async ({ limit }) => JSON.stringify(listRuns(limit as number | undefined), null, 2),
};
export const replayRunTool: ToolDefinition = {
    name: "replay_run",
    description:
        "Verify compatibility, then replay a run from its immutable team/opponent snapshot.",
    schema: { runId: id },
    execute: async ({ runId }) => {
        const run = getRun(runId as string);
        const before = currentFingerprints();
        const drift = Object.entries(run.fingerprints)
            .filter(([k, v]) => k !== "opponentPool" && before[k] !== v)
            .map(([k]) => k);
        if (drift.length) {
            const evidence = {
                status: "incompatible",
                drift,
                message: "Runtime fingerprints changed; replay was not simulated.",
            };
            saveReplay(run.id, evidence);
            return JSON.stringify(evidence, null, 2);
        }
        assertRuntimeStable(before);
        const result = await replayStoredRun(run);
        assertRuntimeStable(before);
        const verified =
            stable(withoutTimestamps(result)) === stable(withoutTimestamps(run.result));
        const evidence = {
            status: verified ? "verified" : "mismatch",
            normalization: "only protocol |t:| timestamp lines removed",
            compared:
                "validated winners, turns, leads, summaries, and remaining protocol log content",
            result,
        };
        saveReplay(run.id, evidence);
        return JSON.stringify(evidence, null, 2);
    },
};
export const compareRunsTool: ToolDefinition = {
    name: "compare_runs",
    description:
        "Compare compatible runs with validated engine metrics and exact source identities.",
    schema: { leftRunId: id, rightRunId: id },
    execute: async ({ leftRunId, rightRunId }) => {
        const left = getRun(leftRunId as string),
            right = getRun(rightRunId as string);
        const reasons: string[] = [];
        if (left.kind !== right.kind) reasons.push("kind differs");
        if (left.format !== right.format) reasons.push("format differs");
        if (left.regulation.id !== right.regulation.id) reasons.push("regulation differs");
        if (stable(left.parameters) !== stable(right.parameters))
            reasons.push("resolved parameters or seeds differ");
        if (stable(left.opponents) !== stable(right.opponents))
            reasons.push("opponent snapshots/source identities differ");
        const fpKeys = Object.keys(left.fingerprints).filter((k) => k !== "opponentPool");
        if (fpKeys.some((k) => left.fingerprints[k] !== right.fingerprints[k]))
            reasons.push("engine/policy fingerprints differ");
        if (reasons.length)
            return JSON.stringify(
                { status: "incompatible", leftRunId: left.id, rightRunId: right.id, reasons },
                null,
                2,
            );
        const metrics = (r: ReturnType<typeof getRun>) =>
            r.kind === "matchup"
                ? {
                      wins: r.result.series.p1Wins,
                      games: r.result.series.games,
                      ties: r.result.series.ties,
                      winRate: r.result.series.p1Wins / r.result.series.games,
                  }
                : {
                      wins: r.result.totalWins,
                      games: r.result.totalGames,
                      winRate: r.result.totalWins / r.result.totalGames,
                  };
        const a = metrics(left),
            b = metrics(right);
        return JSON.stringify(
            {
                status: "comparable",
                leftRunId: left.id,
                rightRunId: right.id,
                left: a,
                right: b,
                deltaWinRate: b.winRate - a.winRate,
                caveat: "Heuristic simulation results are not skilled-play claims.",
            },
            null,
            2,
        );
    },
};
export const recordFindingTool: ToolDefinition = {
    name: "record_finding",
    description: "Store a regulation-scoped, evidence-backed finding in append-only revisions.",
    schema: {
        claim: z.string().min(1),
        regulation: z.string().default(CURRENT_REGULATION.id),
        evidenceRunIds: z.array(id).min(1),
        limitations: z.string().min(1),
        status: z.enum(["hypothesis", "supported", "superseded"]),
        reviseId: id.optional(),
        testOnly: z.boolean().optional(),
    },
    execute: async (args) =>
        JSON.stringify(
            {
                findingId: recordFinding({ ...(args as any), testOnly: args.testOnly ?? false }),
                status: args.status,
                warning:
                    "Stored as scoped evidence, not universal truth; heuristic results are not skilled play.",
            },
            null,
            2,
        ),
};
export const listFindingsTool: ToolDefinition = {
    name: "list_findings",
    description: "List findings with evidence drift warnings and corrupt-entry warnings.",
    schema: { regulation: z.string().optional(), includeTestOnly: z.boolean().optional() },
    execute: async ({ regulation, includeTestOnly }) =>
        JSON.stringify(
            listFindings(regulation as string | undefined, includeTestOnly as boolean | undefined),
            null,
            2,
        ),
};
