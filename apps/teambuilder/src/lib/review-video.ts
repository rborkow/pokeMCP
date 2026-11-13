export const REVIEW_VIDEO_PATH = "/review/vgc-teambuilder-demo.mp4";

/** Add single byte-range support for the one bundled review recording. */
export async function serveReviewVideo(
    request: Request,
    assets: { fetch(request: Request): Promise<Response> },
): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    // Fetch the complete asset: Workers Static Assets ignores Range itself.
    const asset = await assets.fetch(new Request(request.url, { method: request.method }));
    if (asset.status !== 200) return asset;
    const headers = new Headers(asset.headers);
    headers.set("Accept-Ranges", "bytes");
    if (request.method === "HEAD") return new Response(null, { headers });

    const range = request.headers.get("Range");
    const ifRange = request.headers.get("If-Range");
    const etag = headers.get("ETag");
    const modified = headers.get("Last-Modified");
    const matchesValidator = !ifRange ||
        (ifRange === etag && !ifRange.startsWith("W/")) ||
        (modified !== null && Number.isFinite(Date.parse(ifRange)) &&
            Date.parse(ifRange) >= Date.parse(modified));
    const match = range?.match(/^bytes=(\d*)-(\d*)$/);
    // Invalid or multiple ranges are ignored, as permitted by HTTP semantics.
    if (!match || (!match[1] && !match[2]) || !matchesValidator) {
        return new Response(asset.body, { headers });
    }

    // This is a fixed, bundled file, bounded by the static-assets 25 MiB limit.
    const bytes = await asset.arrayBuffer();
    const size = bytes.byteLength;
    const suffix = !match[1];
    const first = Number(match[1]);
    const last = Number(match[2]);
    const start = suffix ? Math.max(0, size - last) : first;
    const end = suffix || !match[2] ? size - 1 : Math.min(last, size - 1);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) ||
        start >= size || end < start || (suffix && last === 0)) {
        headers.set("Content-Range", `bytes */${size}`);
        headers.set("Content-Length", "0");
        return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
