import type { NextRequest } from "next/server";

/**
 * Admin API proxy — forwards requests to the MCP Worker's /admin/api/* endpoints.
 *
 * The Cloudflare Access JWT is automatically included via cookies set by the
 * Access login page. This proxy passes them through to the Worker.
 */

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const { path } = await params;
    const apiPath = path.join("/");
    const searchParams = request.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : "";

    const targetUrl = `${MCP_URL}/admin/api/${apiPath}${queryString}`;

    try {
        // Forward the request with Access credentials
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        // Pass through Cloudflare Access JWT if present
        const accessJwt = request.headers.get("Cf-Access-Jwt-Assertion");
        if (accessJwt) {
            headers["Cf-Access-Jwt-Assertion"] = accessJwt;
        }

        // Pass through cookies (includes CF_Authorization cookie)
        const cookie = request.headers.get("Cookie");
        if (cookie) {
            headers["Cookie"] = cookie;
        }

        const response = await fetch(targetUrl, { headers });

        const data = await response.text();
        return new Response(data, {
            status: response.status,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "private, max-age=30",
            },
        });
    } catch (error) {
        console.error("[Admin Proxy] Error:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to fetch admin data",
                details: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 502,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
}
