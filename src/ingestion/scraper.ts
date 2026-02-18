import { Analyses } from "smogon";
import type { StrategyDocument, StrategySection } from "./types.js";
import { toID } from "../data-loader.js";

/**
 * Map our internal format names to Smogon's format names
 */
function mapToSmogonFormat(format: string): string {
    const mapping: Record<string, string> = {
        // Gen 9
        gen9ou: "OU",
        gen9ubers: "Uber",
        gen9uu: "UU",
        gen9ru: "RU",
        gen9nu: "NU",
        gen9pu: "PU",
        gen9lc: "LC",
        gen9vgc2024regf: "VGC24 Regulation F",
        gen9vgc2024regh: "VGC24 Regulation H",
        gen9vgc2024regg: "VGC24 Regulation G",
        // Gen 8
        gen8ou: "OU",
        gen8ubers: "Uber",
        gen8uu: "UU",
        gen8ru: "RU",
        gen8nu: "NU",
        gen8pu: "PU",
        gen8lc: "LC",
        // Gen 7
        gen7ou: "OU",
        gen7ubers: "Uber",
        gen7uu: "UU",
        gen7ru: "RU",
        gen7nu: "NU",
        gen7pu: "PU",
        gen7lc: "LC",
    };

    return mapping[format] || format;
}

/**
 * Fetch Smogon analyses for a Pokemon using the official RPC API
 */
export async function scrapeSmogonDex(
    pokemon: string,
    format: string,
): Promise<StrategyDocument | null> {
    const pokemonId = toID(pokemon);

    try {
        // Determine generation from format (e.g., 'gen9ou' -> 9)
        const genMatch = format.match(/gen(\d+)/);
        const gen = genMatch ? Number.parseInt(genMatch[1]) : 9;

        // Map to Smogon's format naming
        const smogonFormat = mapToSmogonFormat(format);

        // Get RPC request config from smogon package
        const { url, init } = Analyses.request(pokemon, gen as any);

        console.log(`Fetching analyses for ${pokemon} (gen ${gen}, format: ${smogonFormat})`);

        // Fetch the RPC response
        const response = await fetch(url, init);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rpcData = await response.json();

        // Process the response to get analyses
        const result = Analyses.process(rpcData);

        if (!result) {
            console.warn(`No analyses found for ${pokemon}`);
            return null;
        }

        // Find analysis for the requested format
        const analyses = result.analyses.get(smogonFormat) || [];

        if (analyses.length === 0) {
            const availableFormats = Array.from(result.analyses.keys());
            console.warn(
                `No analysis found for ${pokemon} in ${smogonFormat}. Available: ${availableFormats.join(", ")}`,
            );
            return null;
        }

        // Take the first analysis (there's usually only one per format)
        const analysis = analyses[0];

        // Convert to our StrategyDocument format
        const sections: StrategySection[] = [];

        // Add overview section
        if (analysis.overview) {
            sections.push({
                type: "overview",
                title: "Overview",
                content: analysis.overview,
            });
        }

        // Add moveset sections
        for (const moveset of analysis.movesets) {
            sections.push({
                type: "moveset",
                title: moveset.name,
                content: moveset.description,
                setName: moveset.name,
            });
        }

        // Add comments as "checks and counters" if present
        if (analysis.comments) {
            sections.push({
                type: "counters",
                title: "Additional Comments",
                content: analysis.comments,
            });
        }

        if (sections.length === 0) {
            console.warn(`No content extracted for ${pokemon} in ${format}`);
            return null;
        }

        return {
            pokemon,
            format,
            url: `https://www.smogon.com/dex/sv/pokemon/${pokemonId}`,
            fetchedAt: new Date().toISOString(),
            sections,
        };
    } catch (error) {
        console.error(`Failed to fetch analyses for ${pokemon}:`, error);
        return null;
    }
}

/**
 * Rate-limited scraping helper
 */
export async function scrapeWithDelay(
    pokemon: string,
    format: string,
    delayMs = 500,
): Promise<StrategyDocument | null> {
    const doc = await scrapeSmogonDex(pokemon, format);

    // Wait before returning to rate limit
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return doc;
}
