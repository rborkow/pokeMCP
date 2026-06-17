import { describe, it, expect } from "vitest";
import {
    getActiveMegaForm,
    getActiveMegaSlot,
    getEffectiveTypes,
    getMegaFormsForFormat,
    isActiveMegaDataPending,
} from "@/lib/champions-utils";
import type { TeamPokemon } from "@/types/pokemon";

function pkmn(name: string, item?: string): TeamPokemon {
    return { pokemon: name, moves: [], item };
}

describe("getMegaFormsForFormat", () => {
    it("returns forms for champions-regma", () => {
        const forms = getMegaFormsForFormat("champions-regma");
        expect(forms).toBeDefined();
        expect(forms!.some((f) => f.megaName === "Charizard-Mega-Y")).toBe(true);
    });

    it("returns forms for champions-regmb (reuses M-A's Omni Ring list)", () => {
        const forms = getMegaFormsForFormat("champions-regmb");
        expect(forms).toBeDefined();
        expect(forms!.some((f) => f.megaName === "Charizard-Mega-Y")).toBe(true);
    });

    it("returns undefined for Showdown formats", () => {
        expect(getMegaFormsForFormat("gen9ou")).toBeUndefined();
        expect(getMegaFormsForFormat("gen9vgc2026regf")).toBeUndefined();
    });
});

describe("getActiveMegaSlot", () => {
    it("returns -1 for non-Champions formats", () => {
        const team = [pkmn("Charizard", "Charizardite X")];
        expect(getActiveMegaSlot(team, "gen9ou")).toBe(-1);
    });

    it("returns -1 when no team member holds a Mega Stone", () => {
        const team = [pkmn("Garchomp", "Life Orb"), pkmn("Incineroar", "Assault Vest")];
        expect(getActiveMegaSlot(team, "champions-regma")).toBe(-1);
    });

    it("returns the slot holding a matching Mega Stone", () => {
        const team = [
            pkmn("Garchomp", "Life Orb"),
            pkmn("Charizard", "Charizardite X"),
            pkmn("Amoonguss", "Sitrus Berry"),
        ];
        expect(getActiveMegaSlot(team, "champions-regma")).toBe(1);
    });

    it("returns -1 when the stone does not match the holder's species", () => {
        // Gengarite on Garchomp: wrong stone, no Mega triggers.
        const team = [pkmn("Garchomp", "Gengarite")];
        expect(getActiveMegaSlot(team, "champions-regma")).toBe(-1);
    });

    it("normalizes case and punctuation on item names", () => {
        const team = [pkmn("Charizard", "charizardite x")];
        expect(getActiveMegaSlot(team, "champions-regma")).toBe(0);
    });
});

describe("getActiveMegaForm", () => {
    it("returns the matching form", () => {
        const team = [pkmn("Gardevoir", "Gardevoirite")];
        const form = getActiveMegaForm(team, "champions-regma");
        expect(form?.megaName).toBe("Gardevoir-Mega");
    });

    it("returns undefined when no Mega is active", () => {
        const team = [pkmn("Garchomp", "Life Orb")];
        expect(getActiveMegaForm(team, "champions-regma")).toBeUndefined();
    });
});

describe("getEffectiveTypes", () => {
    it("returns post-Mega types for the active Mega slot", () => {
        const team = [pkmn("Charizard", "Charizardite X"), pkmn("Garchomp", "Life Orb")];
        // Charizard-Mega-X is Fire/Dragon.
        expect(getEffectiveTypes(team[0], team, "champions-regma")).toEqual(["Fire", "Dragon"]);
    });

    it("returns base types for non-Mega slots even in Champions format", () => {
        const team = [pkmn("Charizard", "Charizardite X"), pkmn("Garchomp", "Life Orb")];
        const garchompTypes = getEffectiveTypes(team[1], team, "champions-regma");
        // Garchomp is Dragon/Ground in Showdown data — check it's *not* Fire/Dragon.
        expect(garchompTypes).not.toEqual(["Fire", "Dragon"]);
    });

    it("returns base types when no Mega Stone is held", () => {
        const team = [pkmn("Charizard", "Life Orb")];
        const types = getEffectiveTypes(team[0], team, "champions-regma");
        // Charizard base is Fire/Flying.
        expect(types).toEqual(["Fire", "Flying"]);
    });

    it("returns base types in non-Champions formats", () => {
        const team = [pkmn("Charizard", "Charizardite X")];
        const types = getEffectiveTypes(team[0], team, "gen9ou");
        // Base Charizard types, not the Mega-X Fire/Dragon.
        expect(types).toEqual(["Fire", "Flying"]);
    });

    it("falls back to base types for Champions-exclusive Megas with pending data", () => {
        const team = [pkmn("Meganium", "Meganiumite")];
        const types = getEffectiveTypes(team[0], team, "champions-regma");
        // Meganium base is Grass — pending data means no overlay.
        expect(types).toEqual(["Grass"]);
    });
});

describe("isActiveMegaDataPending", () => {
    it("returns true when the active Mega has no post-Mega data yet", () => {
        const team = [pkmn("Meganium", "Meganiumite")];
        expect(isActiveMegaDataPending(team, "champions-regma")).toBe(true);
    });

    it("returns false for populated Megas", () => {
        const team = [pkmn("Charizard", "Charizardite Y")];
        expect(isActiveMegaDataPending(team, "champions-regma")).toBe(false);
    });

    it("returns false when no Mega is active", () => {
        const team = [pkmn("Garchomp", "Life Orb")];
        expect(isActiveMegaDataPending(team, "champions-regma")).toBe(false);
    });
});
