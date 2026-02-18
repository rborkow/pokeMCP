import { initWasm, Resvg } from "@resvg/resvg-wasm";
// @ts-expect-error - WASM module import
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

import type { SharedTeam } from "../share.js";
import { renderTeamSvg } from "./team-image.js";

let wasmInitialized = false;

// Module-level font cache (persists across requests in same Worker instance)
let cachedFont: ArrayBuffer | null = null;

const FONT_URL =
    "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2";

async function getFont(): Promise<ArrayBuffer> {
    if (cachedFont) return cachedFont;
    const response = await fetch(FONT_URL);
    if (!response.ok) throw new Error(`Failed to fetch font: ${response.status}`);
    cachedFont = await response.arrayBuffer();
    return cachedFont;
}

/**
 * Render a shared team as a PNG image for OG previews.
 * Uses Satori (JSX -> SVG) + resvg-wasm (SVG -> PNG).
 */
export async function renderTeamOgImage(sharedTeam: SharedTeam): Promise<Uint8Array> {
    // Initialize resvg WASM (once per Worker lifecycle)
    if (!wasmInitialized) {
        await initWasm(resvgWasm);
        wasmInitialized = true;
    }

    const fontData = await getFont();
    const svg = await renderTeamSvg(sharedTeam, fontData);

    const resvg = new Resvg(svg, {
        fitTo: { mode: "width" as any, value: 1200 },
    });

    const rendered = resvg.render();
    return rendered.asPng();
}
