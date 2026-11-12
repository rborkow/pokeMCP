/**
 * Domain verification for OpenAI's plugin directory.
 *
 * When the connector is attached to a plugin, OpenAI's portal shows a challenge
 * token and fetches it from this path on the MCP server's own host. The reply
 * has to be the exact token as plain text and nothing else.
 *
 * The token is the `OPENAI_APPS_CHALLENGE` secret, so it can be set or changed
 * without a deploy:
 *
 *     bunx wrangler secret put OPENAI_APPS_CHALLENGE --env production
 *
 * It is not sensitive (this route publishes it); a secret is used only because
 * secrets survive deploys and take effect at once.
 */
export const OPENAI_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";

/** Returns the challenge reply, or null when the path, method or token does not apply. */
export function getOpenAiChallengeResponse(
    pathname: string,
    method: string,
    token: string | undefined,
): Response | null {
    if (pathname !== OPENAI_CHALLENGE_PATH) return null;
    if (method !== "GET" && method !== "HEAD") return null;

    const value = token?.trim();
    if (!value) return null;

    return new Response(method === "HEAD" ? null : value, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            // The token can be replaced at any time; never serve an old one.
            "Cache-Control": "no-store",
        },
    });
}
