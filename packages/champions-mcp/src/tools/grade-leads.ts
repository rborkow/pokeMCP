import { z } from "zod";
import { HttpJev, type Jev, makeJev, type Question } from "../jev/client.js";
import { championsDex } from "../showdown.js";
import { heuristicSamplingPlayer } from "../sim/heuristic-player.js";
import { runSeries, type SeriesResult } from "../sim/runner.js";
import { type PokemonSet, parseTeamInput, teamInputSchema } from "../team.js";
import type { ToolDefinition } from "./registry.js";
import { requireSixSets } from "./simulate.js";
import { sourceLine } from "./source.js";

const REGULATION_NOTE = "Champions Reg M-C doubles, bring 4 of 6";

/** Alphabetical "A + B" key, matching the runner's leadStats key format. */
function leadKey(a: PokemonSet, b: PokemonSet): string {
    return [a.species, b.species].sort((x, y) => x.localeCompare(y)).join(" + ");
}

function setSummary(set: PokemonSet): string {
    const item = set.item ? ` @ ${set.item}` : "";
    const moves = set.moves.length ? set.moves.join(" / ") : "no moves listed";
    return `${set.species}${item}, ${set.ability ?? "unknown ability"}, ${moves}`;
}

/** All C(6,2) unordered lead pairs, keyed and summarised for the Jev choice. */
function leadPairs(team: PokemonSet[]): { key: string; description: string }[] {
    const pairs: { key: string; description: string }[] = [];
    for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
            pairs.push({
                key: leadKey(team[i], team[j]),
                description: `${setSummary(team[i])} + ${setSummary(team[j])}`,
            });
        }
    }
    return pairs;
}

function megaHolders(team: PokemonSet[]): PokemonSet[] {
    return team.filter((set) => set.item && championsDex.items.get(set.item)?.megaStone);
}

interface SimLeadRow {
    lead: string;
    games: number;
    wins: number;
}

function simRows(pairs: { key: string }[], series: SeriesResult): SimLeadRow[] {
    const stats = new Map(series.leadStats.map((l) => [l.lead, l]));
    return pairs.map(({ key }) => {
        const stat = stats.get(key);
        return { lead: key, games: stat?.games ?? 0, wins: stat?.wins ?? 0 };
    });
}

function bestSimLead(rows: SimLeadRow[]): SimLeadRow | undefined {
    const sampled = rows.filter((r) => r.games > 0);
    if (!sampled.length) return undefined;
    return sampled.sort(
        (a, b) => b.wins / b.games - a.wins / a.games || a.lead.localeCompare(b.lead),
    )[0];
}

export interface GradeLeadsArgs {
    paste?: string;
    sets?: unknown[];
    opponentPaste?: string;
    opponentSets?: unknown[];
    games?: number;
    seed?: number;
}

export async function gradeLeads(
    args: GradeLeadsArgs,
    deps: { jev: Jev | null } = { jev: makeJev() },
): Promise<string> {
    const team = parseTeamInput(args);
    const opponent = parseTeamInput({ paste: args.opponentPaste, sets: args.opponentSets });
    requireSixSets(team, "Your team");
    requireSixSets(opponent, "The opponent team");
    const games = Math.min(Math.max(1, args.games ?? 60), 500);
    const seed = args.seed ?? 1;
    // Sampling policy on BOTH sides: real opponents vary their leads too, and
    // the grade table only means anything if my 15 pairs actually get played.
    const series = await runSeries({
        p1: team,
        p2: opponent,
        games,
        seed,
        makeP1: heuristicSamplingPlayer,
        makeP2: heuristicSamplingPlayer,
    });
    const pairs = leadPairs(team);
    const rows = simRows(pairs, series);
    const sampledPairs = rows.filter((r) => r.games > 0).length;
    const best = bestSimLead(rows);
    const bestLine = best ? `Sim best: ${best.lead} (${best.wins}/${best.games})` : "Sim best: n/a";
    const coverageLine = `Lead coverage: ${sampledPairs}/${rows.length} pairs sampled`;

    const questions: Record<string, Question> = {
        lead: {
            type: "choice",
            instructions:
                "Which opening lead of my 6 (first two Pokémon sent out in doubles) is most likely " +
                `to win the game? ${REGULATION_NOTE}.`,
            criteria: Object.fromEntries(pairs.map((p) => [p.key, p.description])),
        },
    };
    const megas = megaHolders(team);
    if (megas.length) {
        questions.bring_mega = {
            type: "noul",
            instructions:
                `Should the Mega Evolution user (${megas.map((m) => m.species).join(", ")}) be ` +
                "among the 4 Pokémon brought to the match?",
        };
    }

    let table: string[];
    const lines: string[] = [];
    let jevPick: string | undefined;
    if (deps.jev) {
        const state = {
            my_team: args.paste ?? team,
            opponent_team: args.opponentPaste ?? opponent,
            sim_lead_winrates: rows,
            regulation: REGULATION_NOTE,
        };
        const answers = await deps.jev.ask(state, questions);
        const leadAnswer = answers.lead;
        if (leadAnswer?.type === "choice") {
            jevPick = leadAnswer.choice;
        }
        const probabilities = leadAnswer?.type === "choice" ? leadAnswer.probabilities : undefined;
        table = rows.map((r) => {
            const p = probabilities?.[r.lead] ?? (r.lead === jevPick ? 1 : 0);
            return `| ${r.lead} | ${r.wins}/${r.games} | ${p.toFixed(2)} |`;
        });
        lines.push(
            `**Lead grades** — ${games} heuristic-policy games, seed ${seed}, sim + Jev ranked over all 15 pairs`,
            `${sourceLine("lead grades: sim (heuristic) + Jev " + (process.env.JEV_MODEL ?? "jev-latest"))}`,
            "",
            "| lead | sim wins/games | Jev p |",
            "|---|---|---|",
            ...table,
            "",
            coverageLine,
        );
        if (leadAnswer?.type === "choice") {
            lines.push(
                `Jev pick: ${leadAnswer.choice} (confidence ${leadAnswer.confidence.toFixed(2)})`,
            );
        }
        lines.push(bestLine);
        const megaAnswer = answers.bring_mega;
        if (megaAnswer?.type === "noul") {
            lines.push(`Bring Mega: ${megaAnswer.noul.toFixed(2)}`);
        }
        if (jevPick && best) {
            lines.push(`Disagreement: ${jevPick === best.lead ? "no" : "yes"}`);
        }
        const usage = deps.jev instanceof HttpJev ? deps.jev.lastUsage : undefined;
        if (usage) {
            lines.push(
                `_Jev usage: ${usage.input_tokens} input / ${usage.output_tokens} output tokens_`,
            );
        }
    } else {
        table = rows.map((r) => `| ${r.lead} | ${r.wins}/${r.games} | — |`);
        lines.push(
            `**Lead grades** — ${games} heuristic-policy games, seed ${seed}, sim only`,
            `${sourceLine("lead grades: sim (heuristic) only")}`,
            "",
            "| lead | sim wins/games | Jev p |",
            "|---|---|---|",
            ...table,
            "",
            coverageLine,
            bestLine,
            "_Jev not configured (TYPESAFE_API_KEY)_",
        );
    }
    return lines.join("\n");
}

export const gradeLeadsTool: ToolDefinition = {
    name: "grade_leads",
    description:
        "Rank all 15 possible opening leads of your 6 with two graders: a heuristic-policy sim " +
        "(sampling a random bring/lead each game) against one opponent team and Jev (TypeSafe " +
        "System One) reasoning over the team + sim " +
        "winrates. Reports Jev's pick, the sim's best lead, whether they disagree, and whether to " +
        "bring the Mega." +
        " Teams are imported but not legality-checked — run validate_team first; illegal sets may mis-simulate.",
    schema: {
        ...teamInputSchema,
        opponentPaste: z.string().optional().describe("Showdown paste of the opponent team."),
        opponentSets: z.array(z.any()).optional().describe("Structured sets of the opponent team."),
        games: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Sim games to run for the lead winrates (default 60, cap 500)."),
        seed: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Base seed; equal seeds give equal runs."),
    },
    execute: (args) => gradeLeads(args),
};
