import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadUsageFromDir } from "../usage.js";
import { getUsage } from "./get-usage.js";

describe("get_usage", {
    skip: loadUsageFromDir().length === 0 && "no usage data cached",
}, () => {
    it("returns a ranking with month + cutoff header", async () => {
        const out = await getUsage({ type: "ranking", limit: 5 });
        assert.match(
            out,
            /Usage — gen9championsvgc2026reg\w+ \(\d{4}-\d{2}, cutoff \d+, [\d,]+ battles\)/,
        );
        assert.match(out, /1\. \w+/);
    });
    it("returns a Pokémon profile with spreads as Stat Points", async () => {
        const out = await getUsage({ type: "pokemon", pokemon: "Kingambit" });
        assert.match(out, /Spreads/);
        assert.match(out, /[A-Z][a-z]+:\d+\/\d+\/\d+\/\d+\/\d+\/\d+/);
    });
    it("resolves item/move/ability ids to display names", async () => {
        const out = await getUsage({ type: "pokemon", pokemon: "kingambit" });
        assert.match(out, /Black Glasses/);
        assert.doesNotMatch(out, /blackglasses/);
    });
    it("warns when falling back to the previous regulation", async () => {
        const out = await getUsage({ type: "ranking", limit: 1 });
        // Until the 2026-09 dump lands there is no M-C file, so the fallback banner must show.
        if (!loadUsageFromDir().some((b) => b.format === "gen9championsvgc2026regmc")) {
            assert.match(out, /previous regulation|Reg M-B/);
        }
    });
    it("reports an unknown Pokémon the same way for every per-Pokémon view", async () => {
        const expected =
            /Nopemon not in this month's data \(usage below the 0\.5% cache cutoff, or check the Showdown display name\)\./;
        for (const type of ["pokemon", "teammates", "counters"] as const) {
            assert.match(await getUsage({ type, pokemon: "Nopemon" }), expected, `type=${type}`);
        }
    });
});
