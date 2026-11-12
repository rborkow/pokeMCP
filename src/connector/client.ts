/**
 * Which assistant a request comes from, for usage reporting.
 *
 * Only the software is identified, never a person: the family is derived from
 * the client name an MCP client reports when it connects and from the
 * User-Agent of its HTTP requests.
 */
export type ClientFamily = "claude" | "chatgpt" | "other";

/** Classify by the reported client name first, then by the User-Agent. */
export function classifyClient(
    clientName: string | null | undefined,
    userAgent: string | null | undefined,
): ClientFamily {
    for (const value of [clientName, userAgent]) {
        if (!value) continue;
        if (/claude|anthropic/i.test(value)) return "claude";
        if (/openai|chatgpt/i.test(value)) return "chatgpt";
    }
    return "other";
}

/**
 * The product name at the start of a User-Agent ("python-httpx" from
 * "python-httpx/0.27.0"), without versions or the rest of the string. Kept so
 * a client the classifier does not recognise can still be told apart.
 */
export function userAgentProduct(userAgent: string | null | undefined): string {
    if (!userAgent) return "";
    const match = /^[A-Za-z0-9._-]+/.exec(userAgent.trim());
    return match ? match[0].slice(0, 40) : "";
}

/** A reported client name or version, trimmed to something safe to store and show. */
export function cleanClientLabel(value: string | undefined): string {
    if (!value) return "";
    return value
        .replace(/[^\w .@/+-]/g, "")
        .trim()
        .slice(0, 60);
}
