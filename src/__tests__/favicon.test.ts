import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { getFaviconResponse } from "../favicon.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe("connector favicon", () => {
    it("serves a well-formed .ico whose entries are PNG images", async () => {
        const response = getFaviconResponse("/favicon.ico", "GET");
        assert.equal(response?.status, 200);
        assert.equal(response?.headers.get("Content-Type"), "image/x-icon");

        const bytes = new Uint8Array(await response.arrayBuffer());
        const view = new DataView(bytes.buffer);
        assert.equal(view.getUint16(0, true), 0, "reserved field");
        assert.equal(view.getUint16(2, true), 1, "image type is icon");

        const count = view.getUint16(4, true);
        assert.ok(count >= 2, "holds more than one size");

        const sizes: number[] = [];
        let end = 6 + count * 16;
        for (let index = 0; index < count; index++) {
            const entry = 6 + index * 16;
            const length = view.getUint32(entry + 8, true);
            const offset = view.getUint32(entry + 12, true);
            sizes.push(view.getUint8(entry) || 256);
            assert.equal(offset, end, "images are packed in order with no gaps");
            assert.deepEqual([...bytes.slice(offset, offset + 4)], PNG_SIGNATURE);
            end = offset + length;
        }
        assert.equal(end, bytes.length, "entries account for the whole file");
        assert.ok(sizes.includes(32), "has the size browsers and favicon services ask for");
        assert.ok(sizes.includes(256), "has a large size for directory listings");
    });

    it("serves the same artwork as SVG", async () => {
        const response = getFaviconResponse("/favicon.svg", "GET");
        assert.equal(response?.headers.get("Content-Type"), "image/svg+xml");
        const svg = await response.text();
        assert.match(svg, /^<svg[^>]+viewBox="0 0 512 512"/);
        assert.doesNotMatch(svg, /<script|<image|href=/, "self-contained, no external content");
    });

    it("lets clients cache the icon and answers HEAD without a body", async () => {
        const head = getFaviconResponse("/favicon.ico", "HEAD");
        assert.equal(head?.status, 200);
        assert.match(head?.headers.get("Cache-Control") ?? "", /public/);
        assert.equal((await head.arrayBuffer()).byteLength, 0);
    });

    it("ignores other paths and methods", () => {
        assert.equal(getFaviconResponse("/favicon.png", "GET"), null);
        assert.equal(getFaviconResponse("/mcp", "GET"), null);
        assert.equal(getFaviconResponse("/favicon.ico", "POST"), null);
    });
});
