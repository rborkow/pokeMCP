import { describe, it, expect } from "vitest";
import { formatTeamContext, buildUserMessage } from "@/lib/ai/context";
import type { TeamPokemon } from "@/types/pokemon";

describe("AI Context", () => {
    describe("formatTeamContext", () => {
        it("returns placeholder for empty team", () => {
            const result = formatTeamContext([]);
            expect(result).toBe("No Pokemon in team yet.");
        });

        it("formats a simple team", () => {
            const team: TeamPokemon[] = [
                { pokemon: "Garchomp", moves: ["Earthquake", "Dragon Claw"] },
            ];
            const result = formatTeamContext(team);
            expect(result).toContain("1. Garchomp");
            expect(result).toContain("Moves: Earthquake, Dragon Claw");
        });

        it("includes item and ability", () => {
            const team: TeamPokemon[] = [
                {
                    pokemon: "Garchomp",
                    item: "Life Orb",
                    ability: "Rough Skin",
                    moves: [],
                },
            ];
            const result = formatTeamContext(team);
            expect(result).toContain("@ Life Orb");
            expect(result).toContain("(Rough Skin)");
        });

        it("includes Tera type", () => {
            const team: TeamPokemon[] = [{ pokemon: "Garchomp", teraType: "Steel", moves: [] }];
            const result = formatTeamContext(team);
            expect(result).toContain("Tera Type: Steel");
        });

        it("formats EVs correctly", () => {
            const team: TeamPokemon[] = [
                {
                    pokemon: "Garchomp",
                    evs: { hp: 252, atk: 4, def: 0, spa: 0, spd: 0, spe: 252 },
                    moves: [],
                },
            ];
            const result = formatTeamContext(team);
            expect(result).toContain("EVs: 252 HP / 4 Atk / 252 Spe");
        });
    });

    describe("buildUserMessage", () => {
        it("includes team context", () => {
            const result = buildUserMessage(
                "1. Garchomp @ Life Orb",
                "",
                "",
                "What should I add?",
                "gen9ou",
            );
            expect(result).toContain("Current Team:");
            expect(result).toContain("1. Garchomp @ Life Orb");
        });

        it("includes meta threats when provided", () => {
            const result = buildUserMessage(
                "No Pokemon in team yet.",
                "**Top Threats:** Great Tusk, Kingambit",
                "",
                "Build me a team",
                "gen9ou",
            );
            expect(result).toContain("Current Meta Threats");
            expect(result).toContain("Great Tusk");
        });

        it("includes popular sets when provided", () => {
            const result = buildUserMessage(
                "No Pokemon in team yet.",
                "",
                "**Garchomp Moves:** Earthquake, Dragon Claw",
                "Add Garchomp",
                "gen9ou",
            );
            expect(result).toContain("Popular Sets");
            expect(result).toContain("Garchomp Moves");
        });

        it("includes teammate analysis when provided", () => {
            const result = buildUserMessage(
                "1. Garchomp",
                "",
                "",
                "What should I add?",
                "gen9ou",
                undefined,
                undefined,
                "TEAMMATE SYNERGY SUGGESTIONS:\n- Great Tusk (pairs with Garchomp)",
            );
            expect(result).toContain("TEAMMATE SYNERGY SUGGESTIONS");
            expect(result).toContain("Great Tusk (pairs with Garchomp)");
        });

        it("includes VGC analysis for VGC mode", () => {
            const team: TeamPokemon[] = [
                {
                    pokemon: "Garchomp",
                    moves: ["Earthquake", "Dragon Claw", "Swords Dance", "Stone Edge"],
                },
                {
                    pokemon: "Kingambit",
                    moves: ["Iron Head", "Sucker Punch", "Swords Dance", "Kowtow Cleave"],
                },
            ];
            const result = buildUserMessage(
                formatTeamContext(team),
                "",
                "",
                "Rate my team",
                "gen9vgc2026regf",
                team,
                "vgc",
            );
            expect(result).toContain("VGC TEAM ANALYSIS");
        });

        it("includes user message", () => {
            const result = buildUserMessage(
                "No Pokemon in team yet.",
                "",
                "",
                "Build me a rain team",
                "gen9ou",
            );
            expect(result).toContain("User's Question: Build me a rain team");
        });
    });
});
