import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { previousMonths } from "../../scripts/lib/months.js";
import { checkIndex } from "../../scripts/lib/verify-index.js";

const FORMAT = "gen9championsvgc2026regmc";
const fetched = {
    date: "2026-10",
    data: {
        info: { "number of battles": 1649648 },
        data: { Rillaboom: { usage: 0.35 }, Sneasler: { usage: 0.36 } },
    },
};
const index = (battles: number, names = ["Rillaboom", "Sneasler"]) =>
    JSON.stringify({
        version: 2,
        info: { "number of battles": battles },
        pokemon: Object.fromEntries(names.map((n) => [n, 0.3])),
    });

describe("checkIndex", () => {
    it("passes when KV holds the snapshot that was fetched", () => {
        assert.equal(checkIndex(FORMAT, fetched, index(1649648)), null);
    });

    it("fails when the key is missing", () => {
        assert.match(checkIndex(FORMAT, fetched, null) ?? "", /did not take effect/);
    });

    it("fails when KV still holds an older month", () => {
        assert.match(checkIndex(FORMAT, fetched, index(1631943)) ?? "", /stale.*2026-10/);
    });

    it("fails when the Pokémon count differs", () => {
        assert.match(checkIndex(FORMAT, fetched, index(1649648, ["Rillaboom"])) ?? "", /lists 1/);
    });

    it("fails on a malformed or legacy index", () => {
        assert.match(checkIndex(FORMAT, fetched, "not json") ?? "", /not valid JSON/);
        assert.match(checkIndex(FORMAT, fetched, JSON.stringify({ data: {} })) ?? "", /version 2/);
    });

    it("fails when the fetched file itself is unusable", () => {
        assert.match(checkIndex(FORMAT, { date: "2026-10" }, index(1)) ?? "", /no usable data/);
    });
});

describe("previousMonths", () => {
    it("walks back most recent first", () => {
        assert.deepEqual(previousMonths("2026-10", 3), ["2026-09", "2026-08", "2026-07"]);
    });

    it("crosses a year boundary", () => {
        assert.deepEqual(previousMonths("2026-01", 2), ["2025-12", "2025-11"]);
    });
});
