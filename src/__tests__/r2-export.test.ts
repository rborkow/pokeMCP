import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDatePrefixes, parseR2ListPage } from "../../scripts/lib/r2-export.js";

describe("getDatePrefixes", () => {
    it("returns the bare logs/ prefix when exporting all", () => {
        assert.deepEqual(getDatePrefixes(7, true), ["logs/"]);
    });

    it("builds one UTC day prefix per day, newest first", () => {
        const now = new Date("2026-07-07T12:00:00Z");
        assert.deepEqual(getDatePrefixes(3, false, now), [
            "logs/2026/07/07/",
            "logs/2026/07/06/",
            "logs/2026/07/05/",
        ]);
    });

    it("rolls across month and year boundaries", () => {
        const now = new Date("2026-01-01T00:30:00Z");
        assert.deepEqual(getDatePrefixes(2, false, now), ["logs/2026/01/01/", "logs/2025/12/31/"]);
    });
});

describe("parseR2ListPage", () => {
    it("extracts keys and reports no cursor on the final page", () => {
        const page = parseR2ListPage({
            success: true,
            errors: [],
            result: [{ key: "logs/2026/07/07/a.json" }, { key: "logs/2026/07/07/b.json" }],
            result_info: { cursor: "", is_truncated: false, per_page: 1000 },
        });
        assert.deepEqual(page.keys, ["logs/2026/07/07/a.json", "logs/2026/07/07/b.json"]);
        assert.equal(page.cursor, undefined);
    });

    it("returns the cursor while the listing is truncated", () => {
        const page = parseR2ListPage({
            success: true,
            result: [{ key: "logs/2026/07/07/a.json" }],
            result_info: { cursor: "next-cursor", is_truncated: true },
        });
        assert.equal(page.cursor, "next-cursor");
    });

    it("falls back to cursor presence when is_truncated is missing", () => {
        const withKeys = parseR2ListPage({
            success: true,
            result: [{ key: "logs/2026/07/07/a.json" }],
            result_info: { cursor: "next-cursor" },
        });
        assert.equal(withKeys.cursor, "next-cursor");

        // An empty page with a leftover cursor must terminate pagination.
        const emptyPage = parseR2ListPage({
            success: true,
            result: [],
            result_info: { cursor: "stale-cursor" },
        });
        assert.equal(emptyPage.cursor, undefined);
    });

    it("treats an empty result as a genuinely empty prefix", () => {
        const page = parseR2ListPage({ success: true, errors: [], result: [] });
        assert.deepEqual(page, { keys: [], cursor: undefined });
    });

    it("throws when the envelope reports failure, including the API errors", () => {
        assert.throws(
            () =>
                parseR2ListPage({
                    success: false,
                    errors: [{ code: 10000, message: "Authentication error" }],
                    result: null,
                }),
            /10000: Authentication error/,
        );
    });

    it("throws on a body with no result array instead of returning empty", () => {
        assert.throws(() => parseR2ListPage({ success: true }), /no result array/);
    });

    it("throws on a non-object body", () => {
        assert.throws(() => parseR2ListPage("<html>gateway error</html>"), /unexpected/i);
        assert.throws(() => parseR2ListPage(null), /unexpected/i);
    });
});
