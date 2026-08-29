/**
 * Cloudflare Access JWT validation for the dashboard routes.
 *
 * Ported from pokeMCP `src/admin.ts` (validateAccessJwt) so the monitor reuses
 * the same auth model: protect the report dashboard behind the same Access
 * application. In dev (no CF_ACCESS_TEAM_DOMAIN) auth is bypassed; in production
 * a missing team domain denies access fail-closed.
 */

interface AccessJwtPayload {
    iss: string;
    sub: string;
    email?: string;
    exp: number;
    iat: number;
}

export async function validateAccessJwt(
    request: Request,
    env: Env,
): Promise<AccessJwtPayload | null> {
    if (!env.CF_ACCESS_TEAM_DOMAIN) {
        if (env.ENVIRONMENT === "production") {
            console.error("[Auth] CF_ACCESS_TEAM_DOMAIN not set in production — denying access");
            return null;
        }
        console.warn("[Auth] Bypassed — CF_ACCESS_TEAM_DOMAIN not configured (dev mode)");
        return { iss: "dev", sub: "dev", email: "dev@localhost", exp: 0, iat: 0 };
    }

    const jwt =
        request.headers.get("Cf-Access-Jwt-Assertion") ||
        getCookieValue(request.headers.get("Cookie") || "", "CF_Authorization");

    if (!jwt) return null;

    try {
        const certsUrl = `https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
        const certsResponse = await fetch(certsUrl);
        if (!certsResponse.ok) return null;

        const certs = (await certsResponse.json()) as { keys: JsonWebKey[] };

        for (const jwk of certs.keys) {
            try {
                const key = await crypto.subtle.importKey(
                    "jwk",
                    jwk,
                    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
                    false,
                    ["verify"],
                );

                const parts = jwt.split(".");
                if (parts.length !== 3) continue;

                const [header, payload, signature] = parts;
                const data = new TextEncoder().encode(`${header}.${payload}`);
                const sig = base64UrlDecode(signature);

                const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sig, data);
                if (valid) {
                    const decoded = JSON.parse(atob(base64UrlToBase64(payload)));
                    if (decoded.exp && decoded.exp < Date.now() / 1000) continue;
                    return decoded as AccessJwtPayload;
                }
            } catch {
                // Key didn't verify, try the next one.
            }
        }
    } catch (error) {
        console.error("[Auth] JWT validation error:", error);
    }

    return null;
}

function getCookieValue(cookieHeader: string, name: string): string | null {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : null;
}

function base64UrlToBase64(base64Url: string): string {
    return base64Url.replace(/-/g, "+").replace(/_/g, "/");
}

function base64UrlDecode(base64Url: string): ArrayBuffer {
    const base64 = base64UrlToBase64(base64Url);
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
