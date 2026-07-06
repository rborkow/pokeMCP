/**
 * Regression tests for the query_strategy pokemon filter.
 *
 * Vectorize metadata stores display names ("Great Tusk", "Landorus-Therian"),
 * while the old code passed `pokemon.toLowerCase()` into an exact-match
 * metadata filter — which therefore never matched. The fix post-filters
 * returned matches with a toID-normalized comparison instead.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { matchesPokemon } from "../rag/search.js";

describe("matchesPokemon", () => {
    it("matches display-name metadata against lowercased input", () => {
        assert.ok(matchesPokemon("Great Tusk", "great tusk"));
    });

    it("matches display-name metadata against toID-style input", () => {
        assert.ok(matchesPokemon("Great Tusk", "greattusk"));
    });

    it("matches hyphenated forms regardless of casing and punctuation", () => {
        assert.ok(matchesPokemon("Landorus-Therian", "landorustherian"));
        assert.ok(matchesPokemon("Landorus-Therian", "Landorus-Therian"));
        assert.ok(matchesPokemon("Landorus-Therian", "landorus therian"));
    });

    it("does not match a different Pokemon", () => {
        assert.ok(!matchesPokemon("Great Tusk", "Iron Valiant"));
        assert.ok(!matchesPokemon("Landorus-Therian", "Landorus"));
    });

    it("rejects non-string metadata (older vectors / missing field)", () => {
        assert.ok(!matchesPokemon(undefined, "Great Tusk"));
        assert.ok(!matchesPokemon(null, "Great Tusk"));
        assert.ok(!matchesPokemon(42, "Great Tusk"));
    });
});
