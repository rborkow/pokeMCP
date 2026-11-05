import { z } from "zod";
import type { DexSpecies } from "../regulation.js";
import { isLegalSpecies } from "../regulation.js";
import { CHAMPIONS_FORMAT_ID, championsDex, TeamValidator } from "../showdown.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

const STATS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;
const statLine = (bs: Record<string, number>) => STATS.map((k) => bs[k]).join("/");

/**
 * Every move the species can legally carry in the current format, with the
 * champions mod's (possibly rebalanced) power/PP. Uses the validator's
 * `checkCanLearn` directly — Showdown decides event/transfer edge cases, not
 * a regex over `validateSet` problems. Null return means learnable.
 */
function legalMoves(speciesName: string): string[] {
    const validator = new TeamValidator(CHAMPIONS_FORMAT_ID);
    const species = championsDex.species.get(speciesName);
    const out: string[] = [];
    for (const move of championsDex.moves.all()) {
        if (!move.exists || move.isNonstandard) continue;
        const problem = validator.checkCanLearn(move, species, validator.allSources(species), {
            level: 50,
            ability: species.abilities["0"],
        });
        if (problem === null) {
            out.push(`${move.name} (${move.type}, ${move.basePower || "—"} BP, ${move.pp} PP)`);
        }
    }
    return out.sort();
}

export async function lookupPokemon(args: { pokemon: string; moves?: boolean }): Promise<string> {
    const species = championsDex.species.get(args.pokemon);
    if (!species.exists) return `Unknown Pokémon: ${args.pokemon}`;
    const legal = isLegalSpecies(species as DexSpecies);
    const megas = (species.otherFormes ?? [])
        .map((f: string) => championsDex.species.get(f) as DexSpecies)
        .filter(
            (f: DexSpecies) => /Mega/.test(f.forme ?? "") && isLegalSpecies(f) && f.requiredItem,
        );
    const lines = [
        `**${species.name}** — ${species.types.join("/")} — BST ${statLine(species.baseStats)}`,
        sourceLine(),
        `- Abilities: ${Object.values(species.abilities).join(", ")}`,
        `- Legal in Reg M-C: ${legal ? "yes" : "no"}${legal ? ` (Showdown tier ${species.tier})` : ""}`,
    ];
    for (const m of megas) {
        lines.push(
            `- Mega: ${m.name} via ${m.requiredItem} → ${m.types.join("/")}, ${m.abilities["0"]}, BST ${statLine(m.baseStats)}`,
        );
    }
    if (args.moves) {
        const moves = legalMoves(species.name);
        lines.push("", `**Legal moves (${moves.length}):**`, moves.join("; "));
    }
    return lines.join("\n");
}

export const lookupPokemonTool: ToolDefinition = {
    name: "lookup_pokemon",
    description:
        "Champions dex entry: types, base stats, abilities, Reg M-C legality, Mega forms (post-Mega types/ability/stats). Set moves=true for the full legal movepool with Champions-adjusted BP/PP.",
    schema: {
        pokemon: z.string().describe("Species name, e.g. 'Garchomp' or 'Golisopod-Mega'"),
        moves: z.boolean().optional().describe("Include the full legal movepool (slower)"),
    },
    execute: (args) => lookupPokemon(args as { pokemon: string; moves?: boolean }),
};
