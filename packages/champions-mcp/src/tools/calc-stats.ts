import { z } from "zod";
import { championsDex } from "../showdown.js";
import { assertNature, championsStats, STAT_KEYS, type StatPoints } from "../stats.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

export async function calcStats(args: {
    pokemon: string;
    statPoints?: StatPoints;
    nature?: string;
}): Promise<string> {
    const species = championsDex.species.get(args.pokemon);
    if (!species.exists) return `Unknown Pokémon: ${args.pokemon}`;
    const nature = args.nature ?? "Hardy";
    try {
        assertNature(nature);
    } catch (error) {
        return (error as Error).message;
    }
    const stats = championsStats(species.baseStats, args.statPoints ?? {}, nature);
    const sp = STAT_KEYS.map((k) => `${args.statPoints?.[k] ?? 0} ${k}`).join(" / ");
    return [
        `**${species.name}** @ L50, ${nature}, SP ${sp}`,
        sourceLine("stat formula from @smogon/calc gen 0"),
        STAT_KEYS.map((k) => `${k.toUpperCase()}: ${stats[k]}`).join(" | "),
    ].join("\n");
}

export const calcStatsTool: ToolDefinition = {
    name: "calc_stats",
    description:
        "Compute a Champions Pokémon's level-50 stats from base stats + Stat Points (0–32 each, 66 total) + nature. Use for speed tiers and bulk benchmarks.",
    schema: {
        pokemon: z.string(),
        statPoints: z.record(z.number()).optional().describe("e.g. {hp:32, atk:32, spe:2}"),
        nature: z.string().optional(),
    },
    execute: (args) =>
        calcStats(args as { pokemon: string; statPoints?: StatPoints; nature?: string }),
};
