import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { metaSnapshot } from "./meta-snapshot.js";

describe("meta_snapshot", () => {
    it("reports regulation, both usage views and freshness", async () => {
        const out = await metaSnapshot({});
        assert.match(out, /Regulation:/);
        assert.match(out, /Ladder usage:/);
        assert.match(out, /Tournament top-cut/);
        assert.match(out, /Freshness/);
    });
});
