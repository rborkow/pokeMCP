/**
 * Canonical Pokemon type color mappings.
 *
 * All components that display type-colored badges or backgrounds MUST import
 * from here instead of defining their own color maps.
 *
 * Background colors reference the `--color-pokemon-*` CSS custom properties
 * defined in globals.css (OKLCH values). Text contrast overrides are included
 * for light-on-dark readability.
 */
import type { PokemonType } from "@/types/pokemon";

/** Tailwind class for each type's background + text contrast override. */
export const TYPE_BG_CLASSES: Record<PokemonType, string> = {
    Normal: "bg-pokemon-normal",
    Fire: "bg-pokemon-fire",
    Water: "bg-pokemon-water",
    Electric: "bg-pokemon-electric text-black",
    Grass: "bg-pokemon-grass",
    Ice: "bg-pokemon-ice text-black",
    Fighting: "bg-pokemon-fighting",
    Poison: "bg-pokemon-poison",
    Ground: "bg-pokemon-ground",
    Flying: "bg-pokemon-flying text-black",
    Psychic: "bg-pokemon-psychic",
    Bug: "bg-pokemon-bug",
    Rock: "bg-pokemon-rock",
    Ghost: "bg-pokemon-ghost",
    Dragon: "bg-pokemon-dragon",
    Dark: "bg-pokemon-dark",
    Steel: "bg-pokemon-steel",
    Fairy: "bg-pokemon-fairy text-black",
};
