// Parse Pokemon data from MCP server responses

/**
 * Parse abilities from lookup_pokemon response
 * Format: "**Abilities:**\n- Rough Skin\n- Sand Veil (Hidden)\n"
 */
export function parseAbilities(lookupResponse: string): string[] {
    const abilities: string[] = [];

    // Find abilities section
    const abilitiesMatch = lookupResponse.match(/\*\*Abilities:\*\*\n([\s\S]*?)(?:\n\n|\*\*|$)/);
    if (!abilitiesMatch) return abilities;

    const abilitiesSection = abilitiesMatch[1];
    const lines = abilitiesSection.split("\n");

    for (const line of lines) {
        // Match "- Ability Name" or "- Ability Name (Hidden)"
        const match = line.match(/^-\s+(.+?)(?:\s+\(Hidden\))?$/);
        if (match) {
            abilities.push(match[1].trim());
        }
    }

    return abilities;
}

/**
 * Parse moves from get_popular_sets response
 * Format: "**Popular Moves:**\n- Earthquake (85.2%)\n- Dragon Claw (72.1%)\n"
 */
export function parseMoves(setsResponse: string): string[] {
    const moves: string[] = [];

    // Find popular moves section
    const movesMatch = setsResponse.match(/\*\*Popular Moves:\*\*\n([\s\S]*?)(?:\n\n|\*\*|$)/);
    if (!movesMatch) return moves;

    const movesSection = movesMatch[1];
    const lines = movesSection.split("\n");

    for (const line of lines) {
        // Match "- Move Name (XX.X%)"
        const match = line.match(/^-\s+(.+?)\s+\(/);
        if (match) {
            moves.push(match[1].trim());
        }
    }

    return moves;
}

/**
 * Parse items from get_popular_sets response
 * Format: "**Popular Items:**\n- Choice Scarf (45.2%)\n- Life Orb (32.1%)\n"
 */
export function parseItems(setsResponse: string): string[] {
    const items: string[] = [];

    // Find popular items section
    const itemsMatch = setsResponse.match(/\*\*Popular Items:\*\*\n([\s\S]*?)(?:\n\n|\*\*|$)/);
    if (!itemsMatch) return items;

    const itemsSection = itemsMatch[1];
    const lines = itemsSection.split("\n");

    for (const line of lines) {
        // Match "- Item Name (XX.X%)"
        const match = line.match(/^-\s+(.+?)\s+\(/);
        if (match) {
            items.push(match[1].trim());
        }
    }

    return items;
}

/**
 * Parse Tera Types from get_popular_sets response
 * Format: "**Popular Tera Types:**\n- Ground (42.5%)\n- Steel (28.3%)\n"
 */
export function parseTeraTypes(setsResponse: string): string[] {
    const teraTypes: string[] = [];

    // Find popular tera types section
    const teraMatch = setsResponse.match(/\*\*Popular Tera Types:\*\*\n([\s\S]*?)(?:\n\n|\*\*|$)/);
    if (!teraMatch) return teraTypes;

    const teraSection = teraMatch[1];
    const lines = teraSection.split("\n");

    for (const line of lines) {
        // Match "- Type (XX.X%)"
        const match = line.match(/^-\s+(.+?)\s+\(/);
        if (match) {
            teraTypes.push(match[1].trim());
        }
    }

    return teraTypes;
}
