import type { TeamPokemon } from "@/types/pokemon";
import { exportShowdownTeam, parseShowdownTeam } from "./showdown-parser";

/**
 * Encode a team and format into a shareable URL parameter
 * Uses Showdown format compressed with base64
 */
export function encodeTeamForUrl(team: TeamPokemon[], format: string): string {
    if (team.length === 0) return "";

    const showdownText = exportShowdownTeam(team);
    // Prefix with format for context
    const dataToEncode = `${format}\n---\n${showdownText}`;

    // Use base64 encoding (URL-safe variant)
    const base64 = btoa(unescape(encodeURIComponent(dataToEncode)));
    // Make URL-safe: replace + with -, / with _, remove =
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL parameter back into team and format
 */
export function decodeTeamFromUrl(encoded: string): { team: TeamPokemon[]; format: string } | null {
    if (!encoded) return null;

    try {
        // Restore standard base64: replace - with +, _ with /, add padding
        let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if needed
        while (base64.length % 4) {
            base64 += "=";
        }

        const decoded = decodeURIComponent(escape(atob(base64)));

        // Split format from team data
        const separatorIndex = decoded.indexOf("\n---\n");
        if (separatorIndex === -1) {
            // No format prefix, assume gen9ou
            return {
                format: "gen9ou",
                team: parseShowdownTeam(decoded),
            };
        }

        const format = decoded.slice(0, separatorIndex).trim();
        const showdownText = decoded.slice(separatorIndex + 5); // Skip "\n---\n"

        return {
            format,
            team: parseShowdownTeam(showdownText),
        };
    } catch (error) {
        console.error("Failed to decode team from URL:", error);
        return null;
    }
}

/**
 * Generate a full shareable URL for a team
 */
export function generateShareUrl(team: TeamPokemon[], format: string): string {
    const encoded = encodeTeamForUrl(team, format);
    if (!encoded) return "";

    // Use current origin or fallback
    const origin =
        typeof window !== "undefined" ? window.location.origin : "https://www.pokemcp.com";

    return `${origin}?team=${encoded}`;
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        // Fallback for non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        return success;
    } catch {
        return false;
    }
}
