import {
    BattleStream,
    CHAMPIONS_FORMAT_ID,
    getPlayerStreams,
    RandomPlayerAI,
} from "../showdown.js";
import { type PokemonSet, toPacked } from "../team.js";

export interface GameResult {
    seed: number;
    winner: "p1" | "p2" | "tie";
    turns: number;
    p1Lead: string[];
    p2Lead: string[];
    log: string[];
}

export interface LeadStat {
    lead: string;
    games: number;
    wins: number;
}

export interface SeriesResult {
    games: number;
    p1Wins: number;
    p2Wins: number;
    ties: number;
    results: GameResult[];
    leadStats: LeadStat[];
}

/** Builds a player for one side. Receives the side's player stream and a per-game seed. */
export type PlayerFactory = (stream: unknown, seed: number) => { start(): Promise<void> | void };

export const randomPlayer: PlayerFactory = (stream, seed) =>
    new RandomPlayerAI(stream, { seed: [seed, 1, 2, 3], mega: 1 });

const LEADER_TIMEOUT_MS = 30_000;
const SWITCH_RE = /^\|switch\|(p[12])[ab]: [^|]*\|([^,|]+)/;

/**
 * Play one seeded random-policy game and return the protocol log, winner,
 * turn count and both sides' opening leads. Rejects if the sim hangs.
 */
export async function runGame(
    p1: PokemonSet[],
    p2: PokemonSet[],
    seed: number,
    makeP1: PlayerFactory = randomPlayer,
    makeP2: PlayerFactory = randomPlayer,
): Promise<GameResult> {
    const streams = getPlayerStreams(new BattleStream());
    const errors: unknown[] = [];
    const watch = (promise: Promise<void> | void) => {
        if (promise && typeof (promise as Promise<void>).then === "function") {
            (promise as Promise<void>).then(undefined, (e) => errors.push(e));
        }
    };
    watch(makeP1(streams.p1, seed).start());
    watch(makeP2(streams.p2, seed + 1000).start());
    streams.omniscient.write(
        `>start ${JSON.stringify({ formatid: CHAMPIONS_FORMAT_ID, seed: [seed, seed, seed, seed] })}\n` +
            `>player p1 ${JSON.stringify({ name: "P1", team: toPacked(p1) })}\n` +
            `>player p2 ${JSON.stringify({ name: "P2", team: toPacked(p2) })}`,
    );

    const log: string[] = [];
    let winner: GameResult["winner"] | undefined;
    let turns = 0;
    let turn = 0;
    const leads: Record<"p1" | "p2", string[]> = { p1: [], p2: [] };

    const iterator = streams.omniscient[Symbol.asyncIterator]();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("battle timed out")), LEADER_TIMEOUT_MS);
    });
    try {
        for (;;) {
            const next = await Promise.race([iterator.next(), deadline]);
            if (next.done) break;
            for (const line of String(next.value).split("\n")) {
                if (!line.trim()) continue;
                log.push(line);
                if (line.startsWith("|turn|")) {
                    turn = Number(line.slice(6)) || turn;
                    turns = Math.max(turns, turn);
                } else if (line.startsWith("|win|")) {
                    winner = line.endsWith("|P1") ? "p1" : line.endsWith("|P2") ? "p2" : "tie";
                } else if (line === "|tie") {
                    winner = "tie";
                } else if (turn <= 1) {
                    const m = SWITCH_RE.exec(line);
                    if (m && leads[m[1] as "p1" | "p2"].length < 2) {
                        leads[m[1] as "p1" | "p2"].push(m[2].trim());
                    }
                }
            }
            if (winner) break;
        }
    } catch (error) {
        if (errors.length) throw errors[0];
        throw error;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
        await iterator.return?.();
    }
    if (errors.length) throw errors[0];
    if (!winner) throw new Error(`battle ended without a result (seed ${seed})`);
    return { seed, winner, turns, p1Lead: leads.p1, p2Lead: leads.p2, log };
}

/** Play `games` sequential seeded games (seed, seed+1, ...) and tally the series. */
export async function runSeries(opts: {
    p1: PokemonSet[];
    p2: PokemonSet[];
    games: number;
    seed?: number;
    makeP1?: PlayerFactory;
    makeP2?: PlayerFactory;
}): Promise<SeriesResult> {
    const { p1, p2, games, seed = 1, makeP1, makeP2 } = opts;
    const results: GameResult[] = [];
    for (let i = 0; i < games; i++) {
        results.push(await runGame(p1, p2, seed + i, makeP1, makeP2));
    }
    const leadMap = new Map<string, LeadStat>();
    for (const r of results) {
        const lead = [...r.p1Lead].sort().join(" + ");
        const stat = leadMap.get(lead) ?? { lead, games: 0, wins: 0 };
        stat.games++;
        if (r.winner === "p1") stat.wins++;
        leadMap.set(lead, stat);
    }
    return {
        games,
        p1Wins: results.filter((r) => r.winner === "p1").length,
        p2Wins: results.filter((r) => r.winner === "p2").length,
        ties: results.filter((r) => r.winner === "tie").length,
        results,
        leadStats: [...leadMap.values()].sort(
            (a, b) => b.games - a.games || a.lead.localeCompare(b.lead),
        ),
    };
}
