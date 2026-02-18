import type { TeamPokemon, BaseStats } from "@/types/pokemon";

/**
 * Parse a Pokemon Showdown team paste format into TeamPokemon array
 *
 * Example format:
 * Garchomp @ Life Orb
 * Ability: Rough Skin
 * Tera Type: Fire
 * EVs: 252 Atk / 4 SpD / 252 Spe
 * Jolly Nature
 * - Earthquake
 * - Dragon Claw
 * - Swords Dance
 * - Fire Fang
 */
export function parseShowdownTeam(paste: string): TeamPokemon[] {
    const blocks = paste
        .trim()
        .split(/\n\s*\n/)
        .filter((block) => block.trim());
    return blocks.map(parsePokemonBlock).filter((p): p is TeamPokemon => p !== null);
}

function parsePokemonBlock(block: string): TeamPokemon | null {
    const lines = block.trim().split("\n");
    if (lines.length === 0) return null;

    const pokemon: TeamPokemon = {
        pokemon: "",
        moves: [],
    };

    // Parse first line: "Nickname (Species) @ Item" or "Species @ Item"
    const firstLine = lines[0].trim();
    const firstLineMatch = firstLine.match(/^(.+?)(?:\s*@\s*(.+))?$/);

    if (firstLineMatch) {
        let nameOrNickname = firstLineMatch[1].trim();
        pokemon.item = firstLineMatch[2]?.trim();

        // First, strip gender suffix if present at the end: (M) or (F)
        // This handles cases like "Tinker (Ogerpon-Hearthflame) (F)"
        const genderSuffixMatch = nameOrNickname.match(/^(.+)\s+\(([MF])\)$/);
        if (genderSuffixMatch) {
            nameOrNickname = genderSuffixMatch[1].trim();
            pokemon.gender = genderSuffixMatch[2] as "M" | "F";
        }

        // Now check for nickname (Species) pattern
        // e.g., "Tinker (Ogerpon-Hearthflame)" -> nickname: Tinker, species: Ogerpon-Hearthflame
        const speciesMatch = nameOrNickname.match(/^(.+?)\s*\(([^)]+)\)$/);
        if (speciesMatch) {
            pokemon.nickname = speciesMatch[1].trim();
            pokemon.pokemon = speciesMatch[2].trim();
        } else {
            // No nickname, just the species name (possibly with gender already stripped)
            pokemon.pokemon = nameOrNickname;
        }
    }

    if (!pokemon.pokemon) return null;

    // Parse remaining lines
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("Ability:")) {
            pokemon.ability = line.replace("Ability:", "").trim();
        } else if (line.startsWith("Tera Type:")) {
            pokemon.teraType = line.replace("Tera Type:", "").trim();
        } else if (line.startsWith("EVs:")) {
            pokemon.evs = parseStats(line.replace("EVs:", "").trim());
        } else if (line.startsWith("IVs:")) {
            pokemon.ivs = parseStats(line.replace("IVs:", "").trim());
        } else if (line.endsWith("Nature")) {
            pokemon.nature = line.replace("Nature", "").trim();
        } else if (line.startsWith("Level:")) {
            pokemon.level = Number.parseInt(line.replace("Level:", "").trim(), 10);
        } else if (line.startsWith("Shiny:")) {
            pokemon.shiny = line.replace("Shiny:", "").trim().toLowerCase() === "yes";
        } else if (line.startsWith("-")) {
            const move = line.replace("-", "").trim();
            if (move && pokemon.moves.length < 4) {
                pokemon.moves.push(move);
            }
        }
    }

    return pokemon;
}

function parseStats(statsStr: string): Partial<BaseStats> {
    const stats: Partial<BaseStats> = {};
    const statMap: Record<string, keyof BaseStats> = {
        HP: "hp",
        Atk: "atk",
        Def: "def",
        SpA: "spa",
        SpD: "spd",
        Spe: "spe",
    };

    const parts = statsStr.split("/").map((s) => s.trim());
    for (const part of parts) {
        const match = part.match(/(\d+)\s*(HP|Atk|Def|SpA|SpD|Spe)/i);
        if (match) {
            const value = Number.parseInt(match[1], 10);
            const statName = match[2];
            // Find the matching stat key (case insensitive)
            for (const [key, stat] of Object.entries(statMap)) {
                if (key.toLowerCase() === statName.toLowerCase()) {
                    stats[stat] = value;
                    break;
                }
            }
        }
    }

    return stats;
}

/**
 * Export a team to Pokemon Showdown paste format
 */
export function exportShowdownTeam(team: TeamPokemon[]): string {
    return team.map(exportPokemonBlock).join("\n\n");
}

function exportPokemonBlock(pokemon: TeamPokemon): string {
    const lines: string[] = [];

    // First line: Nickname (Species) @ Item or Species @ Item
    let firstLine = "";
    if (pokemon.nickname) {
        firstLine = `${pokemon.nickname} (${pokemon.pokemon})`;
    } else if (pokemon.gender) {
        firstLine = `${pokemon.pokemon} (${pokemon.gender})`;
    } else {
        firstLine = pokemon.pokemon;
    }
    if (pokemon.item) {
        firstLine += ` @ ${pokemon.item}`;
    }
    lines.push(firstLine);

    // Ability
    if (pokemon.ability) {
        lines.push(`Ability: ${pokemon.ability}`);
    }

    // Level (if not 100)
    if (pokemon.level && pokemon.level !== 100) {
        lines.push(`Level: ${pokemon.level}`);
    }

    // Shiny
    if (pokemon.shiny) {
        lines.push("Shiny: Yes");
    }

    // Tera Type
    if (pokemon.teraType) {
        lines.push(`Tera Type: ${pokemon.teraType}`);
    }

    // EVs
    if (pokemon.evs && Object.keys(pokemon.evs).length > 0) {
        lines.push(`EVs: ${formatStats(pokemon.evs)}`);
    }

    // Nature
    if (pokemon.nature) {
        lines.push(`${pokemon.nature} Nature`);
    }

    // IVs (only if not all 31)
    if (pokemon.ivs && Object.keys(pokemon.ivs).length > 0) {
        lines.push(`IVs: ${formatStats(pokemon.ivs)}`);
    }

    // Moves
    for (const move of pokemon.moves) {
        lines.push(`- ${move}`);
    }

    return lines.join("\n");
}

function formatStats(stats: Partial<BaseStats>): string {
    const statNames: Record<keyof BaseStats, string> = {
        hp: "HP",
        atk: "Atk",
        def: "Def",
        spa: "SpA",
        spd: "SpD",
        spe: "Spe",
    };

    const parts: string[] = [];
    for (const [key, value] of Object.entries(stats)) {
        if (value !== undefined && value !== null) {
            parts.push(`${value} ${statNames[key as keyof BaseStats]}`);
        }
    }

    return parts.join(" / ");
}

/**
 * Convert Pokemon name to Showdown ID format
 * "Landorus-Therian" -> "landorustherian"
 */
export function toID(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Common Pokemon name mappings from ID to display name
 * These are Pokemon with non-obvious formatting
 */
const POKEMON_DISPLAY_NAMES: Record<string, string> = {
    // Paradox Pokemon (space in name)
    greattusk: "Great Tusk",
    ironvaliant: "Iron Valiant",
    ragingbolt: "Raging Bolt",
    ironmoth: "Iron Moth",
    irontreads: "Iron Treads",
    walkingwake: "Walking Wake",
    roaringmoon: "Roaring Moon",
    ironboulder: "Iron Boulder",
    gougingfire: "Gouging Fire",
    fluttermane: "Flutter Mane",
    ironhands: "Iron Hands",
    screamtail: "Scream Tail",
    brutebonnet: "Brute Bonnet",
    sandyshocks: "Sandy Shocks",
    ironbundle: "Iron Bundle",
    ironjugulis: "Iron Jugulis",
    ironthorns: "Iron Thorns",
    slitherwing: "Slither Wing",
    ironcrown: "Iron Crown",
    ironleaves: "Iron Leaves",
    // Forme Pokemon (hyphen in name)
    landorustherian: "Landorus-Therian",
    tornadustherian: "Tornadus-Therian",
    thundurustherian: "Thundurus-Therian",
    enamorustherian: "Enamorus-Therian",
    ogerponwellspring: "Ogerpon-Wellspring",
    ogerponhearthflame: "Ogerpon-Hearthflame",
    ogerponcornerstone: "Ogerpon-Cornerstone",
    urshifurapidstrike: "Urshifu-Rapid-Strike",
    calyrexice: "Calyrex-Ice",
    calyrexshadow: "Calyrex-Shadow",
    zamazentacrowned: "Zamazenta-Crowned",
    zaciancrowned: "Zacian-Crowned",
    palafinhero: "Palafin-Hero",
    rotomwash: "Rotom-Wash",
    rotomheat: "Rotom-Heat",
    rotommow: "Rotom-Mow",
    rotomfrost: "Rotom-Frost",
    rotomfan: "Rotom-Fan",
    slowkinggalar: "Slowking-Galar",
    slowbrogalar: "Slowbro-Galar",
    maborossgalar: "Moltres-Galar",
    moltresgalar: "Moltres-Galar",
    zapdosgalar: "Zapdos-Galar",
    articunogalar: "Articuno-Galar",
    ursalunabloodmoon: "Ursaluna-Bloodmoon",
    // Regional forms
    ninetalesalola: "Ninetales-Alola",
    raichualola: "Raichu-Alola",
    sandslashalola: "Sandslash-Alola",
    marowakalola: "Marowak-Alola",
    exeggutoralola: "Exeggutor-Alola",
    samurotthisui: "Samurott-Hisui",
    lilliganthisui: "Lilligant-Hisui",
    arcaninehisui: "Arcanine-Hisui",
    typhlosionhisui: "Typhlosion-Hisui",
    decidueyehisui: "Decidueye-Hisui",
    zoroarkhisui: "Zoroark-Hisui",
    goodrahisui: "Goodra-Hisui",
    // Treasures of Ruin
    chiyu: "Chi-Yu",
    tinglu: "Ting-Lu",
    wochien: "Wo-Chien",
    chienpao: "Chien-Pao",
    // Other special cases
    porygonz: "Porygon-Z",
    porygon2: "Porygon2",
    mimejr: "Mime Jr.",
    mrmime: "Mr. Mime",
    mrrime: "Mr. Rime",
    tapukoko: "Tapu Koko",
    tapulele: "Tapu Lele",
    tapubulu: "Tapu Bulu",
    tapufini: "Tapu Fini",
    typenull: "Type: Null",
    hooh: "Ho-Oh",
    jangmoo: "Jangmo-o",
    hakamoo: "Hakamo-o",
    kommoo: "Kommo-o",
};

/**
 * Convert a Pokemon ID or name to a friendly display name
 * "greattusk" -> "Great Tusk"
 * "landorustherian" -> "Landorus-Therian"
 * "Garchomp" -> "Garchomp" (unchanged if already good)
 */
export function toDisplayName(pokemon: string): string {
    // First check if it's already in a good format (has spaces or proper casing)
    if (pokemon.includes(" ") || pokemon.includes("-") || pokemon !== pokemon.toLowerCase()) {
        return pokemon;
    }

    // Check our mapping
    const id = toID(pokemon);
    if (POKEMON_DISPLAY_NAMES[id]) {
        return POKEMON_DISPLAY_NAMES[id];
    }

    // Default: capitalize first letter
    return pokemon.charAt(0).toUpperCase() + pokemon.slice(1);
}
