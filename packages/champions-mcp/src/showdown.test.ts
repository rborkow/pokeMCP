import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { CHAMPIONS_FORMAT_ID, championsDex, showdown } from "./showdown.js";

describe("showdown loader", () => {
    it("loads the vendored sim with the Reg M-C format", () => {
        const format = showdown.Dex.formats.get(CHAMPIONS_FORMAT_ID);
        assert.equal(format.exists, true);
        assert.equal(format.mod, "champions");
        assert.equal(format.gameType, "doubles");
    });
    it("exposes Champions-only Megas from the champions mod", () => {
        const golisopod = championsDex.species.get("Golisopod-Mega");
        assert.equal(golisopod.exists, true);
        assert.deepEqual(golisopod.types, ["Bug", "Steel"]);
        assert.equal(golisopod.requiredItem, "Golisopite");
        assert.equal(championsDex.species.get("Rillaboom").tier, "OU");
    });
});
