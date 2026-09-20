import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { heuristicPlayer, heuristicSamplingPlayer } from "../sim/heuristic-player.js";
import { type PlayerFactory, randomPlayer, runSeries, type SeriesResult } from "../sim/runner.js";
import { type PokemonSet, parseTeamInput, setSchema, teamInputSchema } from "../team.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";
import { assertRuntimeStable, currentFingerprints, saveRun } from "../memory.js";
import { CHAMPIONS_FORMAT_ID } from "../showdown.js";
import { CURRENT_REGULATION } from "../regulation.js";
import type { RunArtifact } from "../memory.js";

const here = dirname(fileURLToPath(import.meta.url));
export const POOL_PATH = join(here, "..", "..", "data", "opponents", "regmc.json");

export interface PoolTeam {
    source: string;
    sets: PokemonSet[];
}

/**
 * Load the built opponent pool; [] when absent. Sets are re-validated with
 * `setSchema` so a corrupt pool file fails loudly instead of crashing a sim.
 */
export function loadPool(path = POOL_PATH): PoolTeam[] {
    if (!existsSync(path)) return [];
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(path, "utf-8"));
    } catch (error) {
        throw new Error(`Opponent pool ${path} is not valid JSON`, { cause: error });
    }
    if (!Array.isArray(raw)) throw new Error(`Opponent pool ${path} must be an array`);
    return raw.map((entry, i) => {
        const e = entry as { source?: unknown; sets?: unknown };
        if (!Array.isArray(e?.sets)) {
            throw new Error(`Opponent pool entry ${i} ("${String(e?.source)}") has no sets array`);
        }
        return {
            source: String(e.source ?? `pool entry ${i}`),
            sets: e.sets.map((s) => setSchema.parse(s)),
        };
    });
}

const CAVEATS: Record<SimPolicy, string> = {
    heuristic:
        "_Caveat: players follow a heuristic policy (greedy damage/Protect/Fake Out heuristics, no prediction). " +
        "Team preview is fixed: slots 1–4, lead 1+2, so edits to Pokémon in slots 5–6 never move this number._",
    "heuristic-sample":
        "_Caveat: players follow a heuristic policy (greedy damage/Protect/Fake Out heuristics, no prediction). " +
        "Each game samples a random bring/lead (seeded), so every slot is exercised and single-set edits " +
        "move the number; use policy=heuristic for the fixed slots-1–4 bring._",
    random: "_Caveat: both sides pick random legal actions. This measures raw-number robustness and lead viability, not skilled play._",
};

const POLICY_FACTORIES: Record<SimPolicy, PlayerFactory> = {
    heuristic: heuristicPlayer,
    "heuristic-sample": heuristicSamplingPlayer,
    random: randomPlayer,
};

type SimPolicy = "heuristic" | "heuristic-sample" | "random";

/** Sampling bring/lead by default so every slot is exercised in the A/B harness. */
const DEFAULT_POLICY: SimPolicy = "heuristic-sample";

/** Appended to both sim tool descriptions: the sim performs no legality validation. */
const SIM_LEGALITY_CAVEAT =
    " Teams are imported but not legality-checked — run validate_team first; illegal sets may mis-simulate.";

function factoryFor(policy: SimPolicy | undefined): PlayerFactory {
    return POLICY_FACTORIES[policy ?? "heuristic-sample"];
}

/** Replay deliberately consumes a stored opponent snapshot, never the mutable pool. */
export async function replayStoredRun(run: RunArtifact): Promise<unknown> {
    const factory = factoryFor(run.parameters.policy as SimPolicy);
    const records = [];
    for (const opponent of run.opponents) {
        const games =
            run.kind === "evaluation" ? run.parameters.gamesPerOpponent! : run.parameters.games;
        const series = await runSeries({
            p1: run.team,
            p2: opponent.sets,
            games,
            seed: opponent.seed,
            makeP1: factory,
            makeP2: factory,
        });
        records.push({ source: opponent.source, wins: series.p1Wins, games: series.games, series });
    }
    if (run.kind === "matchup") return { series: records[0]?.series };
    return {
        records,
        totalGames: records.reduce((n, x) => n + x.games, 0),
        totalWins: records.reduce((n, x) => n + x.wins, 0),
    };
}

/**
 * The sim layer has no legality checks: a team with fewer than 6 Pokémon
 * dies mid-battle with an opaque internal error, so fail at the tool edge.
 * Run-shape only — species/moves/Stat-Points legality is `validate_team`'s job.
 */
export function requireSixSets(team: PokemonSet[], label: string): void {
    if (team.length !== 6) {
        throw new Error(
            `${label} must have exactly 6 Pokémon (got ${team.length}). Run validate_team first.`,
        );
    }
}

function summarize(series: SeriesResult): string {
    const wins = series.p1Wins;
    const pct = Math.round((wins / series.games) * 100);
    const avgTurns = (series.results.reduce((a, r) => a + r.turns, 0) / series.games).toFixed(1);
    return `Win rate: ${wins}/${series.games} (${pct}%), ties ${series.ties}, avg turns ${avgTurns}`;
}

function leadLines(series: SeriesResult): string {
    if (!series.leadStats.length) return "";
    const top = series.leadStats.slice(0, 6);
    return `\n**Leads (yours):**\n${top.map((l) => `- ${l.lead}: ${l.wins}/${l.games}`).join("\n")}`;
}

export async function simulateMatchup(args: {
    paste?: string;
    sets?: unknown[];
    opponentPaste?: string;
    opponentSets?: unknown[];
    games?: number;
    seed?: number;
    policy?: SimPolicy;
}): Promise<string> {
    const team = parseTeamInput(args);
    const opponent = parseTeamInput({ paste: args.opponentPaste, sets: args.opponentSets });
    requireSixSets(team, "Your team");
    requireSixSets(opponent, "The opponent team");
    const games = Math.min(Math.max(1, args.games ?? 50), 500);
    const seed = args.seed ?? 1;
    const policy: SimPolicy = args.policy ?? DEFAULT_POLICY;
    const factory = factoryFor(policy);
    const fingerprints = currentFingerprints();
    assertRuntimeStable(fingerprints);
    const series = await runSeries({
        p1: team,
        p2: opponent,
        games,
        seed,
        makeP1: factory,
        makeP2: factory,
    });
    assertRuntimeStable(fingerprints);
    const runId = saveRun({
        kind: "matchup",
        regulation: CURRENT_REGULATION,
        format: CHAMPIONS_FORMAT_ID,
        parameters: { games, seed, policy },
        team,
        opponents: [{ source: "explicit matchup input", sets: opponent, seed }],
        result: { series },
        rawInput: args,
        fingerprints,
    });
    return (
        `**Matchup sim** — ${games} games, seed ${seed}, ${policy}-policy players (see caveat)\n` +
        `${sourceLine()}\n\n` +
        `${summarize(series)}${leadLines(series)}\n\nRun ID: \`${runId}\`\n\n${CAVEATS[policy]}`
    );
}

interface OpponentRecord {
    source: string;
    wins: number;
    games: number;
    series: SeriesResult;
}

export async function evaluateTeam(args: {
    paste?: string;
    sets?: unknown[];
    gamesPerOpponent?: number;
    seed?: number;
    maxOpponents?: number;
    policy?: SimPolicy;
}): Promise<string> {
    const team = parseTeamInput(args);
    requireSixSets(team, "Your team");
    const pool = loadPool();
    if (!pool.length) {
        return "Opponent pool missing. Run `bun run --cwd packages/champions-mcp build-opponent-pool`.";
    }
    const gamesPerOpponent = Math.min(Math.max(1, args.gamesPerOpponent ?? 20), 200);
    const seed = args.seed ?? 1;
    const policy: SimPolicy = args.policy ?? DEFAULT_POLICY;
    const factory = factoryFor(policy);
    const fingerprints = currentFingerprints(pool);
    assertRuntimeStable(fingerprints);
    const opponents = pool.slice(0, Math.max(1, args.maxOpponents ?? 20));
    const records: OpponentRecord[] = [];
    for (const [i, opp] of opponents.entries()) {
        const series = await runSeries({
            p1: team,
            p2: opp.sets,
            games: gamesPerOpponent,
            seed: seed + i * 1000,
            makeP1: factory,
            makeP2: factory,
        });
        records.push({ source: opp.source, wins: series.p1Wins, games: series.games, series });
    }
    assertRuntimeStable(fingerprints);
    const totalGames = records.reduce((a, r) => a + r.games, 0);
    const totalWins = records.reduce((a, r) => a + r.wins, 0);
    const byHardest = [...records].sort(
        (a, b) => a.wins / a.games - b.wins / b.games || a.source.localeCompare(b.source),
    );
    const header = `**Team evaluation** — ${records.length} opponents × ${gamesPerOpponent} games, seed ${seed}, ${policy}-policy players`;
    const hardest = byHardest
        .slice(0, 5)
        .map((r) => `- ${r.wins}/${r.games} vs ${r.source}`)
        .join("\n");
    const easiest = byHardest
        .slice(-3)
        .reverse()
        .map((r) => `- ${r.wins}/${r.games} vs ${r.source}`)
        .join("\n");
    const runId = saveRun({
        kind: "evaluation",
        regulation: CURRENT_REGULATION,
        format: CHAMPIONS_FORMAT_ID,
        parameters: { games: totalGames, gamesPerOpponent, seed, policy },
        team,
        opponents: opponents.map((opp, i) => ({
            source: opp.source,
            sets: opp.sets,
            seed: seed + i * 1000,
        })),
        result: { records, totalGames, totalWins },
        rawInput: args,
        fingerprints,
    });
    return (
        `${header}\n${sourceLine("opponents from data/opponents/regmc.json (Limitless top cuts + ladder-imputed spreads)")}\n\n` +
        `Overall: ${totalWins}/${totalGames} (${Math.round((totalWins / totalGames) * 100)}%)\n\n` +
        `**Hardest opponents:**\n${hardest}\n\n` +
        `**Easiest:**\n${easiest}\n\n` +
        `Run ID: \`${runId}\`\n\n${CAVEATS[policy]}\nCompare runs with the same seed and pool when A/B-ing a change.`
    );
}

const gamesSchema = z.number().int().min(1).optional().describe("Games to play (cap 500).");
const seedSchema = z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Base seed; equal seeds give equal runs.");
const policySchema = z
    .enum(["random", "heuristic", "heuristic-sample"])
    .optional()
    .describe(
        "Action policy for both sides (default heuristic-sample). heuristic-sample = greedy damage + " +
            "Protect/Fake Out heuristics with a seeded random bring/lead sampled per game, so all six " +
            "slots are exercised; heuristic = the same scoring with the fixed slots-1–4 bring; " +
            "random = random legal actions.",
    );

export const simulateMatchupTool: ToolDefinition = {
    name: "simulate_matchup",
    description:
        "Simulate your team vs one opponent team in the Champions Reg M-C sim (heuristic players with a " +
        "seeded random bring/lead sampled per game by default) and report win rate, ties, average turns, " +
        "and your best opening leads." +
        SIM_LEGALITY_CAVEAT,
    schema: {
        ...teamInputSchema,
        opponentPaste: z.string().optional().describe("Showdown paste of the opponent team."),
        opponentSets: z.array(z.any()).optional().describe("Structured sets of the opponent team."),
        games: gamesSchema,
        seed: seedSchema,
        policy: policySchema,
    },
    execute: (args) => simulateMatchup(args),
};

export const evaluateTeamTool: ToolDefinition = {
    name: "evaluate_team",
    description:
        "Evaluate your team against the cached Reg M-C tournament opponent pool (top-cut teams with " +
        "ladder-imputed Stat Points) and rank opponents by loss rate. Each game samples a random " +
        "bring/lead (seeded), so every slot is exercised and single-set edits move the number; use " +
        "policy=heuristic for the fixed slots-1–4 bring." +
        SIM_LEGALITY_CAVEAT,
    schema: {
        ...teamInputSchema,
        gamesPerOpponent: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Games vs each opponent (cap 200)."),
        seed: seedSchema,
        maxOpponents: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Cap on pool opponents (default 20)."),
        policy: policySchema,
    },
    execute: (args) => evaluateTeam(args),
};
