/**
 * Fetch and cache the Pokémon Champions regulation allow-list.
 *
 * For Reg M-A the canonical source is the official web-view page hosted by
 * The Pokémon Company. The URL structure
 *   https://web-view.app.pokemonchampions.jp/battle/pages/events/<event-id>/en/pokemon.html
 * suggests a fresh event-id per regulation, so this script accepts the URL
 * as an argument (default: Reg M-A) and fails loudly if the page structure
 * shifts or the upload produces fewer than the plausibility threshold of
 * Pokémon.
 *
 * Output: writes src/cached-champions-legality/<regulation-id>.json. Run
 * `npm run upload-champions-legality` to push into KV under the regulation's
 * legalityKvKey.
 *
 * Usage:
 *   npm run fetch-champions-legality                    # Reg M-A default
 *   npm run fetch-champions-legality -- champions-regma https://...custom.html
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseChampionsLegalityHtml } from "../src/regulations/champions-html-parser.js";
import { CHAMPIONS_REGMA } from "../src/regulations/champions-regma.js";
import { REGULATIONS } from "../src/regulations/registry.js";
import type { LegalityKvBlob, RegulationSet } from "../src/regulations/types.js";

const CACHE_DIR = join(process.cwd(), "src", "cached-champions-legality");
const SCHEMA_VERSION = 1;

async function fetchLegality(
    regulation: RegulationSet,
    overrideUrl?: string,
): Promise<LegalityKvBlob> {
    const url = overrideUrl || regulation.officialLegalityUrl;
    if (!url) {
        throw new Error(`Regulation ${regulation.id} has no officialLegalityUrl configured.`);
    }

    console.log(`Fetching ${url}`);
    const response = await fetch(url, {
        headers: {
            "User-Agent": "pokeMCP-legality-ingestion/1.0 (+https://pokemcp.com)",
            Accept: "text/html",
        },
    });
    if (!response.ok) {
        throw new Error(
            `Fetch failed: HTTP ${response.status} ${response.statusText}. ` +
                "If the regulation rotated, pass a new URL as the second argument.",
        );
    }
    const html = await response.text();
    console.log(`Fetched ${html.length.toLocaleString()} bytes of HTML`);

    const { names, diagnostics } = parseChampionsLegalityHtml(html);
    console.log(`Parsed ${names.length} Pokémon names`);
    for (const d of diagnostics) console.log(`  ${d}`);

    return {
        regulationId: regulation.id,
        fetchedAt: new Date().toISOString(),
        sourceUrl: url,
        version: SCHEMA_VERSION,
        pokemon: names,
    };
}

async function main() {
    const [regulationId = "champions-regma", overrideUrl] = process.argv.slice(2);

    const regulation =
        REGULATIONS.find((r) => r.id === regulationId) ||
        (regulationId === "champions-regma" ? CHAMPIONS_REGMA : undefined);
    if (!regulation) {
        throw new Error(
            `Unknown regulation id "${regulationId}". Known: ${REGULATIONS.map((r) => r.id).join(", ")}`,
        );
    }

    const blob = await fetchLegality(regulation, overrideUrl);

    mkdirSync(CACHE_DIR, { recursive: true });
    const outPath = join(CACHE_DIR, `${regulation.id}.json`);
    writeFileSync(outPath, JSON.stringify(blob, null, 2));
    console.log(`\nWrote ${outPath}`);
    console.log(
        "Upload with: npm run upload-champions-legality (or wrangler kv key put " +
            `--remote --namespace-id=... "${regulation.legalityKvKey}" --path="${outPath}")`,
    );
}

main().catch((e) => {
    console.error("Champions legality ingestion failed:", e);
    process.exit(1);
});
