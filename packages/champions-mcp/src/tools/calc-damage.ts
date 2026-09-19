import type { State, StatsTable } from "@smogon/calc";
import { calculate, Field, Move, Pokemon } from "@smogon/calc";
import { z } from "zod";
import { championsDex } from "../showdown.js";
import { assertNature, assertStatPoints, CHAMPIONS_GEN, type StatPoints } from "../stats.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

const sideSchema = z.object({
    species: z.string(),
    item: z.string().optional(),
    ability: z.string().optional(),
    nature: z.string().optional(),
    statPoints: z.record(z.number()).optional(),
    boosts: z.record(z.number()).optional(),
});
type Side = z.infer<typeof sideSchema>;

const BOOST_KEYS = ["atk", "def", "spa", "spd", "spe", "acc", "eva"] as const;

/** Validate raw boost records before they reach the calc (out-of-range keys silently no-op, bad values crash). */
function assertBoosts(boosts: Record<string, number> | undefined): void {
    for (const [k, v] of Object.entries(boosts ?? {})) {
        if (
            !BOOST_KEYS.includes(k as (typeof BOOST_KEYS)[number]) ||
            !Number.isInteger(v) ||
            v < -6 ||
            v > 6
        ) {
            throw new Error(
                `Invalid boost: ${k}=${v} (integer -6..6 on atk/def/spa/spd/spe/acc/eva)`,
            );
        }
    }
}

/** Build a calc Pokemon, overriding species data from the champions mod so Megas/rebalances are exact. */
function buildPokemon(side: Side): Pokemon {
    const dexSpecies = championsDex.species.get(side.species);
    if (!dexSpecies.exists) throw new Error(`Unknown Pokémon: ${side.species}`);
    const nature = side.nature ?? "Hardy";
    assertNature(nature);
    if (side.item && !championsDex.items.get(side.item).exists) {
        throw new Error(`Unknown item: ${side.item}`);
    }
    const sp = (side.statPoints ?? {}) as StatPoints;
    assertStatPoints(sp);
    assertBoosts(side.boosts);
    const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...sp };
    return new Pokemon(CHAMPIONS_GEN, dexSpecies.name, {
        level: 50,
        nature,
        item: side.item,
        ability: side.ability ?? dexSpecies.abilities["0"],
        evs,
        boosts: side.boosts as Partial<StatsTable> | undefined,
        overrides: { types: dexSpecies.types, baseStats: dexSpecies.baseStats },
    });
}

/** `result.damage` is number | number[] | number[][] (spread / multi-hit) — normalize to one roll list. */
function flattenDamage(damage: number | number[] | number[][]): number[] {
    if (typeof damage === "number") return [damage];
    const out: number[] = [];
    for (const d of damage) out.push(...(typeof d === "number" ? [d] : d));
    return out;
}

export async function calcDamage(args: {
    attacker: Side;
    defender: Side;
    move: string;
    field?: Record<string, unknown>;
}): Promise<string> {
    const dexMove = championsDex.moves.get(args.move);
    if (!dexMove.exists) throw new Error(`Unknown move: ${args.move}`);
    const attacker = buildPokemon(args.attacker);
    const defender = buildPokemon(args.defender);
    const move = new Move(CHAMPIONS_GEN, dexMove.name, {
        overrides: { basePower: dexMove.basePower, type: dexMove.type, category: dexMove.category },
    });
    const field = new Field({
        gameType: "Doubles",
        ...(args.field ?? {}),
    } as Partial<State.Field>);
    const result = calculate(CHAMPIONS_GEN, attacker, defender, move, field);
    return [
        `**${result.desc()}**`,
        sourceLine("damage via @smogon/calc gen 0 with champions-mod species/move overrides"),
        `Attacker ability used: ${attacker.ability ?? "none"}; defender ability: ${defender.ability ?? "none"}`,
        `Rolls: ${flattenDamage(result.damage).join(", ")}`,
    ].join("\n");
}

export const calcDamageTool: ToolDefinition = {
    name: "calc_damage",
    description:
        "Champions damage calc (doubles). Species/move data come from the Showdown champions mod (Megas, rebalanced moves); stat math from @smogon/calc gen 0. statPoints = {hp,atk,def,spa,spd,spe} 0–32.",
    schema: {
        attacker: sideSchema,
        defender: sideSchema,
        move: z.string(),
        field: z
            .record(z.unknown())
            .optional()
            .describe("@smogon/calc Field options, e.g. {weather:'Sun', terrain:'Grassy'}"),
    },
    execute: (args) => calcDamage(args as Parameters<typeof calcDamage>[0]),
};
