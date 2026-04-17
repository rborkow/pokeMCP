/**
 * Parser for the Pokémon Champions regulation allow-list HTML.
 *
 * The official Champions web-view is a static HTML page (not an API), so this
 * parser is intentionally defensive: it looks for three known shapes of
 * Pokémon list markup and throws when none yield a plausible count. Extracted
 * as a standalone module so the ingestion script stays thin and the parser
 * can be covered by unit tests without hitting the network.
 */

export interface ChampionsParseResult {
    names: string[];
    diagnostics: string[];
}

const MIN_PLAUSIBLE_POKEMON_COUNT = 50;

function decodeEntities(s: string): string {
    return s
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&eacute;/g, "é")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
}

/**
 * Extract Pokémon names from Champions legality HTML. Throws if the page
 * structure appears to have shifted (fewer than MIN_PLAUSIBLE_POKEMON_COUNT
 * entries found), so an upstream layout change surfaces as an explicit
 * failure instead of a silent empty allow-list.
 */
export function parseChampionsLegalityHtml(html: string): ChampionsParseResult {
    const diagnostics: string[] = [];
    const collected = new Set<string>();

    // Pattern 1: elements carrying data-pokemon="Name".
    const dataMatches = html.matchAll(/data-pokemon\s*=\s*"([^"]+)"/gi);
    for (const m of dataMatches) {
        const name = decodeEntities(m[1]).trim();
        if (name) collected.add(name);
    }
    if (collected.size > 0) {
        diagnostics.push(`data-pokemon attributes: ${collected.size} names`);
    }

    // Pattern 2: <li class="... pokemon-name ...">Name</li>.
    const liMatches = html.matchAll(/<li[^>]*class="[^"]*pokemon-name[^"]*"[^>]*>([^<]+)<\/li>/gi);
    let liCount = 0;
    for (const m of liMatches) {
        const name = decodeEntities(m[1]).trim();
        if (name) {
            collected.add(name);
            liCount++;
        }
    }
    if (liCount > 0) {
        diagnostics.push(`pokemon-name <li>s: ${liCount} names`);
    }

    // Pattern 3 (fallback): <span class="name">Name</span>. Filter obvious
    // non-Pokémon because .name is a generic class.
    if (collected.size < MIN_PLAUSIBLE_POKEMON_COUNT) {
        const spanMatches = html.matchAll(
            /<span[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)<\/span>/gi,
        );
        let spanCount = 0;
        for (const m of spanMatches) {
            const name = decodeEntities(m[1]).trim();
            if (name && /^[A-Z][A-Za-z'.\- 0-9:]+$/.test(name)) {
                collected.add(name);
                spanCount++;
            }
        }
        if (spanCount > 0) {
            diagnostics.push(`.name spans: ${spanCount} names`);
        }
    }

    const names = [...collected].sort();

    if (names.length < MIN_PLAUSIBLE_POKEMON_COUNT) {
        throw new Error(
            `Champions legality parser extracted only ${names.length} names. ` +
                `The page structure likely changed. Diagnostics: ${diagnostics.join("; ") || "none"}.`,
        );
    }

    return { names, diagnostics };
}
