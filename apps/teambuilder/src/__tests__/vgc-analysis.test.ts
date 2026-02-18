import { describe, it, expect } from "vitest";
import { analyzeVGCTeam, getVGCAnalysisSummary } from "@/lib/vgc-analysis";
import type { TeamPokemon } from "@/types/pokemon";

describe("VGC Analysis", () => {
    const createPokemon = (name: string, moves: string[] = [], item?: string): TeamPokemon => ({
        pokemon: name,
        moves,
        item,
    });

    describe("analyzeVGCTeam", () => {
        it("returns empty array for empty team", () => {
            const warnings = analyzeVGCTeam([]);
            expect(warnings).toHaveLength(0);
        });

        it("warns about small team size", () => {
            const team = [createPokemon("Garchomp"), createPokemon("Landorus")];
            const warnings = analyzeVGCTeam(team);
            expect(warnings.some((w) => w.message.includes("2 Pokemon"))).toBe(true);
        });

        it("warns when multiple Pokemon missing Protect", () => {
            const team = [
                createPokemon("Garchomp", [
                    "Earthquake",
                    "Dragon Claw",
                    "Swords Dance",
                    "Stone Edge",
                ]),
                createPokemon("Landorus", ["Earth Power", "Sludge Bomb", "Psychic", "Focus Blast"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Swords Dance",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Nasty Plot",
                    "Thunderbolt",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            expect(
                warnings.some(
                    (w) => w.message.includes("Protect") || w.message.includes("protect"),
                ),
            ).toBe(true);
        });

        it("does not warn about Protect for Assault Vest users", () => {
            const team = [
                createPokemon(
                    "Rillaboom",
                    ["Grassy Glide", "Wood Hammer", "Fake Out", "U-turn"],
                    "Assault Vest",
                ),
                createPokemon(
                    "Incineroar",
                    ["Flare Blitz", "Knock Off", "Fake Out", "U-turn"],
                    "Assault Vest",
                ),
                createPokemon("Garchomp", ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            // Should not specifically warn about Rillaboom or Incineroar
            expect(warnings.every((w) => !w.pokemon || w.pokemon !== "Rillaboom")).toBe(true);
            expect(warnings.every((w) => !w.pokemon || w.pokemon !== "Incineroar")).toBe(true);
        });

        it("does not warn about Protect for Choice item users", () => {
            const team = [
                createPokemon(
                    "Dragapult",
                    ["Dragon Darts", "Phantom Force", "U-turn", "Draco Meteor"],
                    "Choice Specs",
                ),
                createPokemon("Garchomp", ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Protect",
                    "Thunderbolt",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            // Should not specifically warn about Dragapult
            expect(warnings.every((w) => !w.pokemon || w.pokemon !== "Dragapult")).toBe(true);
        });

        it("warns about missing speed control", () => {
            const team = [
                createPokemon("Garchomp", ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Protect",
                    "Thunderbolt",
                ]),
                createPokemon("Rillaboom", ["Grassy Glide", "Wood Hammer", "Protect", "Fake Out"]),
            ];
            const warnings = analyzeVGCTeam(team);
            expect(warnings.some((w) => w.message.toLowerCase().includes("speed control"))).toBe(
                true,
            );
        });

        it("does not warn about speed control when team has Tailwind", () => {
            const team = [
                createPokemon("Tornadus", ["Tailwind", "Air Slash", "Protect", "Taunt"]),
                createPokemon("Garchomp", ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Protect",
                    "Thunderbolt",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            expect(warnings.every((w) => !w.message.toLowerCase().includes("speed control"))).toBe(
                true,
            );
        });

        it("does not warn about speed control when team has Trick Room", () => {
            const team = [
                createPokemon("Ursaluna", ["Facade", "Earthquake", "Protect", "Trick Room"]),
                createPokemon("Indeedee-F", ["Psychic", "Follow Me", "Protect", "Helping Hand"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Protect",
                    "Thunderbolt",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            expect(warnings.every((w) => !w.message.toLowerCase().includes("speed control"))).toBe(
                true,
            );
        });

        it("does not warn about speed control when team has Icy Wind", () => {
            const team = [
                createPokemon("Pelipper", ["Weather Ball", "Icy Wind", "Protect", "Tailwind"]),
                createPokemon("Garchomp", ["Earthquake", "Dragon Claw", "Protect", "Stone Edge"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Protect",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Protect",
                    "Thunderbolt",
                ]),
            ];
            const warnings = analyzeVGCTeam(team);
            expect(warnings.every((w) => !w.message.toLowerCase().includes("speed control"))).toBe(
                true,
            );
        });
    });

    describe("getVGCAnalysisSummary", () => {
        it("returns empty string for empty team", () => {
            const summary = getVGCAnalysisSummary([]);
            expect(summary).toBe("");
        });

        it("returns formatted summary with warnings", () => {
            const team = [
                createPokemon("Garchomp", [
                    "Earthquake",
                    "Dragon Claw",
                    "Swords Dance",
                    "Stone Edge",
                ]),
                createPokemon("Landorus", ["Earth Power", "Sludge Bomb", "Psychic", "Focus Blast"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Swords Dance",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Nasty Plot",
                    "Thunderbolt",
                ]),
            ];
            const summary = getVGCAnalysisSummary(team);
            expect(summary).toContain("VGC TEAM ANALYSIS:");
        });

        it("includes emoji prefixes for warnings", () => {
            const team = [
                createPokemon("Garchomp", [
                    "Earthquake",
                    "Dragon Claw",
                    "Swords Dance",
                    "Stone Edge",
                ]),
                createPokemon("Landorus", ["Earth Power", "Sludge Bomb", "Psychic", "Focus Blast"]),
                createPokemon("Kingambit", [
                    "Iron Head",
                    "Sucker Punch",
                    "Swords Dance",
                    "Kowtow Cleave",
                ]),
                createPokemon("Gholdengo", [
                    "Make It Rain",
                    "Shadow Ball",
                    "Nasty Plot",
                    "Thunderbolt",
                ]),
            ];
            const summary = getVGCAnalysisSummary(team);
            // Should contain warning or info emojis
            expect(summary).toMatch(/[⚠️💡❌]/);
        });
    });
});
