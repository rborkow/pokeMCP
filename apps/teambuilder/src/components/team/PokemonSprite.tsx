"use client";

import { useState } from "react";
import Image from "next/image";

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

/**
 * Convert Pokemon name to Showdown sprite ID format
 * Examples:
 *   "Urshifu-Rapid-Strike" -> "urshifu-rapidstrike"
 *   "Landorus-Therian" -> "landorus-therian"
 *   "Iron Hands" -> "ironhands"
 *   "Ogerpon-Wellspring" -> "ogerpon-wellspring"
 */
function toSpriteId(pokemon: string): string {
  const cleaned = pokemon.toLowerCase().replace(/[^a-z0-9-]/g, "");

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
 * Uses Showdown's dex sprites which are higher quality
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

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <Image
        src={spriteUrl}
        alt={pokemon}
        width={dimension}
        height={dimension}
        className="object-contain max-w-full max-h-full"
        style={{ imageRendering: "pixelated" }}
        unoptimized // GIFs need this
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
