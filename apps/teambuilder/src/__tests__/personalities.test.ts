import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    PERSONALITIES,
    DEFAULT_PERSONALITY,
    getPersonality,
    getAllPersonalities,
    getRandomThinkingMessage,
    getRandomCatchphrase,
} from "@/lib/ai/personalities";

describe("personalities", () => {
    describe("PERSONALITIES", () => {
        it("should have three personalities defined", () => {
            expect(Object.keys(PERSONALITIES)).toHaveLength(3);
        });

        it("should have kukui, oak, and blue personalities", () => {
            expect(PERSONALITIES.kukui).toBeDefined();
            expect(PERSONALITIES.oak).toBeDefined();
            expect(PERSONALITIES.blue).toBeDefined();
        });

        it("each personality should have required fields", () => {
            const requiredFields = [
                "id",
                "name",
                "title",
                "avatar",
                "accentColor",
                "thinkingMessages",
                "systemPromptPrefix",
                "expertise",
                "expertiseLabels",
                "catchphrases",
                "loreReferences",
                "preferredPokemon",
                "praiseStyle",
                "criticismStyle",
            ] as const;

            for (const personality of Object.values(PERSONALITIES)) {
                for (const field of requiredFields) {
                    expect(personality).toHaveProperty(field);
                    expect(personality[field]).toBeTruthy();
                }
            }
        });

        it("each personality should have at least 3 thinking messages", () => {
            for (const personality of Object.values(PERSONALITIES)) {
                expect(personality.thinkingMessages.length).toBeGreaterThanOrEqual(3);
            }
        });

        it("each personality should have at least 2 expertise areas", () => {
            for (const personality of Object.values(PERSONALITIES)) {
                expect(personality.expertise.length).toBeGreaterThanOrEqual(2);
            }
        });

        it("each personality should have at least 3 catchphrases", () => {
            for (const personality of Object.values(PERSONALITIES)) {
                expect(personality.catchphrases.length).toBeGreaterThanOrEqual(3);
            }
        });

        it("each personality should have at least 3 lore references", () => {
            for (const personality of Object.values(PERSONALITIES)) {
                expect(personality.loreReferences.length).toBeGreaterThanOrEqual(3);
            }
        });
    });

    describe("DEFAULT_PERSONALITY", () => {
        it("should be kukui", () => {
            expect(DEFAULT_PERSONALITY).toBe("kukui");
        });

        it("should be a valid personality id", () => {
            expect(PERSONALITIES[DEFAULT_PERSONALITY]).toBeDefined();
        });
    });

    describe("getPersonality", () => {
        it("should return the correct personality for kukui", () => {
            const personality = getPersonality("kukui");
            expect(personality.id).toBe("kukui");
            expect(personality.name).toBe("Professor Kukui");
        });

        it("should return the correct personality for oak", () => {
            const personality = getPersonality("oak");
            expect(personality.id).toBe("oak");
            expect(personality.name).toBe("Professor Oak");
        });

        it("should return the correct personality for blue", () => {
            const personality = getPersonality("blue");
            expect(personality.id).toBe("blue");
            expect(personality.name).toBe("Blue");
        });

        it("should return default personality for invalid id", () => {
            // @ts-expect-error Testing invalid input
            const personality = getPersonality("invalid");
            expect(personality.id).toBe(DEFAULT_PERSONALITY);
        });
    });

    describe("getAllPersonalities", () => {
        it("should return all personalities as an array", () => {
            const personalities = getAllPersonalities();
            expect(Array.isArray(personalities)).toBe(true);
            expect(personalities).toHaveLength(3);
        });

        it("should include all personality ids", () => {
            const personalities = getAllPersonalities();
            const ids = personalities.map((p) => p.id);
            expect(ids).toContain("kukui");
            expect(ids).toContain("oak");
            expect(ids).toContain("blue");
        });
    });

    describe("getRandomThinkingMessage", () => {
        beforeEach(() => {
            vi.spyOn(Math, "random").mockReturnValue(0);
        });

        it("should return a message from kukui thinkingMessages", () => {
            const message = getRandomThinkingMessage("kukui");
            expect(PERSONALITIES.kukui.thinkingMessages).toContain(message);
        });

        it("should return a message from oak thinkingMessages", () => {
            const message = getRandomThinkingMessage("oak");
            expect(PERSONALITIES.oak.thinkingMessages).toContain(message);
        });

        it("should return a message from blue thinkingMessages", () => {
            const message = getRandomThinkingMessage("blue");
            expect(PERSONALITIES.blue.thinkingMessages).toContain(message);
        });

        it("should return first message when Math.random returns 0", () => {
            vi.spyOn(Math, "random").mockReturnValue(0);
            const message = getRandomThinkingMessage("kukui");
            expect(message).toBe(PERSONALITIES.kukui.thinkingMessages[0]);
        });
    });

    describe("getRandomCatchphrase", () => {
        beforeEach(() => {
            vi.spyOn(Math, "random").mockReturnValue(0);
        });

        it("should return a catchphrase from kukui", () => {
            const phrase = getRandomCatchphrase("kukui");
            expect(PERSONALITIES.kukui.catchphrases).toContain(phrase);
        });

        it("should return a catchphrase from oak", () => {
            const phrase = getRandomCatchphrase("oak");
            expect(PERSONALITIES.oak.catchphrases).toContain(phrase);
        });

        it("should return a catchphrase from blue", () => {
            const phrase = getRandomCatchphrase("blue");
            expect(PERSONALITIES.blue.catchphrases).toContain(phrase);
        });
    });

    describe("personality content", () => {
        describe("Professor Kukui", () => {
            const kukui = PERSONALITIES.kukui;

            it("should have enthusiastic theme", () => {
                expect(kukui.systemPromptPrefix).toContain("enthusiastic");
                expect(kukui.thinkingMessages.some((m) => m.includes("yeah"))).toBe(true);
            });

            it("should reference Alola", () => {
                expect(kukui.title).toContain("Alola");
                expect(kukui.systemPromptPrefix).toContain("Alola");
            });

            it("should have move mechanics expertise", () => {
                expect(kukui.expertise).toContain("move_mechanics");
                expect(kukui.expertise).toContain("damage_calcs");
            });

            it("should reference Masked Royal in lore", () => {
                expect(kukui.systemPromptPrefix).toContain("Masked Royal");
            });

            it("should have Alola Pokemon in preferences", () => {
                expect(kukui.preferredPokemon).toContain("Incineroar");
            });
        });

        describe("Professor Oak", () => {
            const oak = PERSONALITIES.oak;

            it("should have wise/mentor theme", () => {
                expect(oak.systemPromptPrefix).toContain("wisdom");
            });

            it("should reference Kanto", () => {
                expect(oak.title).toContain("Kanto");
            });

            it("should have research-themed thinking messages", () => {
                expect(oak.thinkingMessages.some((m) => m.includes("research"))).toBe(true);
            });

            it("should have stats/biology expertise", () => {
                expect(oak.expertise).toContain("stats_biology");
                expect(oak.expertise).toContain("abilities");
            });

            it("should reference Pokedex creation", () => {
                expect(oak.systemPromptPrefix).toContain("Pokedex");
            });

            it("should have Kanto starters in preferences", () => {
                expect(oak.preferredPokemon).toContain("Bulbasaur");
                expect(oak.preferredPokemon).toContain("Charmander");
                expect(oak.preferredPokemon).toContain("Squirtle");
            });
        });

        describe("Rival Blue", () => {
            const blue = PERSONALITIES.blue;

            it("should have champion theme", () => {
                expect(blue.title).toContain("Champion");
                expect(blue.systemPromptPrefix).toContain("Champion");
            });

            it("should have confident/cocky personality", () => {
                expect(blue.systemPromptPrefix).toContain("confident");
            });

            it("should reference signature catchphrase", () => {
                expect(blue.systemPromptPrefix).toContain("Smell ya later");
            });

            it("should have meta/psychology expertise", () => {
                expect(blue.expertise).toContain("meta_prediction");
                expect(blue.expertise).toContain("psychology");
            });

            it("should reference rivalry with Red", () => {
                expect(blue.loreReferences.some((r) => r.topic === "red")).toBe(true);
            });

            it("should have iconic Pokemon in preferences", () => {
                expect(blue.preferredPokemon).toContain("Alakazam");
                expect(blue.preferredPokemon).toContain("Arcanine");
            });
        });
    });
});
