/**
 * Tests for the interaction-logging noise filter.
 *
 * `isUnproductivePokemonLookup` drops as-you-type autocomplete keystrokes
 * (partial names that resolve to "not found") so they don't inflate the
 * top-Pokémon metric or pollute fine-tuning data, while keeping productive
 * lookups and format-level diagnostics.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { isUnproductivePokemonLookup } from "../logging.js";

describe("isUnproductivePokemonLookup", () => {
    it("drops a lookup_pokemon miss for a partial name", () => {
        const result = isUnproductivePokemonLookup(
            { pokemon: "gyar" },
            'Pokémon "gyar" not found.',
        );
        assert.equal(result, true);
    });

    it("drops a get_usage_stats miss that carries a pokemon arg", () => {
        const result = isUnproductivePokemonLookup(
            { type: "popular_sets", pokemon: "kang", format: "gen9ou" },
            "kang not found in GEN9OU usage statistics.",
        );
        assert.equal(result, true);
    });

    it("keeps a successful lookup", () => {
        const result = isUnproductivePokemonLookup(
            { pokemon: "Gyarados" },
            "**Gyarados** — Water/Flying ...",
        );
        assert.equal(result, false);
    });

    it("keeps format-level 'No usage statistics found' diagnostics", () => {
        // Note: this message does NOT contain the substring "not found",
        // so it is intentionally retained as a real signal.
        const result = isUnproductivePokemonLookup(
            { pokemon: "Gyarados", format: "champions-regma" },
            'No usage statistics found for format "champions-regma".',
        );
        assert.equal(result, false);
    });

    it("keeps interactions with no pokemon arg even if the response says 'not found'", () => {
        const result = isUnproductivePokemonLookup(
            { type: "meta_threats", format: "gen9ou" },
            "No meta threats found.",
        );
        assert.equal(result, false);
    });

    it("ignores an empty pokemon arg", () => {
        const result = isUnproductivePokemonLookup({ pokemon: "" }, "anything not found");
        assert.equal(result, false);
    });
});
