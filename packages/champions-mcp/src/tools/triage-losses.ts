import { z } from "zod";
import { HttpJev, type Jev, makeJev } from "../jev/client.js";
import { heuristicPlayer } from "../sim/heuristic-player.js";
import { runSeries } from "../sim/runner.js";
import { parseTeamInput, teamInputSchema } from "../team.js";
import type { ToolDefinition } from "./registry.js";
import { loadPool, type PoolTeam, requireSixSets } from "./simulate.js";
import { sourceLine } from "./source.js";

/** Protocol lines that carry information Jev can reason about. */
const LOG_PREFIXES = [
    "|turn|",
    "|move|",
    "|-damage|",
    "|faint|",
    "|switch|",
    "|drag|",
    "|-status|",
    "|-weather|",
    "|-fieldstart|",
    "|win|",
];

const MAX_LOG_CHARS = 4000;

/** Filter a battle log to battle events and cap its size (head kept). */
export function trimLog(log: string[]): string {
    const kept = log.filter((line) => LOG_PREFIXES.some((prefix) => line.startsWith(prefix)));
    const text = kept.join("\n");
    if (text.length <= MAX_LOG_CHARS) return text;
    return `${text.slice(0, MAX_LOG_CHARS - "...[truncated]".length - 1)}\n...[truncated]`;
}

const CAUSE_CRITERIA: Record<string, string | null> = {
    speed_control: "lost the speed race / outsped and KOed",
    lack_of_damage: "could not KO in time",
    wrong_lead: "lead pair was a bad matchup",
    hax: "crits/misses/flinches decided it",
    status_or_flinch: "paralysis, sleep, burn or flinch locked a mon",
    redirection_or_protect: "Follow Me/Rage Powder/Protect blanked key turns",
    other: null,
};

interface LossRecord {
    source: string;
    myLead: string;
    trimmedLog: string;
    cause?: string;
    causeConfidence?: number;
    avoidable?: number;
}

export interface TriageLossesArgs {
    paste?: string;
    sets?: unknown[];
    gamesPerOpponent?: number;
    seed?: number;
    maxOpponents?: number;
    maxLosses?: number;
}

export async function triageLosses(
    args: TriageLossesArgs,
    deps: { jev: Jev | null } = { jev: makeJev() },
): Promise<string> {
    const team = parseTeamInput(args);
    requireSixSets(team, "Your team");
    const pool = loadPool();
    if (!pool.length) {
        return "Opponent pool missing. Run `bun run --cwd packages/champions-mcp build-opponent-pool`.";
    }
    const gamesPerOpponent = Math.min(Math.max(1, args.gamesPerOpponent ?? 10), 200);
    const seed = args.seed ?? 1;
    const opponents: PoolTeam[] = pool.slice(0, Math.max(1, args.maxOpponents ?? 10));
    const losses: LossRecord[] = [];
    let totalGames = 0;
    for (const [i, opp] of opponents.entries()) {
        const series = await runSeries({
            p1: team,
            p2: opp.sets,
            games: gamesPerOpponent,
            seed: seed + i * 1000,
            makeP1: heuristicPlayer,
            makeP2: heuristicPlayer,
        });
        totalGames += series.games;
        for (const game of series.results) {
            if (game.winner !== "p2") continue;
            losses.push({
                source: opp.source,
                myLead: [...game.p1Lead].sort().join(" + "),
                trimmedLog: trimLog(game.log),
            });
        }
    }

    const header =
        `**Loss triage** — ${losses.length} losses in ${totalGames} heuristic-policy games ` +
        `(${opponents.length} opponents × ${gamesPerOpponent} games, seed ${seed})\n` +
        `${sourceLine("loss causes: Jev over trimmed sim logs")}`;

    if (!deps.jev) {
        return `${header}\n\n${losses.length} losses collected.\n_Jev not configured (TYPESAFE_API_KEY)_`;
    }

    const toGrade = losses.slice(0, Math.max(1, args.maxLosses ?? 20));
    let calls = 0;
    let inputTokens = 0;
    for (const loss of toGrade) {
        const answers = await deps.jev.ask(
            {
                my_team: args.paste ?? team,
                opponent: loss.source,
                my_lead: loss.myLead,
                battle_log: loss.trimmedLog,
            },
            {
                cause: {
                    type: "choice",
                    instructions:
                        "In this lost Pokémon Champions doubles game, what is the single most " +
                        "important reason my side lost?",
                    criteria: CAUSE_CRITERIA,
                },
                avoidable: {
                    type: "noul",
                    instructions:
                        "Could a different lead or first-turn choice from my side have won this game?",
                },
            },
        );
        calls++;
        const usage = deps.jev instanceof HttpJev ? deps.jev.lastUsage : undefined;
        if (usage) inputTokens += usage.input_tokens;
        const cause = answers.cause;
        if (cause?.type === "choice") {
            loss.cause = cause.choice;
            loss.causeConfidence = cause.confidence;
        }
        const avoidable = answers.avoidable;
        if (avoidable?.type === "noul") loss.avoidable = avoidable.noul;
    }

    const graded = toGrade.filter((l) => l.cause);
    const histogram = new Map<string, { count: number; confSum: number }>();
    for (const loss of graded) {
        const row = histogram.get(loss.cause as string) ?? { count: 0, confSum: 0 };
        row.count++;
        row.confSum += loss.causeConfidence ?? 0;
        histogram.set(loss.cause as string, row);
    }
    const histogramRows = [...histogram.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
        .map(
            ([cause, { count, confSum }]) =>
                `| ${cause} | ${count} | ${(confSum / count).toFixed(2)} |`,
        );
    const withAvoidable = graded.filter((l) => l.avoidable !== undefined);
    const avoidablePct = withAvoidable.length
        ? (
              (withAvoidable.reduce((a, l) => a + (l.avoidable as number), 0) /
                  withAvoidable.length) *
              100
          ).toFixed(0)
        : "n/a";
    const fixableByLead = toGrade
        .filter((l) => l.cause === "wrong_lead" && (l.avoidable ?? 0) >= 0.5)
        .sort(
            (a, b) =>
                (b.avoidable ?? 0) * (b.causeConfidence ?? 0) -
                (a.avoidable ?? 0) * (a.causeConfidence ?? 0),
        )
        .slice(0, 3);

    const lines = [
        header,
        "",
        "| cause | losses | mean confidence |",
        "|---|---|---|",
        ...(histogramRows.length ? histogramRows : ["| (none graded) | 0 | — |"]),
        "",
        `Avoidable by better lead/play: ${avoidablePct}% (mean noul over ${withAvoidable.length} graded losses)`,
        "",
        "**Most confidently fixed by a different lead:**",
        ...(fixableByLead.length
            ? fixableByLead.map(
                  (l) =>
                      `- ${l.myLead} vs ${l.source} (avoidable ${l.avoidable?.toFixed(2)}, ` +
                      `cause confidence ${(l.causeConfidence ?? 0).toFixed(2)})`,
              )
            : ["- none identified"]),
        "",
        `_${calls} Jev calls, ~${inputTokens} input tokens_`,
    ];
    return lines.join("\n");
}

export const triageLossesTool: ToolDefinition = {
    name: "triage_losses",
    description:
        "Play your team against the cached Reg M-C opponent pool, collect the losing games, and ask " +
        "Jev (TypeSafe System One) to type each loss (speed, damage, lead matchup, hax, status, " +
        "redirection) and grade whether a different lead could have avoided it. Returns a cause " +
        "histogram, avoidable percentage, and the lead fixes worth trying first." +
        " Teams are imported but not legality-checked — run validate_team first; illegal sets may mis-simulate.",
    schema: {
        ...teamInputSchema,
        gamesPerOpponent: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Games vs each opponent (default 10, cap 200)."),
        seed: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Base seed; equal seeds give equal runs."),
        maxOpponents: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Cap on pool opponents (default 10)."),
        maxLosses: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Cap on losses sent to Jev (default 20)."),
    },
    execute: (args) => triageLosses(args),
};
