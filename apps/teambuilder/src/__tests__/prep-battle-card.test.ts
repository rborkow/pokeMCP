import { describe, expect, it } from "vitest";
import {
    CHAMPIONS_CAPABILITIES,
    DEFAULT_CHAMPIONS_FORMAT,
    getDefaultChampionsCapability,
} from "@/lib/prep/capabilities";
import { generateBattleCard } from "@/lib/prep/battle-card";
import { BattleCardSchema, createTeamSnapshot } from "@/lib/prep/schema";

const own = createTeamSnapshot("My team", "champions-regmb", [
    { pokemon: "Charizard", moves: ["Heat Wave", "Solar Beam", "Protect"] },
    { pokemon: "Whimsicott", moves: ["Tailwind", "Encore", "Protect"] },
    { pokemon: "Incineroar", moves: ["Fake Out", "Flare Blitz", "Parting Shot"] },
    { pokemon: "Garchomp", moves: ["Earthquake", "Dragon Claw", "Protect"] },
    { pokemon: "Sylveon", moves: ["Hyper Voice", "Quick Attack", "Protect"] },
    { pokemon: "Amoonguss", moves: ["Rage Powder", "Spore", "Protect"] },
]);

const opponent = createTeamSnapshot("Opponent", "champions-regmb", [
    { pokemon: "Tyranitar", moves: ["Rock Slide", "Knock Off", "Protect"] },
    { pokemon: "Excadrill", moves: ["Iron Head", "High Horsepower", "Protect"] },
    { pokemon: "Farigiraf", moves: ["Trick Room", "Helping Hand", "Psychic"] },
    { pokemon: "Torkoal", moves: ["Eruption", "Weather Ball", "Protect"] },
    { pokemon: "Incineroar", moves: ["Fake Out", "Parting Shot", "Flare Blitz"] },
    { pokemon: "Floette", moves: ["Moonblast", "Dazzling Gleam", "Protect"] },
]);

describe("Champions capability registry", () => {
    it("defaults to the newest supported regulation", () => {
        const supported = CHAMPIONS_CAPABILITIES.filter((entry) => entry.supported).sort((a, b) =>
            b.startsAt.localeCompare(a.startsAt),
        );
        expect(DEFAULT_CHAMPIONS_FORMAT).toBe(supported[0].id);
        expect(getDefaultChampionsCapability().mechanicsVersion).toContain(supported[0].id);
    });
});

describe("generateBattleCard", () => {
    it("creates a validated, complete prep artifact", () => {
        const card = generateBattleCard(own, opponent);
        expect(BattleCardSchema.safeParse(card).success).toBe(true);
        expect(card.bringFour).toHaveLength(4);
        expect(card.leadPlans).toHaveLength(2);
        expect(card.practiceChecklist.length).toBeGreaterThanOrEqual(3);
    });

    it("marks VP-sensitive Champions mechanics locally", () => {
        const card = generateBattleCard(own, opponent);
        expect(card.evidence).toContainEqual(
            expect.objectContaining({ kind: "beta-mechanics", id: "beta-vp" }),
        );
        expect(card.leadPlans[0].evidenceIds).toContain("beta-vp");
    });

    it("derives visible danger points from the opposing team sheet", () => {
        const card = generateBattleCard(own, opponent);
        expect(card.dangerPoints.some((point) => point.title.includes("Farigiraf"))).toBe(true);
        expect(card.dangerPoints.some((point) => point.title.includes("Incineroar"))).toBe(true);
    });
});
