import { describe, expect, it } from "vitest";
import {
    checkOrigin,
    checkRateLimit,
    getClientIp,
    isMemoryRateLimited,
    isOriginAllowed,
    MAX_BODY_BYTES,
    memoryBucketCount,
    readJsonBody,
} from "@/lib/api/ai-guard";

const ROUTE_URL = "http://localhost:3000/api/ai/claude/stream";

describe("ai-guard origin allowlist", () => {
    it("allows the production origins", () => {
        expect(isOriginAllowed("https://www.pokemcp.com", true)).toBe(true);
        expect(isOriginAllowed("https://pokemcp.com", true)).toBe(true);
    });

    it("allows localhost for dev", () => {
        expect(isOriginAllowed("http://localhost:3000", false)).toBe(true);
        expect(isOriginAllowed("http://localhost:3000", true)).toBe(true);
    });

    it("rejects third-party origins in every environment", () => {
        expect(isOriginAllowed("https://evil.example", true)).toBe(false);
        expect(isOriginAllowed("https://evil.example", false)).toBe(false);
        expect(isOriginAllowed("https://pokemcp.com.evil.example", true)).toBe(false);
        expect(isOriginAllowed("null", true)).toBe(false);
    });

    it("rejects an absent Origin in production but allows it in dev", () => {
        expect(isOriginAllowed(null, true)).toBe(false);
        expect(isOriginAllowed(null, false)).toBe(true);
    });

    it("checkOrigin returns null for an allowlisted origin", () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { origin: "https://www.pokemcp.com" },
        });
        expect(checkOrigin(request)).toBeNull();
    });

    it("checkOrigin returns a 403 JSON response for a foreign origin", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { origin: "https://evil.example" },
        });
        const response = checkOrigin(request);
        expect(response).not.toBeNull();
        expect(response?.status).toBe(403);
        const data = (await response?.json()) as { error: string };
        expect(data.error).toBeTruthy();
    });
});

describe("ai-guard client IP extraction", () => {
    it("prefers cf-connecting-ip", () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" },
        });
        expect(getClientIp(request)).toBe("1.2.3.4");
    });

    it("falls back to the first x-forwarded-for hop", () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
        });
        expect(getClientIp(request)).toBe("5.6.7.8");
    });

    it("returns 'unknown' when no IP headers exist", () => {
        expect(getClientIp(new Request(ROUTE_URL, { method: "POST" }))).toBe("unknown");
    });
});

describe("ai-guard in-memory rate limiter", () => {
    it("allows requests up to the limit, then rejects", () => {
        const t0 = Date.now();
        for (let i = 0; i < 6; i++) {
            expect(isMemoryRateLimited("limit:basic", 6, 60_000, t0 + i)).toBe(false);
        }
        expect(isMemoryRateLimited("limit:basic", 6, 60_000, t0 + 10)).toBe(true);
    });

    it("resets the bucket after the window elapses", () => {
        const t0 = Date.now();
        expect(isMemoryRateLimited("limit:reset", 1, 60_000, t0)).toBe(false);
        expect(isMemoryRateLimited("limit:reset", 1, 60_000, t0 + 1)).toBe(true);
        expect(isMemoryRateLimited("limit:reset", 1, 60_000, t0 + 60_001)).toBe(false);
    });

    it("tracks separate buckets per key", () => {
        const t0 = Date.now();
        expect(isMemoryRateLimited("limit:a", 1, 60_000, t0)).toBe(false);
        expect(isMemoryRateLimited("limit:a", 1, 60_000, t0 + 1)).toBe(true);
        expect(isMemoryRateLimited("limit:b", 1, 60_000, t0 + 2)).toBe(false);
    });

    it("checkRateLimit falls back to the in-memory limiter and returns 429 over the limit", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { "cf-connecting-ip": "203.0.113.7" },
        });
        const rule = { route: "test-fallback", limit: 2, bindingName: "MISSING_BINDING" };
        expect(await checkRateLimit(request, rule)).toBeNull();
        expect(await checkRateLimit(request, rule)).toBeNull();
        const response = await checkRateLimit(request, rule);
        expect(response?.status).toBe(429);
        expect(response?.headers.get("Retry-After")).toBe("60");
    });

    it("sweeps expired buckets lazily on access", () => {
        // A far-future base makes every previously created bucket expired
        // relative to base + 61s, so the sweep leaves exactly one entry.
        const base = Date.now() + 10_000_000;
        isMemoryRateLimited("sweep:x", 5, 1_000, base);
        isMemoryRateLimited("sweep:y", 5, 1_000, base);
        expect(memoryBucketCount()).toBeGreaterThanOrEqual(2);
        isMemoryRateLimited("sweep:z", 5, 1_000, base + 61_000);
        expect(memoryBucketCount()).toBe(1);
    });
});

describe("ai-guard body-size guard", () => {
    it("parses a normal JSON body", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            body: JSON.stringify({ message: "hello" }),
        });
        const result = await readJsonBody(request);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.data).toEqual({ message: "hello" });
        }
    });

    it("rejects a body whose declared Content-Length exceeds the cap", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            headers: { "content-length": String(MAX_BODY_BYTES + 1) },
            body: "{}",
        });
        const result = await readJsonBody(request);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response.status).toBe(413);
        }
    });

    it("rejects an oversized body read", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            body: `{"message":"${"x".repeat(MAX_BODY_BYTES)}"}`,
        });
        const result = await readJsonBody(request);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response.status).toBe(413);
        }
    });

    it("rejects malformed JSON with a 400", async () => {
        const request = new Request(ROUTE_URL, {
            method: "POST",
            body: "not json at all",
        });
        const result = await readJsonBody(request);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.response.status).toBe(400);
            const data = (await result.response.json()) as { error: string };
            expect(data.error).toBe("Invalid JSON body");
        }
    });
});
