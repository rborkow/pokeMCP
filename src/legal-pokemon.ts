import { getPokedex, getPokemonFormatData, toID } from "./data-loader.js";
import { isRegulationId } from "./regulations/registry.js";
import { loadRegulation } from "./regulations/loader.js";

const MAX_DEX_NUM_BY_GEN: Record<number, number> = {
    7: 807,
    8: 905,
    9: 1025,
};

const SINGLES_TIER_FORMAT_RE = /^gen\d+(ou|uu|ru|nu|pu|lc|zu)$/;
const UBER_TIERS = new Set(["Uber", "AG"]);

function parseGenFromFormat(format: string): number | null {
    const m = format.match(/^gen(\d+)/);
    return m ? Number.parseInt(m[1], 10) : null;
}

export async function getLegalPokemon(
    args: { format: string },
    env: Env,
): Promise<{ legal: string[] }> {
    const format = args.format.toLowerCase().trim();
    if (!format) return { legal: [] };

    // Champions / regulation formats: use the allow-list from the registry.
    if (isRegulationId(format)) {
        try {
            const regulation = await loadRegulation(format, env);
            return { legal: Array.from(regulation.allowedPokemonIds) };
        } catch {
            return { legal: [] };
        }
    }

    const gen = parseGenFromFormat(format);
    if (gen === null) return { legal: [] };

    const maxDex = MAX_DEX_NUM_BY_GEN[gen];
    if (!maxDex) return { legal: [] };

    const isSinglesTierFormat = SINGLES_TIER_FORMAT_RE.test(format);

    const pokedex = getPokedex();
    const legal: string[] = [];

    for (const [id, species] of Object.entries(pokedex)) {
        if (species.num <= 0) continue;
        if (species.num > maxDex) continue;

        // Exclude CAP (Create-A-Pokémon) and Pokestar "species" from the dex.
        if (species.isNonstandard) continue;

        const fd = getPokemonFormatData(species.name);

        // For Gen 9, "Past" format-data means the form is not in Gen 9 (e.g. Megas).
        if (gen === 9 && fd?.isNonstandard === "Past") continue;

        // Soft singles tier filter — drop Ubers/AG from OU-and-below formats.
        if (isSinglesTierFormat && fd?.tier && UBER_TIERS.has(fd.tier)) continue;

        legal.push(toID(id));
    }

    return { legal };
}
