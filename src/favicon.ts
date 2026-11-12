/**
 * The connector's icon, served from the MCP server's own domain.
 *
 * Directories and MCP clients show the favicon of the host a connector is
 * served from, which is api.pokemcp.com, not the website. The artwork is
 * generated into favicon-data.ts by `bun run generate-connector-icon`.
 */
import { FAVICON_ICO_BASE64, FAVICON_SVG } from "./favicon-data.js";

// The icon only changes on deploy; a day keeps a replaced icon from lingering.
const CACHE_CONTROL = "public, max-age=86400";

let icoBytes: Uint8Array | null = null;

function getIco(): Uint8Array {
    if (!icoBytes) {
        const binary = atob(FAVICON_ICO_BASE64);
        icoBytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    }
    return icoBytes;
}

/** Returns the icon for `/favicon.ico` and `/favicon.svg`, otherwise null. */
export function getFaviconResponse(pathname: string, method: string): Response | null {
    if (method !== "GET" && method !== "HEAD") return null;

    if (pathname === "/favicon.ico") {
        return new Response(method === "HEAD" ? null : getIco(), {
            headers: { "Content-Type": "image/x-icon", "Cache-Control": CACHE_CONTROL },
        });
    }
    if (pathname === "/favicon.svg") {
        return new Response(method === "HEAD" ? null : FAVICON_SVG, {
            headers: { "Content-Type": "image/svg+xml", "Cache-Control": CACHE_CONTROL },
        });
    }
    return null;
}
