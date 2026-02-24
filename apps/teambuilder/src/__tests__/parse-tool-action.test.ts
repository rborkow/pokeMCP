import { describe, it, expect } from "vitest";
import { parseToolToAction } from "@/lib/ai/index";
import type { TeamPokemon } from "@/types/pokemon";

describe("parseToolToAction", () => {
    const makeTeam = (...pokemon: Partial<TeamPokemon>[]): TeamPokemon[] =>
        pokemon.map((p) => ({
            pokemon: p.pokemon || "",
            moves: p.moves || [],
            ability: p.ability,
            item: p.item,
            nature: p.nature,
            teraType: p.teraType,
            evs: p.evs,
            ivs: p.ivs,
        }));

    describe("previousState capture", () => {
        it("captures previousState for replace_pokemon", () => {
            const team = makeTeam({
                pokemon: "Gliscor",
                ability: "Poison Heal",
                item: "Toxic Orb",
                moves: ["Earthquake", "Facade", "Swords Dance", "Roost"],
            });

            const action = parseToolToAction(
                {
                    action_type: "replace_pokemon",
                    slot: 0,
                    reason: "Better defensive pivot",
                    pokemon: "Incineroar",
                    moves: ["Flare Blitz", "Knock Off", "U-turn", "Parting Shot"],
                    ability: "Intimidate",
                    item: "Heavy-Duty Boots",
                },
                team,
            );

            expect(action).toBeDefined();
            expect(action!.previousState).toBeDefined();
            expect(action!.previousState!.pokemon).toBe("Gliscor");
            expect(action!.previousState!.ability).toBe("Poison Heal");
            expect(action!.previousState!.item).toBe("Toxic Orb");
        });

        it("has undefined previousState for add_pokemon to empty slot", () => {
            const action = parseToolToAction(
                {
                    action_type: "add_pokemon",
                    slot: 0,
                    reason: "Starting the team",
                    pokemon: "Garchomp",
                    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Scale Shot"],
                },
                [],
            );

            expect(action).toBeDefined();
            expect(action!.previousState).toBeUndefined();
        });

        it("captures previousState for update_pokemon", () => {
            const team = makeTeam({
                pokemon: "Garchomp",
                item: "Life Orb",
                nature: "Jolly",
                moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Stone Edge"],
            });

            const action = parseToolToAction(
                {
                    action_type: "update_pokemon",
                    slot: 0,
                    reason: "Better item choice",
                    item: "Rocky Helmet",
                },
                team,
            );

            expect(action).toBeDefined();
            expect(action!.previousState).toBeDefined();
            expect(action!.previousState!.pokemon).toBe("Garchomp");
            expect(action!.previousState!.item).toBe("Life Orb");
        });

        it("captures previousState for remove_pokemon", () => {
            const team = makeTeam({
                pokemon: "Toxapex",
                ability: "Regenerator",
                moves: ["Scald", "Toxic", "Recover", "Haze"],
            });

            const action = parseToolToAction(
                {
                    action_type: "remove_pokemon",
                    slot: 0,
                    reason: "Team slot needed",
                },
                team,
            );

            expect(action).toBeDefined();
            expect(action!.previousState).toBeDefined();
            expect(action!.previousState!.pokemon).toBe("Toxapex");
        });

        it("captures correct slot when replacing non-first Pokemon", () => {
            const team = makeTeam(
                { pokemon: "Garchomp", moves: ["Earthquake"] },
                { pokemon: "Gliscor", ability: "Poison Heal", moves: ["Earthquake"] },
                { pokemon: "Heatran", moves: ["Magma Storm"] },
            );

            const action = parseToolToAction(
                {
                    action_type: "replace_pokemon",
                    slot: 1,
                    reason: "Better choice",
                    pokemon: "Landorus-Therian",
                    moves: ["Earthquake", "U-turn", "Stealth Rock", "Stone Edge"],
                },
                team,
            );

            expect(action).toBeDefined();
            expect(action!.previousState!.pokemon).toBe("Gliscor");
            expect(action!.previousState!.ability).toBe("Poison Heal");
            // Confirm the preview has the new Pokemon
            expect(action!.preview[1].pokemon).toBe("Landorus-Therian");
        });
    });

    describe("preview generation", () => {
        it("builds correct preview for replace_pokemon", () => {
            const team = makeTeam(
                { pokemon: "Garchomp", moves: ["Earthquake"] },
                { pokemon: "Gliscor", moves: ["Earthquake"] },
            );

            const action = parseToolToAction(
                {
                    action_type: "replace_pokemon",
                    slot: 0,
                    reason: "Better lead",
                    pokemon: "Great Tusk",
                    moves: ["Earthquake", "Close Combat", "Ice Spinner", "Rapid Spin"],
                },
                team,
            );

            expect(action!.preview).toHaveLength(2);
            expect(action!.preview[0].pokemon).toBe("Great Tusk");
            expect(action!.preview[1].pokemon).toBe("Gliscor");
        });

        it("builds correct preview for add_pokemon", () => {
            const team = makeTeam({ pokemon: "Garchomp", moves: ["Earthquake"] });

            const action = parseToolToAction(
                {
                    action_type: "add_pokemon",
                    slot: 1,
                    reason: "Adding team member",
                    pokemon: "Heatran",
                    moves: ["Magma Storm", "Earth Power", "Flash Cannon", "Stealth Rock"],
                },
                team,
            );

            expect(action!.preview).toHaveLength(2);
            expect(action!.preview[1].pokemon).toBe("Heatran");
        });
    });
});
