/**
 * VGC Team Analysis - checks team for common VGC building issues
 */

import type { TeamPokemon } from "@/types/pokemon";
import { VGC_BRING_COUNT } from "./constants/vgc";

export type VGCWarningLevel = "error" | "warning" | "info";

export interface VGCTeamWarning {
  level: VGCWarningLevel;
  message: string;
  pokemon?: string; // Which Pokemon this warning applies to (if specific)
  suggestion?: string;
}

// Pokemon that typically don't need Protect (offensive glass cannons, setup sweepers, etc.)
const PROTECT_EXCEPTIONS = new Set([
  // Choice item users
  "ditto",
  // Setup sweepers that prefer 4 attacks
  "dragonite", // often runs 4 attacks with Multiscale
  // Assault Vest users (can't run Protect)
  // Note: This is item-dependent, handled separately
]);

// Pokemon that MUST have Protect (redirectors, support)
const PROTECT_PRIORITY = new Set([
  "amoonguss",
  "indeedee-f",
  "indeedeef",
  "gothitelle",
  "clefairy",
  "pachirisu",
]);

// Speed control moves
const SPEED_CONTROL_MOVES = new Set([
  "tailwind",
  "trick room",
  "trickroom",
  "icy wind",
  "icywind",
  "electroweb",
  "scary face",
  "scaryface",
  "string shot",
  "stringshot",
  "thunder wave",
  "thunderwave",
  "bulldoze",
  "rock tomb",
  "rocktomb",
  "glaciate",
  "cotton spore",
  "cottonspore",
]);

// Fake Out users
const FAKE_OUT_POKEMON = new Set([
  "rillaboom",
  "incineroar",
  "mienshao",
  "persian",
  "persian-alola",
  "hitmontop",
  "ambipom",
  "weavile",
  "ludicolo",
  "medicham",
  "kangaskhan",
  "scrafty",
  "liepard",
  "meowstic",
]);

// Redirection moves/abilities
const REDIRECTION_MOVES = new Set([
  "follow me",
  "followme",
  "rage powder",
  "ragepowder",
  "spotlight",
]);

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasMove(pokemon: TeamPokemon, move: string): boolean {
  return pokemon.moves?.some((m) => toId(m) === toId(move)) ?? false;
}

function hasMoveFromSet(pokemon: TeamPokemon, moves: Set<string>): boolean {
  return pokemon.moves?.some((m) => moves.has(toId(m))) ?? false;
}

function hasProtect(pokemon: TeamPokemon): boolean {
  const protectMoves = ["protect", "detect", "spikyshield", "spiky shield", "banefulbunker", "baneful bunker", "silktrap", "silk trap", "obstruct", "kingsshield", "king's shield"];
  return pokemon.moves?.some((m) => protectMoves.some((p) => toId(m) === toId(p))) ?? false;
}

function hasAssaultVest(pokemon: TeamPokemon): boolean {
  return toId(pokemon.item ?? "") === "assaultvest";
}

function hasChoiceItem(pokemon: TeamPokemon): boolean {
  const item = toId(pokemon.item ?? "");
  return item === "choiceband" || item === "choicespecs" || item === "choicescarf";
}

/**
 * Analyze a VGC team for common issues
 */
export function analyzeVGCTeam(team: TeamPokemon[]): VGCTeamWarning[] {
  const warnings: VGCTeamWarning[] = [];

  if (team.length === 0) {
    return warnings;
  }

  // Check team size
  if (team.length < VGC_BRING_COUNT) {
    warnings.push({
      level: "info",
      message: `Team has ${team.length} Pokemon. VGC teams bring 6, pick ${VGC_BRING_COUNT}.`,
    });
  }

  // Analyze Protect coverage
  const pokemonMissingProtect: string[] = [];
  const pokemonNeedingProtect: string[] = [];

  for (const pokemon of team) {
    const pokemonId = toId(pokemon.pokemon);
    const name = pokemon.pokemon;

    // Skip if has Assault Vest (can't use Protect)
    if (hasAssaultVest(pokemon)) {
      continue;
    }

    // Skip if has Choice item (locking into Protect is bad)
    if (hasChoiceItem(pokemon)) {
      continue;
    }

    // Skip known exceptions
    if (PROTECT_EXCEPTIONS.has(pokemonId)) {
      continue;
    }

    // Check if missing Protect
    if (!hasProtect(pokemon)) {
      if (PROTECT_PRIORITY.has(pokemonId)) {
        pokemonNeedingProtect.push(name);
      } else {
        pokemonMissingProtect.push(name);
      }
    }
  }

  // High priority: Support Pokemon without Protect
  for (const name of pokemonNeedingProtect) {
    warnings.push({
      level: "warning",
      message: `${name} typically needs Protect for support/redirection.`,
      pokemon: name,
      suggestion: "Add Protect to improve survivability and stall for partner.",
    });
  }

  // Medium priority: Multiple Pokemon missing Protect
  if (pokemonMissingProtect.length >= 3) {
    warnings.push({
      level: "warning",
      message: `${pokemonMissingProtect.length} Pokemon lack Protect: ${pokemonMissingProtect.slice(0, 3).join(", ")}${pokemonMissingProtect.length > 3 ? "..." : ""}.`,
      suggestion: "In VGC, Protect helps scout, stall Dynamax turns, and protect from partner's spread moves.",
    });
  } else if (pokemonMissingProtect.length > 0) {
    warnings.push({
      level: "info",
      message: `Consider Protect on: ${pokemonMissingProtect.join(", ")}.`,
      suggestion: "Protect is core in VGC for scouting and synergy.",
    });
  }

  // Check for speed control
  const hasSpeedControl = team.some((p) => hasMoveFromSet(p, SPEED_CONTROL_MOVES));
  if (!hasSpeedControl && team.length >= 4) {
    warnings.push({
      level: "warning",
      message: "No speed control detected.",
      suggestion: "Consider Tailwind, Trick Room, Icy Wind, or Thunder Wave to control speed.",
    });
  }

  // Check for Fake Out user
  const hasFakeOut = team.some((p) => hasMove(p, "fakeout") || hasMove(p, "fake out"));
  if (!hasFakeOut && team.length >= 4) {
    const fakeOutOptions = team
      .filter((p) => FAKE_OUT_POKEMON.has(toId(p.pokemon)))
      .map((p) => p.pokemon);
    if (fakeOutOptions.length > 0) {
      warnings.push({
        level: "info",
        message: `${fakeOutOptions.join(", ")} can learn Fake Out.`,
        suggestion: "Fake Out provides free turns for setup or chip damage.",
      });
    }
  }

  // Check for redirection
  const hasRedirection = team.some((p) => hasMoveFromSet(p, REDIRECTION_MOVES));
  const hasRedirectionPokemon = team.some((p) =>
    toId(p.pokemon).includes("indeedee") ||
    toId(p.pokemon) === "amoonguss" ||
    toId(p.pokemon) === "clefairy"
  );

  if (hasRedirectionPokemon && !hasRedirection) {
    warnings.push({
      level: "info",
      message: "You have redirection Pokemon but no Follow Me/Rage Powder.",
      suggestion: "Redirection protects fragile sweepers.",
    });
  }

  return warnings;
}

/**
 * Get a summary suitable for AI context
 */
export function getVGCAnalysisSummary(team: TeamPokemon[]): string {
  const warnings = analyzeVGCTeam(team);
  if (warnings.length === 0) return "";

  const lines = ["VGC TEAM ANALYSIS:"];
  for (const w of warnings) {
    const prefix = w.level === "error" ? "❌" : w.level === "warning" ? "⚠️" : "💡";
    lines.push(`${prefix} ${w.message}`);
  }
  return lines.join("\n");
}
