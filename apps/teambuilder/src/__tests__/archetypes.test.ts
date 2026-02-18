import { describe, it, expect } from "vitest";
import {
    isDoublesFormat,
    getArchetypesForFormat,
    getArchetype,
    getArchetypePrompt,
    TEAM_ARCHETYPES,
} from "@/lib/ai/archetypes";

describe("archetypes", () => {
    describe("isDoublesFormat", () => {
        it("identifies VGC formats as doubles", () => {
            expect(isDoublesFormat("gen9vgc2024regh")).toBe(true);
            expect(isDoublesFormat("gen9vgc2024regf")).toBe(true);
            expect(isDoublesFormat("VGC 2024")).toBe(true);
        });

        it("identifies doubles OU as doubles", () => {
            expect(isDoublesFormat("gen9doublesou")).toBe(true);
            expect(isDoublesFormat("gen8doublesou")).toBe(true);
        });

        it("identifies battle stadium as doubles", () => {
            expect(isDoublesFormat("gen9battlestadiumdoubles")).toBe(true);
            expect(isDoublesFormat("gen9bsd")).toBe(true);
            expect(isDoublesFormat("gen9bss")).toBe(true);
        });

        it("identifies singles formats as not doubles", () => {
            expect(isDoublesFormat("gen9ou")).toBe(false);
            expect(isDoublesFormat("gen9uu")).toBe(false);
            expect(isDoublesFormat("gen9ubers")).toBe(false);
            expect(isDoublesFormat("gen8ou")).toBe(false);
        });

        it("is case insensitive", () => {
            expect(isDoublesFormat("GEN9VGC2024")).toBe(true);
            expect(isDoublesFormat("Gen9DoublesOU")).toBe(true);
            expect(isDoublesFormat("GEN9OU")).toBe(false);
        });
    });

    describe("getArchetypesForFormat", () => {
        it("returns singles archetypes for singles formats", () => {
            const archetypes = getArchetypesForFormat("gen9ou");

            // Should include singles archetypes
            expect(archetypes.some((a) => a.id === "hyper-offense")).toBe(true);
            expect(archetypes.some((a) => a.id === "bulky-offense")).toBe(true);
            expect(archetypes.some((a) => a.id === "balance")).toBe(true);
            expect(archetypes.some((a) => a.id === "stall")).toBe(true);
            expect(archetypes.some((a) => a.id === "weather-singles")).toBe(true);

            // Should NOT include doubles-only archetypes
            expect(archetypes.some((a) => a.id === "goodstuffs")).toBe(false);
            expect(archetypes.some((a) => a.id === "trick-room-doubles")).toBe(false);
            expect(archetypes.some((a) => a.id === "tailwind")).toBe(false);
        });

        it("returns doubles archetypes for VGC formats", () => {
            const archetypes = getArchetypesForFormat("gen9vgc2024regh");

            // Should include doubles archetypes
            expect(archetypes.some((a) => a.id === "goodstuffs")).toBe(true);
            expect(archetypes.some((a) => a.id === "trick-room-doubles")).toBe(true);
            expect(archetypes.some((a) => a.id === "tailwind")).toBe(true);
            expect(archetypes.some((a) => a.id === "sun-doubles")).toBe(true);
            expect(archetypes.some((a) => a.id === "rain-doubles")).toBe(true);
            expect(archetypes.some((a) => a.id === "sand-doubles")).toBe(true);

            // Should NOT include singles-only archetypes
            expect(archetypes.some((a) => a.id === "hyper-offense")).toBe(false);
            expect(archetypes.some((a) => a.id === "stall")).toBe(false);
            expect(archetypes.some((a) => a.id === "weather-singles")).toBe(false);
        });

        it("returns non-empty arrays for all format types", () => {
            expect(getArchetypesForFormat("gen9ou").length).toBeGreaterThan(0);
            expect(getArchetypesForFormat("gen9vgc2024regh").length).toBeGreaterThan(0);
        });

        it("includes goblin-mode in both singles and doubles", () => {
            const singlesArchetypes = getArchetypesForFormat("gen9ou");
            const doublesArchetypes = getArchetypesForFormat("gen9vgc2024regh");

            // Goblin Mode has formats: "both" so should appear in both
            expect(singlesArchetypes.some((a) => a.id === "goblin-mode")).toBe(true);
            expect(doublesArchetypes.some((a) => a.id === "goblin-mode")).toBe(true);
        });
    });

    describe("getArchetype", () => {
        it("finds archetypes by id", () => {
            const hyperOffense = getArchetype("hyper-offense");
            expect(hyperOffense).toBeDefined();
            expect(hyperOffense?.name).toBe("Hyper Offense");
        });

        it("returns undefined for unknown id", () => {
            expect(getArchetype("nonexistent")).toBeUndefined();
        });

        it("finds all defined archetypes", () => {
            for (const archetype of TEAM_ARCHETYPES) {
                expect(getArchetype(archetype.id)).toBe(archetype);
            }
        });
    });

    describe("getArchetypePrompt", () => {
        it("returns archetype prompt with format requirements", () => {
            const prompt = getArchetypePrompt("hyper-offense", "gen9ou");

            // Should include archetype content
            expect(prompt).toContain("Hyper Offense");
            expect(prompt).toContain("sweepers");

            // Should include singles format requirements
            expect(prompt).toContain("SINGLES FORMAT REQUIREMENTS");
            expect(prompt).toContain("entry hazards");
            expect(prompt).toContain("hazard removal");
        });

        it("includes doubles format requirements for VGC", () => {
            const prompt = getArchetypePrompt("goodstuffs", "gen9vgc2024regh");

            // Should include archetype content
            expect(prompt).toContain("Goodstuffs");

            // Should include doubles format requirements
            expect(prompt).toContain("DOUBLES FORMAT REQUIREMENTS");
            expect(prompt).toContain("Protect");
            expect(prompt).toContain("spread moves");
            expect(prompt).toContain("Speed control");
        });

        it("returns generic prompt for unknown archetype", () => {
            const prompt = getArchetypePrompt("nonexistent", "gen9ou");

            expect(prompt).toContain("competitive");
            expect(prompt).toContain("Pokemon team");
            expect(prompt).toContain("SINGLES format");
        });

        it("generates doubles generic prompt for VGC with unknown archetype", () => {
            const prompt = getArchetypePrompt("nonexistent", "gen9vgc2024regh");

            expect(prompt).toContain("DOUBLES format");
            expect(prompt).toContain("Protect");
            expect(prompt).toContain("spread moves");
        });

        it("includes format name in prompt", () => {
            const prompt = getArchetypePrompt("balance", "gen9ou");
            expect(prompt).toContain("GEN9OU");
        });
    });

    describe("TEAM_ARCHETYPES", () => {
        it("all archetypes have required fields", () => {
            for (const archetype of TEAM_ARCHETYPES) {
                expect(archetype.id).toBeTruthy();
                expect(archetype.name).toBeTruthy();
                expect(archetype.description).toBeTruthy();
                expect(archetype.icon).toBeTruthy();
                expect(archetype.prompt).toBeTruthy();
                expect(archetype.keyFeatures.length).toBeGreaterThan(0);
                expect(["singles", "doubles", "both"]).toContain(archetype.formats);
            }
        });

        it("all archetype ids are unique", () => {
            const ids = TEAM_ARCHETYPES.map((a) => a.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });
});
