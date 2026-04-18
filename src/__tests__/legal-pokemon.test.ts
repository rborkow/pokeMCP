/**
 * Tests for the getLegalPokemon helper.
 *
 * Uses node:test + tsx (consistent with other src/__tests__/ suites).
 *
 * Champions formats need a live KV binding; they're marked .todo here and
 * covered in a dedicated integration test harness as a follow-up.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { getLegalPokemon } from "../legal-pokemon.js";

// Mock env only needed for Champions branch; pass undefined for non-Champions.
const ENV_STUB = undefined as unknown as Env;

describe("getLegalPokemon", () => {
    it("returns a non-empty list for gen9ou", async () => {
        const result = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        assert.ok(result.legal.length > 100, `expected >100 entries, got ${result.legal.length}`);
    });

    it("returns only canonical IDs (lowercase alphanumerics)", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        for (const id of legal) {
            assert.match(id, /^[a-z0-9]+$/, `ID "${id}" is not lowercase alphanumeric`);
        }
    });

    it("excludes Uber/AG species in gen9ou", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        // Koraidon is tier: "Uber" and Miraidon is tier: "AG" in Gen 9
        assert.ok(!legal.includes("koraidon"), "koraidon (Uber) should be excluded from gen9ou");
        assert.ok(!legal.includes("miraidon"), "miraidon (AG) should be excluded from gen9ou");
    });

    it("includes Uber species in gen9ubers", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ubers" }, ENV_STUB);
        assert.ok(legal.includes("koraidon"), "koraidon should be in gen9ubers");
    });

    it("excludes Past-only forms from Gen 9 formats", async () => {
        const { legal } = await getLegalPokemon({ format: "gen9ou" }, ENV_STUB);
        // Mega evolutions are "Past" in Gen 9 and should not appear
        assert.ok(
            !legal.includes("charizardmegax"),
            "charizardmegax (Past) should be excluded from gen9ou",
        );
    });

    it("returns an empty array for unknown formats", async () => {
        const { legal } = await getLegalPokemon({ format: "totally-fake" }, ENV_STUB);
        assert.deepEqual(legal, []);
    });

    // Champions formats need a KV binding to hydrate their allow-list.
    // Add a dedicated integration test under a separate worker-test harness
    // as follow-up; left as a comment so the red flag is visible.
    // it.todo("returns the regulation allow-list for Champions formats");
});
