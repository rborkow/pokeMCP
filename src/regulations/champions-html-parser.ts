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
 * Normalize a Champions-page display name to a Showdown species name.
 *
 * The M-A page listed forms already in Showdown shape (e.g. "Rotom-Wash",
 * "Landorus-Therian"), but the M-B page (2026-07) switched to parenthetical
 * labels — "Rotom (Wash Rotom)", "Raichu (Alolan Form)", "Tauros (Paldean
 * Form (Combat Breed))". Those toID() to strings that match no Showdown
 * species, so the validator would wrongly flag every alt-form as illegal.
 * This maps the known parenthetical shapes back to Showdown names; plain
 * names (no parenthetical) and already-Showdown names pass through unchanged.
 *
 * Throws on an unrecognized parenthetical so a new form shape surfaces as an
 * explicit ingestion failure rather than a silently-dropped or mis-ID'd mon.
 */
export function normalizeChampionsFormName(displayName: string): string {
    const name = displayName.trim();
    const parenIdx = name.indexOf(" (");
    if (parenIdx === -1) return name; // plain species, or already Showdown-shaped

    const base = name.slice(0, parenIdx).trim();
    const inner = name.slice(parenIdx).trim(); // e.g. "(Alolan Form)"

    // Paldean breeds carry a nested parenthetical — check before generic rules.
    const paldeanBreed = inner.match(/Paldean Form \((Combat|Blaze|Aqua) Breed\)/);
    if (paldeanBreed) return `${base}-Paldea-${paldeanBreed[1]}`;
    if (/Paldean Form/.test(inner)) return `${base}-Paldea`;

    // Regional forms.
    if (/Alolan Form/.test(inner)) return `${base}-Alola`;
    if (/Galarian Form/.test(inner)) return `${base}-Galar`;
    if (/Hisuian Form/.test(inner)) return `${base}-Hisui`;

    // Rotom appliances: "(Rotom)" is the base; "(Heat Rotom)" → Rotom-Heat, etc.
    if (base === "Rotom") {
        if (inner === "(Rotom)") return "Rotom";
        const appliance = inner.match(/\((Heat|Wash|Frost|Fan|Mow) Rotom\)/);
        if (appliance) return `Rotom-${appliance[1]}`;
    }

    // Gendered species: male is the base form, female gets the -F suffix.
    if (inner === "(Male)") return base;
    if (inner === "(Female)") return `${base}-F`;

    // Gourgeist/Pumpkaboo size varieties (Medium is Showdown's base "Average").
    if (/Medium Variety/.test(inner)) return base;
    if (/Small Variety/.test(inner)) return `${base}-Small`;
    if (/Large Variety/.test(inner)) return `${base}-Large`;
    if (/Jumbo Variety/.test(inner)) return `${base}-Super`;

    // Lycanroc: Midday is the base; Midnight/Dusk are suffixed forms.
    const lycanroc = inner.match(/^\((Midday|Midnight|Dusk) Form\)$/);
    if (lycanroc) return lycanroc[1] === "Midday" ? base : `${base}-${lycanroc[1]}`;

    throw new Error(
        `Unrecognized Champions form name "${displayName}". Add a mapping in ` +
            "normalizeChampionsFormName (src/regulations/champions-html-parser.ts).",
    );
}

/**
 * Extract Pokémon display names from the client-rendered JS array the M-B page
 * ships: `const pokemons = [["0003-000", 1, "Venusaur"], ...];`. Returns null
 * when no such array is present (older/other page shapes). Scans for the
 * balanced outer `[...]` then JSON.parses it — the tuple strings never contain
 * brackets, so the depth scan is safe.
 */
function extractPokemonsArray(html: string): string[] | null {
    const marker = html.match(/const\s+pokemons\s*=\s*/);
    if (!marker || marker.index === undefined) return null;
    const start = html.indexOf("[", marker.index);
    if (start === -1) return null;

    let depth = 0;
    let end = -1;
    for (let i = start; i < html.length; i++) {
        const c = html[i];
        if (c === "[") depth++;
        else if (c === "]" && --depth === 0) {
            end = i;
            break;
        }
    }
    if (end === -1) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(html.slice(start, end + 1));
    } catch {
        return null;
    }
    if (!Array.isArray(parsed)) return null;

    const names: string[] = [];
    for (const entry of parsed) {
        if (Array.isArray(entry) && typeof entry[2] === "string") names.push(entry[2]);
    }
    return names.length > 0 ? names : null;
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

    // Pattern 0: the client-rendered JS array shipped by the M-B+ page. Names
    // here carry parenthetical form labels, so they're normalized to Showdown
    // shape (older patterns below already emit Showdown-shaped names).
    const arrayNames = extractPokemonsArray(html);
    if (arrayNames) {
        for (const raw of arrayNames) {
            const normalized = normalizeChampionsFormName(decodeEntities(raw).trim());
            if (normalized) collected.add(normalized);
        }
        diagnostics.push(`pokemons[] array: ${arrayNames.length} names`);
    }

    // Pattern 1: elements carrying data-pokemon="Name".
    const dataMatches = html.matchAll(/data-pokemon\s*=\s*"([^"]+)"/gi);
    let dataCount = 0;
    for (const m of dataMatches) {
        const name = decodeEntities(m[1]).trim();
        if (name) {
            collected.add(name);
            dataCount++;
        }
    }
    if (dataCount > 0) {
        diagnostics.push(`data-pokemon attributes: ${dataCount} names`);
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
