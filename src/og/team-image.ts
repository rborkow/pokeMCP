import satori from "satori";
import type { SharedTeam } from "../share.js";

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Convert Pokemon name to Showdown static sprite URL
 */
function getSpriteUrl(pokemon: string): string {
    const lower = pokemon.toLowerCase();

    // Special handling for Paradox Pokemon (spaces -> no spaces)
    const special: Record<string, string> = {
        "raging bolt": "ragingbolt",
        "iron hands": "ironhands",
        "iron valiant": "ironvaliant",
        "iron moth": "ironmoth",
        "iron treads": "irontreads",
        "iron boulder": "ironboulder",
        "iron crown": "ironcrown",
        "iron leaves": "ironleaves",
        "great tusk": "greattusk",
        "slither wing": "slitherwing",
        "sandy shocks": "sandyshocks",
        "scream tail": "screamtail",
        "brute bonnet": "brutebonnet",
        "flutter mane": "fluttermane",
        "roaring moon": "roaringmoon",
        "walking wake": "walkingwake",
        "gouging fire": "gougingfire",
        "iron bundle": "ironbundle",
        "iron jugulis": "ironjugulis",
        "iron thorns": "ironthorns",
    };

    if (special[lower]) {
        return `https://play.pokemonshowdown.com/sprites/dex/${special[lower]}.png`;
    }

    // Hyphenated base names that should have hyphens removed
    const hyphenatedBases = new Set([
        "chien-pao",
        "chi-yu",
        "ting-lu",
        "wo-chien",
        "ho-oh",
        "porygon-z",
        "jangmo-o",
        "hakamo-o",
        "kommo-o",
        "type-null",
        "tapu-koko",
        "tapu-lele",
        "tapu-bulu",
        "tapu-fini",
    ]);

    const cleaned = lower.replace(/[^a-z0-9-]/g, "");
    if (hyphenatedBases.has(cleaned)) {
        return `https://play.pokemonshowdown.com/sprites/dex/${cleaned.replace(/-/g, "")}.png`;
    }

    // Handle forme names: "Landorus-Therian" -> "landorus-therian"
    const parts = cleaned.split("-").filter(Boolean);
    const id = parts.length > 1 ? `${parts[0]}-${parts.slice(1).join("")}` : cleaned;

    return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

/**
 * Get a display-friendly format name
 */
function getFormatName(format: string): string {
    const names: Record<string, string> = {
        gen9ou: "Gen 9 OU",
        gen9ubers: "Gen 9 Ubers",
        gen9uu: "Gen 9 UU",
        gen9ru: "Gen 9 RU",
        gen9nu: "Gen 9 NU",
        gen9pu: "Gen 9 PU",
        gen9lc: "Gen 9 LC",
        gen9vgc2026regf: "VGC 2026 Reg F",
        gen9vgc2025regi: "VGC 2025 Reg I",
        gen9vgc2024regh: "VGC 2024 Reg H",
        gen9doublesou: "Gen 9 Doubles OU",
        gen8ou: "Gen 8 OU",
        gen7ou: "Gen 7 OU",
    };
    return names[format] || format.toUpperCase();
}

/**
 * Build the Satori element tree for a team OG image.
 * Satori uses a React-like element tree but without JSX.
 */
// biome-ignore lint: Satori element types are loosely defined
function buildTeamImageElement(sharedTeam: SharedTeam): any {
    const pokemonCards: any[] = sharedTeam.team.map((member) => ({
        type: "div" as const,
        props: {
            style: {
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center" as const,
                width: 170,
                padding: "12px 8px",
                borderRadius: 12,
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
            },
            children: [
                // Sprite
                {
                    type: "img" as const,
                    props: {
                        src: getSpriteUrl(member.pokemon),
                        width: 80,
                        height: 80,
                        style: { imageRendering: "pixelated" as const },
                    },
                },
                // Name
                {
                    type: "div" as const,
                    props: {
                        style: {
                            color: "white",
                            fontSize: 14,
                            fontWeight: 600,
                            marginTop: 4,
                            textAlign: "center" as const,
                            width: "100%",
                            overflow: "hidden" as const,
                            textOverflow: "ellipsis" as const,
                            whiteSpace: "nowrap" as const,
                        },
                        children: member.pokemon,
                    },
                },
                // Item
                {
                    type: "div" as const,
                    props: {
                        style: {
                            color: "rgba(255, 255, 255, 0.5)",
                            fontSize: 11,
                            marginTop: 2,
                            textAlign: "center" as const,
                            width: "100%",
                            overflow: "hidden" as const,
                            textOverflow: "ellipsis" as const,
                            whiteSpace: "nowrap" as const,
                        },
                        children: member.item ? `@ ${member.item}` : "",
                    },
                },
                // Ability
                {
                    type: "div" as const,
                    props: {
                        style: {
                            color: "rgba(255, 255, 255, 0.4)",
                            fontSize: 10,
                            marginTop: 2,
                            textAlign: "center" as const,
                        },
                        children: member.ability || "",
                    },
                },
                // Moves (2-column)
                {
                    type: "div" as const,
                    props: {
                        style: {
                            display: "flex",
                            flexWrap: "wrap" as const,
                            gap: 2,
                            marginTop: 6,
                            justifyContent: "center" as const,
                            width: "100%",
                        },
                        children: member.moves.slice(0, 4).map((move) => ({
                            type: "div" as const,
                            props: {
                                style: {
                                    fontSize: 9,
                                    color: "rgba(255, 255, 255, 0.6)",
                                    backgroundColor: "rgba(255, 255, 255, 0.08)",
                                    padding: "2px 5px",
                                    borderRadius: 4,
                                    maxWidth: 75,
                                    overflow: "hidden" as const,
                                    textOverflow: "ellipsis" as const,
                                    whiteSpace: "nowrap" as const,
                                },
                                children: move,
                            },
                        })),
                    },
                },
            ],
        },
    }));

    // Fill empty slots with placeholders
    while (pokemonCards.length < 6) {
        pokemonCards.push({
            type: "div" as const,
            props: {
                style: {
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems: "center" as const,
                    justifyContent: "center" as const,
                    width: 170,
                    padding: "12px 8px",
                    borderRadius: 12,
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    border: "1px dashed rgba(255, 255, 255, 0.1)",
                },
                children: [
                    {
                        type: "div" as const,
                        props: {
                            style: { color: "rgba(255, 255, 255, 0.2)", fontSize: 24 },
                            children: "?",
                        },
                    },
                ],
            },
        });
    }

    return {
        type: "div" as const,
        props: {
            style: {
                display: "flex",
                flexDirection: "column" as const,
                width: WIDTH,
                height: HEIGHT,
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                padding: "36px 40px",
                fontFamily: "Inter",
            },
            children: [
                // Header row
                {
                    type: "div" as const,
                    props: {
                        style: {
                            display: "flex",
                            justifyContent: "space-between" as const,
                            alignItems: "center" as const,
                            marginBottom: 24,
                        },
                        children: [
                            // Format badge
                            {
                                type: "div" as const,
                                props: {
                                    style: {
                                        display: "flex",
                                        alignItems: "center" as const,
                                        gap: 12,
                                    },
                                    children: [
                                        {
                                            type: "div" as const,
                                            props: {
                                                style: {
                                                    color: "white",
                                                    fontSize: 28,
                                                    fontWeight: 700,
                                                    letterSpacing: "-0.02em",
                                                },
                                                children: getFormatName(sharedTeam.format),
                                            },
                                        },
                                        {
                                            type: "div" as const,
                                            props: {
                                                style: {
                                                    color: "rgba(255, 255, 255, 0.4)",
                                                    fontSize: 16,
                                                },
                                                children: `${sharedTeam.team.length} Pokemon`,
                                            },
                                        },
                                    ],
                                },
                            },
                            // Branding
                            {
                                type: "div" as const,
                                props: {
                                    style: {
                                        color: "rgba(255, 255, 255, 0.5)",
                                        fontSize: 18,
                                        fontWeight: 600,
                                    },
                                    children: "pokemcp.com",
                                },
                            },
                        ],
                    },
                },
                // Pokemon cards row
                {
                    type: "div" as const,
                    props: {
                        style: {
                            display: "flex",
                            gap: 10,
                            justifyContent: "center" as const,
                            flex: 1,
                            alignItems: "center" as const,
                        },
                        children: pokemonCards,
                    },
                },
            ],
        },
    };
}

/**
 * Render a team OG image as SVG using Satori
 */
export async function renderTeamSvg(
    sharedTeam: SharedTeam,
    fontData: ArrayBuffer,
): Promise<string> {
    const element = buildTeamImageElement(sharedTeam);

    return satori(element, {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
            {
                name: "Inter",
                data: fontData,
                weight: 400,
                style: "normal" as const,
            },
        ],
    });
}
