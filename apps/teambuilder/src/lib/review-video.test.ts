// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { serveReviewVideo } from "./review-video";

const url = "https://www.pokemcp.com/review/vgc-teambuilder-demo.mp4";
function fixture() {
    return { fetch: vi.fn(async (request: Request) => new Response(
        request.method === "HEAD" ? null : new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]),
        { headers: { "Content-Type": "video/mp4", "Content-Length": "8", ETag: '"demo"' } },
    )) };
}

describe("review recording HTTP delivery", () => {
    it.each([
        ["bytes=0-1", "bytes 0-1/8", [0, 1]],
        ["bytes=5-", "bytes 5-7/8", [5, 6, 7]],
        ["bytes=-3", "bytes 5-7/8", [5, 6, 7]],
        ["bytes=6-99", "bytes 6-7/8", [6, 7]],
        ["bytes=-99", "bytes 0-7/8", [0, 1, 2, 3, 4, 5, 6, 7]],
    ])("serves %s with exact bytes", async (range, contentRange, expected) => {
        const assets = fixture();
        const response = await serveReviewVideo(new Request(url, { headers: { Range: range } }), assets);
        expect(response.status).toBe(206);
        expect(response.headers.get("Content-Range")).toBe(contentRange);
        expect(response.headers.get("Content-Length")).toBe(String(expected.length));
        expect(response.headers.get("Accept-Ranges")).toBe("bytes");
        expect(response.headers.get("Content-Type")).toBe("video/mp4");
        expect([...new Uint8Array(await response.arrayBuffer())]).toEqual(expected);
        expect(assets.fetch.mock.calls[0][0].headers.has("Range")).toBe(false);
    });

    it.each(["bytes=8-", "bytes=6-2", "bytes=-0", "bytes=99999999999999999-"])(
        "rejects unsatisfiable %s", async range => {
            const response = await serveReviewVideo(new Request(url, { headers: { Range: range } }), fixture());
            expect(response.status).toBe(416);
            expect(response.headers.get("Content-Range")).toBe("bytes */8");
            expect((await response.arrayBuffer()).byteLength).toBe(0);
        },
    );

    it.each([undefined, "nonsense", "bytes=-", "bytes=0-1,4-5"])(
        "returns the complete recording for %s", async range => {
            const response = await serveReviewVideo(new Request(url, {
                headers: range ? { Range: range } : {},
            }), fixture());
            expect(response.status).toBe(200);
            expect(response.headers.get("Accept-Ranges")).toBe("bytes");
            expect((await response.arrayBuffer()).byteLength).toBe(8);
        },
    );

    it("returns HEAD metadata without a body", async () => {
        const response = await serveReviewVideo(new Request(url, { method: "HEAD", headers: { Range: "bytes=0-1" } }), fixture());
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Length")).toBe("8");
        expect(response.headers.get("Accept-Ranges")).toBe("bytes");
        expect((await response.arrayBuffer()).byteLength).toBe(0);
    });

    it.each([['"demo"', 206], ['"stale"', 200], ['W/"demo"', 200]])(
        "honors If-Range %s", async (validator, status) => {
            const response = await serveReviewVideo(new Request(url, {
                headers: { Range: "bytes=0-1", "If-Range": validator },
            }), fixture());
            expect(response.status).toBe(status);
        },
    );

    it("preserves a missing asset response", async () => {
        const response = await serveReviewVideo(new Request(url), { fetch: async () => new Response(null, { status: 404 }) });
        expect(response.status).toBe(404);
    });

    it("rejects methods that cannot retrieve a recording", async () => {
        const assets = fixture();
        const response = await serveReviewVideo(new Request(url, { method: "POST" }), assets);
        expect(response.status).toBe(405);
        expect(response.headers.get("Allow")).toBe("GET, HEAD");
        expect(assets.fetch).not.toHaveBeenCalled();
    });
});
