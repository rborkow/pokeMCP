import { describe, expect, it } from "vitest";
import { POKEMON_LIST } from "@/lib/data/pokemon-list";

describe("POKEMON_LIST", () => {
    it("has entries in the expected size range", () => {
        expect(POKEMON_LIST.length).toBeGreaterThan(1400);
        expect(POKEMON_LIST.length).toBeLessThan(2500);
    });

    it("has unique canonical IDs", () => {
        const ids = new Set(POKEMON_LIST.map((p) => p.id));
        expect(ids.size).toBe(POKEMON_LIST.length);
    });

    it("canonical IDs contain only lowercase alphanumerics", () => {
        for (const p of POKEMON_LIST) {
            expect(p.id).toMatch(/^[a-z0-9]+$/);
        }
    });

    it("includes key base species with capitalized display names", () => {
        const pikachu = POKEMON_LIST.find((p) => p.id === "pikachu");
        expect(pikachu).toBeDefined();
        expect(pikachu?.displayName).toBe("Pikachu");
    });

    it("formats Mega forms as 'Charizard-Mega-X'", () => {
        const megaX = POKEMON_LIST.find((p) => p.id === "charizardmegax");
        expect(megaX).toBeDefined();
        expect(megaX?.displayName).toBe("Charizard-Mega-X");
    });

    it("formats Therian forms as 'Landorus-Therian'", () => {
        const entry = POKEMON_LIST.find((p) => p.id === "landorustherian");
        expect(entry).toBeDefined();
        expect(entry?.displayName).toBe("Landorus-Therian");
    });

    it("is sorted alphabetically by displayName", () => {
        for (let i = 1; i < POKEMON_LIST.length; i++) {
            expect(
                POKEMON_LIST[i - 1].displayName.localeCompare(POKEMON_LIST[i].displayName),
            ).toBeLessThanOrEqual(0);
        }
    });

    it("attaches the species types array", () => {
        const pikachu = POKEMON_LIST.find((p) => p.id === "pikachu");
        expect(pikachu?.types).toEqual(["Electric"]);
    });

    it("uses the canonical Showdown display name for Tapu Koko", () => {
        const entry = POKEMON_LIST.find((p) => p.id === "tapukoko");
        expect(entry?.displayName).toBe("Tapu Koko");
    });

    it("uses the canonical Showdown display name for Type: Null", () => {
        const entry = POKEMON_LIST.find((p) => p.id === "typenull");
        expect(entry?.displayName).toBe("Type: Null");
    });

    it("uses the canonical Showdown display name for Farfetch'd", () => {
        // farfetchd is not in POKEMON_DISPLAY_NAMES so falls back to capitalize(id)
        const entry = POKEMON_LIST.find((p) => p.id === "farfetchd");
        expect(entry?.displayName).toBe("Farfetchd");
    });

    it("uses the canonical Showdown display name for Jangmo-o (lowercase 'o')", () => {
        const entry = POKEMON_LIST.find((p) => p.id === "jangmoo");
        expect(entry?.displayName).toBe("Jangmo-o");
    });
});
