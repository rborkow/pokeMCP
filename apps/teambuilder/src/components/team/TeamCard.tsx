"use client";

import { forwardRef } from "react";
import type { TeamPokemon } from "@/types/pokemon";
import { getFormatDisplayName } from "@/types/pokemon";

interface TeamCardProps {
    team: TeamPokemon[];
    format: string;
}

/**
 * Convert Pokemon name to Showdown static sprite URL.
 * Duplicates the logic from PokemonSprite since we need raw URLs for the card.
 */
function getSpriteUrl(pokemon: string): string {
    const lower = pokemon.toLowerCase();

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

    const cleaned = lower.replace(/[^a-z0-9-]/g, "");
    if (special[cleaned]) {
        return `https://play.pokemonshowdown.com/sprites/dex/${special[cleaned]}.png`;
    }

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

    if (hyphenatedBases.has(cleaned)) {
        return `https://play.pokemonshowdown.com/sprites/dex/${cleaned.replace(/-/g, "")}.png`;
    }

    const parts = cleaned.split("-").filter(Boolean);
    const id = parts.length > 1 ? `${parts[0]}-${parts.slice(1).join("")}` : cleaned;
    return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

/**
 * A fixed-dimension team card designed for image export.
 * 1200x630px to match standard OG image dimensions.
 */
export const TeamCard = forwardRef<HTMLDivElement, TeamCardProps>(({ team, format }, ref) => {
    const formatName = getFormatDisplayName(format);

    return (
        <div
            ref={ref}
            style={{
                width: 1200,
                height: 630,
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
                padding: "36px 40px",
                fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
                display: "flex",
                flexDirection: "column",
                color: "white",
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                        style={{
                            fontSize: 28,
                            fontWeight: 700,
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {formatName}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>
                        {team.length} Pokemon
                    </span>
                </div>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 18, fontWeight: 600 }}>
                    pokemcp.com
                </span>
            </div>

            {/* Pokemon Cards */}
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "center",
                    flex: 1,
                    alignItems: "center",
                }}
            >
                {team.map((member, i) => (
                    <div
                        key={`${member.pokemon}-${i}`}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            width: 170,
                            padding: "12px 8px",
                            borderRadius: 12,
                            backgroundColor: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={getSpriteUrl(member.pokemon)}
                            alt={member.pokemon}
                            width={80}
                            height={80}
                            style={{ imageRendering: "pixelated" }}
                            crossOrigin="anonymous"
                        />
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                marginTop: 4,
                                textAlign: "center",
                                width: "100%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {member.pokemon}
                        </div>
                        {member.item && (
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.5)",
                                    fontSize: 11,
                                    marginTop: 2,
                                    textAlign: "center",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    width: "100%",
                                }}
                            >
                                @ {member.item}
                            </div>
                        )}
                        {member.ability && (
                            <div
                                style={{
                                    color: "rgba(255,255,255,0.4)",
                                    fontSize: 10,
                                    marginTop: 2,
                                    textAlign: "center",
                                }}
                            >
                                {member.ability}
                            </div>
                        )}
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 2,
                                marginTop: 6,
                                justifyContent: "center",
                                width: "100%",
                            }}
                        >
                            {member.moves.slice(0, 4).map((move) => (
                                <span
                                    key={move}
                                    style={{
                                        fontSize: 9,
                                        color: "rgba(255,255,255,0.6)",
                                        backgroundColor: "rgba(255,255,255,0.08)",
                                        padding: "2px 5px",
                                        borderRadius: 4,
                                        maxWidth: 75,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {move}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {/* Empty slot placeholders */}
                {Array.from({ length: 6 - team.length }).map((_, i) => (
                    <div
                        key={`empty-${i}`}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 170,
                            padding: "12px 8px",
                            borderRadius: 12,
                            backgroundColor: "rgba(255,255,255,0.03)",
                            border: "1px dashed rgba(255,255,255,0.1)",
                            minHeight: 180,
                        }}
                    >
                        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 24 }}>?</span>
                    </div>
                ))}
            </div>
        </div>
    );
});

TeamCard.displayName = "TeamCard";
