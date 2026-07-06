import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Shared request guards for the paid AI streaming endpoints
 * (/api/ai/{claude,interview,report,meta-report}/stream):
 *
 * - Origin allowlist — blocks cross-origin POSTs from third-party pages.
 * - Per-IP rate limiting — prefers the Cloudflare Rate Limiting binding
 *   (shared across isolates; see wrangler.toml `unsafe.bindings`), falling
 *   back to a per-isolate in-memory Map when the binding is absent
 *   (`next dev`, vitest). The in-memory fallback sweeps expired entries
 *   lazily on access — module-scope setInterval is restricted on Workers.
 * - Body-size cap — rejects oversized request bodies before JSON parsing.
 */

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function jsonError(
    status: number,
    message: string,
    extraHeaders?: Record<string, string>,
): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...JSON_HEADERS, ...extraHeaders },
    });
}

/** Terse 400 for schema-validation failures. Never echoes the input back. */
export function validationError(message = "Invalid request"): Response {
    return jsonError(400, message);
}

// ---------------------------------------------------------------------------
// Origin check
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set([
    "https://www.pokemcp.com",
    "https://pokemcp.com",
    "http://localhost:3000",
]);

/**
 * Pure decision: is this Origin header value acceptable?
 *
 * Browsers always attach an Origin header to POST requests (same-origin
 * included), so in production a missing Origin means a non-browser client —
 * reject it. Outside production (curl against `next dev`, vitest) an absent
 * Origin is allowed.
 */
export function isOriginAllowed(origin: string | null, isProduction: boolean): boolean {
    if (origin) return ALLOWED_ORIGINS.has(origin);
    return !isProduction;
}

/** Returns a 403 JSON response when the request's Origin is unacceptable, else null. */
export function checkOrigin(request: Request): Response | null {
    const origin = request.headers.get("origin");
    if (isOriginAllowed(origin, process.env.NODE_ENV === "production")) return null;
    return jsonError(403, "Forbidden");
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/** Shape of a Cloudflare Rate Limiting binding (wrangler `unsafe.bindings`, type "ratelimit"). */
interface RateLimitBinding {
    limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface RateLimitRule {
    /** Route tag — namespaces the per-IP key so routes sharing a binding keep separate buckets. */
    route: string;
    /** Max requests per window. Must match the binding's `simple.limit` for that tier. */
    limit: number;
    /** Window for the in-memory fallback (the CF binding's period is fixed in wrangler.toml). */
    windowMs?: number;
    /** Name of the Cloudflare Rate Limiting binding to prefer when available. */
    bindingName: string;
}

export function getClientIp(request: Request): string {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown"
    );
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();
let lastSweepAt = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweepMemoryBuckets(now: number): void {
    if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
    lastSweepAt = now;
    for (const [key, entry] of memoryBuckets) {
        if (now > entry.resetAt) memoryBuckets.delete(key);
    }
}

/** Current number of tracked in-memory buckets. Exposed for tests. */
export function memoryBucketCount(): number {
    return memoryBuckets.size;
}

/**
 * In-memory fallback limiter (per-isolate, best-effort). Counts a request
 * against `key` and reports whether the caller exceeded `limit` within the
 * window. Expired entries are swept lazily on access.
 */
export function isMemoryRateLimited(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now(),
): boolean {
    sweepMemoryBuckets(now);
    const entry = memoryBuckets.get(key);
    if (!entry || now > entry.resetAt) {
        memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    entry.count++;
    return entry.count > limit;
}

function getRateLimitBinding(name: string): RateLimitBinding | undefined {
    try {
        const env = getCloudflareContext().env as unknown as Record<
            string,
            RateLimitBinding | undefined
        >;
        const binding = env[name];
        return binding && typeof binding.limit === "function" ? binding : undefined;
    } catch {
        // No Cloudflare context (next dev, vitest) — use the in-memory fallback.
        return undefined;
    }
}

/**
 * Returns a 429 JSON response when the client exceeded the rule's limit, else null.
 * Prefers the Cloudflare Rate Limiting binding; falls back to the in-memory Map.
 */
export async function checkRateLimit(
    request: Request,
    rule: RateLimitRule,
): Promise<Response | null> {
    const key = `${rule.route}:${getClientIp(request)}`;
    const binding = getRateLimitBinding(rule.bindingName);

    let limited: boolean;
    if (binding) {
        try {
            limited = !(await binding.limit({ key })).success;
        } catch {
            limited = isMemoryRateLimited(key, rule.limit, rule.windowMs ?? 60_000);
        }
    } else {
        limited = isMemoryRateLimited(key, rule.limit, rule.windowMs ?? 60_000);
    }

    if (!limited) return null;
    return jsonError(429, "Too many requests. Please wait a minute before trying again.", {
        "Retry-After": "60",
    });
}

// ---------------------------------------------------------------------------
// Body-size guard
// ---------------------------------------------------------------------------

export const MAX_BODY_BYTES = 128 * 1024;

export type GuardedBody = { ok: true; data: unknown } | { ok: false; response: Response };

/**
 * Reads and parses a JSON request body, rejecting bodies over `maxBytes`.
 * Checks the declared Content-Length first, then the actual text read
 * (UTF-16 code units are a lower bound on encoded bytes, which is
 * sufficient for a guard).
 */
export async function readJsonBody(
    request: Request,
    maxBytes: number = MAX_BODY_BYTES,
): Promise<GuardedBody> {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > maxBytes) {
        return { ok: false, response: jsonError(413, "Request body too large") };
    }

    let text: string;
    try {
        text = await request.text();
    } catch {
        return { ok: false, response: jsonError(400, "Unreadable request body") };
    }

    if (text.length > maxBytes) {
        return { ok: false, response: jsonError(413, "Request body too large") };
    }

    try {
        return { ok: true, data: JSON.parse(text) };
    } catch {
        return { ok: false, response: jsonError(400, "Invalid JSON body") };
    }
}
