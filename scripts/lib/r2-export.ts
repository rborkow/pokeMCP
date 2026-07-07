/**
 * Pure helpers for the R2 interaction-log export (scripts/export-logs.ts).
 *
 * Wrangler v4 removed `r2 object list`, so the export lists objects through the
 * Cloudflare REST API (`GET /accounts/{account_id}/r2/buckets/{bucket}/objects`).
 * These helpers are kept free of I/O so the response parsing and date-prefix
 * construction can be unit-tested (src/__tests__/r2-export.test.ts).
 */

/** One page of a Cloudflare R2 object listing, reduced to what the export needs. */
export interface R2ListPage {
    /** Object keys on this page. */
    keys: string[];
    /** Cursor for the next page, or undefined when this is the last page. */
    cursor?: string;
}

/**
 * Build the `logs/YYYY/MM/DD/` prefixes (UTC) to scan for the last `days` days,
 * or the whole `logs/` tree when `all` is set.
 */
export function getDatePrefixes(days: number, all: boolean, now: Date = new Date()): string[] {
    if (all) {
        return ["logs/"]; // Will list all
    }

    const prefixes: string[] = [];

    for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - i);

        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(date.getUTCDate()).padStart(2, "0");

        prefixes.push(`logs/${year}/${month}/${day}/`);
    }

    return prefixes;
}

/**
 * Parse one page of the Cloudflare REST list-objects response envelope.
 *
 * Throws when the envelope reports failure or has an unexpected shape — a
 * malformed or failed response must never be mistaken for "no logs".
 * A successful response with an empty `result` array is a genuinely empty
 * prefix and parses to `{ keys: [] }`.
 */
export function parseR2ListPage(body: unknown): R2ListPage {
    if (typeof body !== "object" || body === null) {
        throw new Error(`unexpected list response body: ${JSON.stringify(body)}`);
    }

    const envelope = body as {
        success?: boolean;
        errors?: Array<{ code?: number; message?: string }>;
        result?: Array<{ key?: string }>;
        result_info?: { cursor?: string; is_truncated?: boolean };
    };

    if (envelope.success !== true) {
        const errors = (envelope.errors ?? [])
            .map((err) => `${err.code ?? "?"}: ${err.message ?? "unknown error"}`)
            .join("; ");
        throw new Error(`Cloudflare API reported failure: ${errors || JSON.stringify(body)}`);
    }

    if (!Array.isArray(envelope.result)) {
        throw new Error(`list response has no result array: ${JSON.stringify(body)}`);
    }

    const keys: string[] = [];
    for (const object of envelope.result) {
        if (typeof object?.key === "string") {
            keys.push(object.key);
        }
    }

    // Paginate while the API says the listing is truncated. If is_truncated is
    // missing, fall back to "cursor present and this page was non-empty" so a
    // stale cursor on an empty page can never loop forever.
    const info = envelope.result_info;
    const truncated = info?.is_truncated ?? (Boolean(info?.cursor) && keys.length > 0);
    const cursor = truncated && info?.cursor ? info.cursor : undefined;

    return { keys, cursor };
}
