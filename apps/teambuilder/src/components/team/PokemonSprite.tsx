"use client";

import { useState } from "react";

interface PokemonSpriteProps {
    pokemon: string;
    size?: "sm" | "md" | "lg";
    className?: string;
    showFallback?: boolean;
}

const SIZES = {
    sm: 48,
    md: 64,
    lg: 96,
};

// Pokemon with hyphens in their base name (not forms)
const HYPHENATED_BASE_NAMES = new Set([
    "chien-pao",
    "chi-yu",
    "ting-lu",
    "wo-chien", // Treasures of Ruin
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

// Pokemon with spaces that need special sprite IDs (lowercase keys)
const SPECIAL_SPRITE_IDS: Record<string, string> = {
    "raging bolt": "ragingbolt",
    ragingbolt: "ragingbolt",
    "iron hands": "ironhands",
    ironhands: "ironhands",
    "iron valiant": "ironvaliant",
    ironvaliant: "ironvaliant",
    "iron moth": "ironmoth",
    ironmoth: "ironmoth",
    "iron treads": "irontreads",
    irontreads: "irontreads",
    "iron boulder": "ironboulder",
    ironboulder: "ironboulder",
    "iron crown": "ironcrown",
    ironcrown: "ironcrown",
    "iron leaves": "ironleaves",
    ironleaves: "ironleaves",
    "great tusk": "greattusk",
    greattusk: "greattusk",
    "slither wing": "slitherwing",
    slitherwing: "slitherwing",
    "sandy shocks": "sandyshocks",
    sandyshocks: "sandyshocks",
    "scream tail": "screamtail",
    screamtail: "screamtail",
    "brute bonnet": "brutebonnet",
    brutebonnet: "brutebonnet",
    "flutter mane": "fluttermane",
    fluttermane: "fluttermane",
    "roaring moon": "roaringmoon",
    roaringmoon: "roaringmoon",
    "walking wake": "walkingwake",
    walkingwake: "walkingwake",
    "gouging fire": "gougingfire",
    gougingfire: "gougingfire",
    "iron bundle": "ironbundle",
    ironbundle: "ironbundle",
    "iron jugulis": "ironjugulis",
    ironjugulis: "ironjugulis",
    "iron thorns": "ironthorns",
    ironthorns: "ironthorns",
};

/**
 * Convert Pokemon name to Showdown sprite ID format
 * Examples:
 *   "Urshifu-Rapid-Strike" -> "urshifu-rapidstrike"
 *   "Landorus-Therian" -> "landorus-therian"
 *   "Iron Hands" -> "ironhands"
 *   "Chien-Pao" -> "chienpao"
 *   "Ogerpon-Wellspring" -> "ogerpon-wellspring"
 */
function toSpriteId(pokemon: string): string {
    const lower = pokemon.toLowerCase();

    // Check for special sprite IDs first (Paradox Pokemon with spaces)
    if (SPECIAL_SPRITE_IDS[lower]) {
        return SPECIAL_SPRITE_IDS[lower];
    }

    const cleaned = lower.replace(/[^a-z0-9-]/g, "");

    // Also check cleaned version for special IDs (handles "RagingBolt" -> "ragingbolt")
    if (SPECIAL_SPRITE_IDS[cleaned]) {
        return SPECIAL_SPRITE_IDS[cleaned];
    }

    // Check if this is a hyphenated base name (not a form)
    if (HYPHENATED_BASE_NAMES.has(cleaned)) {
        return cleaned.replace(/-/g, ""); // Remove hyphens for sprite ID
    }

    // Split by hyphen to handle form names
    const parts = cleaned.split("-").filter(Boolean);

    if (parts.length <= 1) {
        return cleaned.replace(/-/g, ""); // No form, remove any hyphens
    }

    // First part is the Pokemon name, rest is the form
    // Join form parts without hyphens, then rejoin with single hyphen
    const baseName = parts[0];
    const formName = parts.slice(1).join("");

    return `${baseName}-${formName}`;
}

/**
 * Get the animated Showdown sprite URL for a Pokemon
 */
function getAnimatedSpriteUrl(pokemon: string): string {
    const id = toSpriteId(pokemon);
    return `https://play.pokemonshowdown.com/sprites/ani/${id}.gif`;
}

/**
 * Get the static sprite URL (fallback)
 */
function getStaticSpriteUrl(pokemon: string): string {
    const id = toSpriteId(pokemon);
    return `https://play.pokemonshowdown.com/sprites/dex/${id}.png`;
}

export function PokemonSprite({
    pokemon,
    size = "md",
    className = "",
    showFallback = true,
}: PokemonSpriteProps) {
    const [useStatic, setUseStatic] = useState(false);
    const [hasError, setHasError] = useState(false);
    const dimension = SIZES[size];

    const spriteUrl = useStatic ? getStaticSpriteUrl(pokemon) : getAnimatedSpriteUrl(pokemon);

    if (hasError) {
        // Show placeholder
        return (
            <div
                className={`flex items-center justify-center bg-muted rounded-lg overflow-hidden ${className}`}
                style={{ width: dimension, height: dimension }}
            >
                <span className="text-xs text-muted-foreground">?</span>
            </div>
        );
    }

    // Use regular img tag to avoid Next.js Image optimization CORS issues
    return (
        <div
            className={`relative flex items-center justify-center overflow-hidden ${className}`}
            style={{ width: dimension, height: dimension }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={spriteUrl}
                alt={pokemon}
                width={dimension}
                height={dimension}
                className="object-contain max-w-full max-h-full"
                style={{ imageRendering: "pixelated" }}
                onError={() => {
                    if (!useStatic && showFallback) {
                        // Try static sprite as fallback
                        setUseStatic(true);
                    } else {
                        setHasError(true);
                    }
                }}
            />
        </div>
    );
}
