import { getPersonality, type PersonalityId } from "./personalities";
import type { Mode, TeamPokemon } from "@/types/pokemon";
import { getVGCAnalysisSummary } from "@/lib/vgc-analysis";

export type { TeamPokemon };

/**
 * Get mode-specific guidance for the AI
 */
function getModeGuidance(mode: Mode): string {
  if (mode === "vgc") {
    return `
VGC-SPECIFIC GUIDANCE (This is a DOUBLES format):
- Protect is ESSENTIAL on most Pokemon - suggest it unless there's a good reason not to
- IMPORTANT: Choice items (Choice Band, Specs, Scarf) + Protect is LEGAL and sometimes strategic
  - Players use Protect on Choice users for turn 1 scouting or to stall out Trick Room/Tailwind
  - Don't flag this as illegal - it's a valid VGC strategy
- Spread moves (Earthquake, Rock Slide, Heat Wave, Dazzling Gleam) hit both opponents
- Speed control is critical: Tailwind, Trick Room, Icy Wind, Electroweb
- Consider Fake Out for disruption and enabling setup
- Redirection (Follow Me, Rage Powder) protects teammates
- Teams bring 6, pick 4 at team preview - consider flexible cores
- Partner synergy matters: don't suggest Earthquake if partner is weak to Ground
- Common VGC Pokemon often have different sets than Singles (more Protect, less recovery)`;
  }

  return `
SINGLES-SPECIFIC GUIDANCE (This is a 6v6 format):
- Entry hazards (Stealth Rock, Spikes, Toxic Spikes) are crucial for chip damage
- Hazard removal (Defog, Rapid Spin) or Magic Bounce is valuable
- Pivot moves (U-turn, Volt Switch, Flip Turn) maintain momentum
- Recovery moves (Roost, Recover, Wish) provide longevity
- Status moves (Toxic, Will-O-Wisp, Thunder Wave) wear down opponents
- Consider dedicated walls, wallbreakers, and sweepers
- Setup moves (Swords Dance, Dragon Dance, Nasty Plot) enable sweeps`;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

/**
 * Fetch teammate suggestions for Pokemon on the team
 * Returns analysis of common partners that aren't already on the team
 */
export async function fetchTeammateAnalysis(team: TeamPokemon[], format: string): Promise<string> {
  if (team.length === 0) return "";

  // Only fetch for up to 3 Pokemon to avoid too many requests
  const pokemonToCheck = team.slice(0, 3);
  const currentTeamNames = new Set(team.map(p => p.pokemon.toLowerCase()));

  const allSuggestions: Map<string, { count: number; from: string[] }> = new Map();

  for (const mon of pokemonToCheck) {
    try {
      const response = await fetch(`${MCP_URL}/api/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_teammates",
          args: { pokemon: mon.pokemon, format, limit: 8 },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.result?.content?.[0]?.text || "";

        // Parse teammate names from the response (format: "- **Name**: X.X%")
        const teammateRegex = /\*\*([^*]+)\*\*:\s*(\d+(?:\.\d+)?)/g;
        let match;
        while ((match = teammateRegex.exec(text)) !== null) {
          const teammateName = match[0].split("**")[1];
          const usage = parseFloat(match[2]);

          // Skip if already on team
          if (currentTeamNames.has(teammateName.toLowerCase())) continue;

          // Only track teammates with >5% usage
          if (usage < 5) continue;

          const existing = allSuggestions.get(teammateName);
          if (existing) {
            existing.count++;
            existing.from.push(mon.pokemon);
          } else {
            allSuggestions.set(teammateName, { count: 1, from: [mon.pokemon] });
          }
        }
      }
    } catch (e) {
      console.error(`Failed to fetch teammates for ${mon.pokemon}:`, e);
    }
  }

  if (allSuggestions.size === 0) return "";

  // Sort by how many team members share the teammate
  const sortedSuggestions = Array.from(allSuggestions.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6);

  let output = "TEAMMATE SYNERGY SUGGESTIONS:\n";
  output += "These Pokemon commonly pair well with your current team:\n";

  for (const [name, data] of sortedSuggestions) {
    if (data.count > 1) {
      output += `- ${name} (pairs with ${data.from.join(", ")})\n`;
    } else {
      output += `- ${name} (pairs with ${data.from[0]})\n`;
    }
  }

  return output;
}

// Common Pokemon names to look for in messages
const COMMON_POKEMON = [
  "Garchomp", "Landorus", "Great Tusk", "Kingambit", "Gholdengo",
  "Dragapult", "Iron Valiant", "Roaring Moon", "Skeledirge",
  "Arcanine", "Heatran", "Toxapex"
];

/**
 * Fetch meta threats from MCP server
 */
export async function fetchMetaThreats(format: string): Promise<string> {
  try {
    const response = await fetch(`${MCP_URL}/api/tools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tool: "get_meta_threats",
        args: { format, limit: 15 },
      }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.result?.content?.[0]?.text || "";
    }
  } catch (e) {
    console.error("Failed to fetch meta threats:", e);
  }
  return "";
}

/**
 * Extract Pokemon names mentioned in message and fetch their popular sets
 */
export async function fetchPopularSetsContext(message: string, format: string): Promise<string> {
  const pokemonMentioned: string[] = [];
  for (const mon of COMMON_POKEMON) {
    if (message.toLowerCase().includes(mon.toLowerCase())) {
      pokemonMentioned.push(mon);
    }
  }

  let context = "";
  for (const pokemon of pokemonMentioned.slice(0, 3)) {
    try {
      const response = await fetch(`${MCP_URL}/api/tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "get_popular_sets",
          args: { pokemon, format },
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const text = data.result?.content?.[0]?.text || "";
        if (text) {
          context += `\n\n${text}`;
        }
      }
    } catch (e) {
      console.error(`Failed to fetch sets for ${pokemon}:`, e);
    }
  }
  return context;
}

/**
 * Format EV spread into readable string
 */
function formatEVs(evs: TeamPokemon["evs"]): string {
  if (!evs) return "";
  const parts: string[] = [];
  if (evs.hp) parts.push(`${evs.hp} HP`);
  if (evs.atk) parts.push(`${evs.atk} Atk`);
  if (evs.def) parts.push(`${evs.def} Def`);
  if (evs.spa) parts.push(`${evs.spa} SpA`);
  if (evs.spd) parts.push(`${evs.spd} SpD`);
  if (evs.spe) parts.push(`${evs.spe} Spe`);
  return parts.join(" / ");
}

/**
 * Format team array into readable context string
 */
export function formatTeamContext(team: TeamPokemon[]): string {
  if (team.length === 0) {
    return "No Pokemon in team yet.";
  }
  return team.map((p, i) => {
    const lines: string[] = [];
    // Header line: name @ item (ability)
    let header = `${i + 1}. ${p.pokemon}`;
    if (p.item) header += ` @ ${p.item}`;
    if (p.ability) header += ` (${p.ability})`;
    lines.push(header);
    // Tera type if present
    if (p.teraType) lines.push(`   Tera Type: ${p.teraType}`);
    // Nature if present
    if (p.nature) lines.push(`   Nature: ${p.nature}`);
    // EVs if present
    const evStr = formatEVs(p.evs);
    if (evStr) lines.push(`   EVs: ${evStr}`);
    // Moves
    if (p.moves && p.moves.length > 0) lines.push(`   Moves: ${p.moves.join(", ")}`);
    return lines.join("\n");
  }).join("\n\n");
}

/**
 * Get generation number from format string
 */
function getGeneration(format: string): number {
  const match = format.match(/gen(\d+)/i);
  return match ? parseInt(match[1], 10) : 9; // Default to gen 9
}

/**
 * Get format-specific battle gimmick guidance
 */
function getGimmickGuidance(format: string): string {
  const gen = getGeneration(format);
  const lowerFormat = format.toLowerCase();

  if (gen >= 9) {
    return `
TERASTALLIZATION (Gen 9 Mechanic):
- EVERY Pokemon should have a tera_type specified
- Choose Tera types strategically:
  - Offensive: Boost STAB moves (e.g., Tera Fire on a Fire-type for 2x boost)
  - Defensive: Remove weaknesses (e.g., Tera Ghost on a Fighting-weak Pokemon)
  - Coverage: Enable unexpected coverage (e.g., Tera Electric for Tera Blast)
- Common Tera choices: Fairy (great defensive type), Steel (many resistances), Ghost (immunities)
- Consider the team's Tera type diversity - don't stack the same type`;
  }

  if (gen === 8) {
    // Dynamax is typically banned in Smogon singles but used in VGC
    if (lowerFormat.includes("vgc") || lowerFormat.includes("doubles")) {
      return `
DYNAMAX (Gen 8 Mechanic):
- Any Pokemon can Dynamax once per battle (doubles HP, boosts moves)
- Max Moves have secondary effects (Max Airstream boosts Speed, Max Steelspike sets Spikes, etc.)
- Plan which Pokemon will Dynamax - typically sweepers or setup Pokemon
- Note: tera_type field is NOT used in Gen 8 - leave it empty or omit`;
    }
    return `
GEN 8 NOTES:
- Dynamax is banned in Smogon singles formats
- No Terastallization in this generation
- Note: tera_type field is NOT used in Gen 8 - leave it empty or omit`;
  }

  if (gen === 7) {
    return `
Z-MOVES & MEGA EVOLUTION (Gen 7 Mechanics):
- Z-Crystals: One Pokemon can hold a Z-Crystal for a powerful one-time Z-Move
  - Type Z-Crystals (e.g., Groundium Z) boost any move of that type
  - Signature Z-Crystals for specific Pokemon (e.g., Pikashunium Z)
- Mega Evolution: Pokemon holding Mega Stones can Mega Evolve (once per battle)
  - Include "-Mega" suffix for Mega forms (e.g., "Charizard-Mega-X")
  - Mega Pokemon get boosted stats and sometimes new abilities/types
- Only ONE Mega OR Z-Move user per team typically
- Note: tera_type field is NOT used in Gen 7 - leave it empty or omit`;
  }

  if (gen <= 6) {
    return `
MEGA EVOLUTION (Gen 6 Mechanic):
- Pokemon holding Mega Stones can Mega Evolve once per battle
- Include "-Mega" suffix for Mega forms (e.g., "Kangaskhan-Mega")
- Plan your Mega Evolution user carefully - only one per team
- Note: tera_type field is NOT used in Gen 6 - leave it empty or omit`;
  }

  return "";
}

/**
 * Build the system prompt with personality enrichment and mode-specific guidance
 */
export function buildSystemPrompt(
  personalityId: PersonalityId,
  format: string,
  teamSize: number,
  mode: Mode = "singles"
): string {
  const personality = getPersonality(personalityId);
  const gen = getGeneration(format);
  const gimmickGuidance = getGimmickGuidance(format);

  const loreSection = personality.loreReferences.length > 0
    ? `\n\nCHARACTER BACKGROUND (use these naturally in conversation):\n${personality.loreReferences.map(l => `- ${l.topic}: "${l.reference}"`).join('\n')}`
    : "";

  const preferredPokemonSection = personality.preferredPokemon.length > 0
    ? `\n\nYOUR FAVORITE POKEMON (show extra enthusiasm for these):\n${personality.preferredPokemon.join(', ')}`
    : "";

  const feedbackSection = `\n\nFEEDBACK STYLE:\n- When praising: ${personality.praiseStyle[0]}\n- When critiquing: ${personality.criticismStyle[0]}`;

  const modeGuidance = getModeGuidance(mode);

  // Build tool fields list based on generation
  const toolFields = gen >= 9
    ? `- pokemon: Species name (e.g., "Great Tusk")
- moves: Array of 4 move names
- ability: The Pokemon's ability
- item: Held item
- nature: Nature name (e.g., "Jolly", "Modest")
- tera_type: Tera type for terastallization (REQUIRED for Gen 9)
- evs: Object with hp, atk, def, spa, spd, spe values
- reason: Brief explanation of the choice`
    : `- pokemon: Species name (e.g., "Landorus-Therian")
- moves: Array of 4 move names
- ability: The Pokemon's ability
- item: Held item (include Mega Stone or Z-Crystal if applicable)
- nature: Nature name (e.g., "Jolly", "Modest")
- evs: Object with hp, atk, def, spa, spd, spe values
- reason: Brief explanation of the choice`;

  return `${personality.systemPromptPrefix}${loreSection}${preferredPokemonSection}${feedbackSection}

You are helping with Pokemon competitive team building for ${format.toUpperCase()}.
${modeGuidance}
${gimmickGuidance}

CRITICAL RULES:
1. ONLY suggest Pokemon that are legal in ${format.toUpperCase()}. Reference the meta threats list.
2. ONLY use moves from the "Popular Moves" section when provided. These are VERIFIED learnable moves.
3. If no popular sets are provided for a Pokemon, use ONLY standard competitive moves you are certain it can learn.
4. NEVER suggest moves like Trick Room, Wish, or other specialized moves unless you see them in the Popular Moves list.
5. Use REAL abilities from the "Popular Abilities" section when provided.
6. When suggesting team changes, use the modify_team tool to make changes.
7. DO NOT flag item+move combinations as "illegal" unless they are truly impossible (e.g., Assault Vest + status moves). Choice items + Protect is LEGAL.
8. ALWAYS include competitive EV spreads (totaling 508-510 EVs). Common spreads:
   - Offensive: 252 Atk or SpA / 4 Def or SpD / 252 Spe
   - Bulky: 252 HP / 252 Def or SpD / 4 Atk or SpA
   - Mixed bulk: 252 HP / 128 Def / 128 SpD

CURRENT TEAM STATUS:
- Team has ${teamSize} Pokemon (slots 0-${teamSize - 1} are filled, slots ${teamSize}-5 are empty)
- Use "add_pokemon" ONLY for empty slots (${teamSize > 5 ? "team is full!" : `slot ${teamSize} is the next empty slot`})
- Use "replace_pokemon" to swap out an existing Pokemon at their slot
- Use "update_pokemon" to change an existing Pokemon (e.g., change item, swap a move)

USING THE modify_team TOOL:
When the user asks you to add, replace, or modify Pokemon, use the modify_team tool. You can call it multiple times to build a full team.

IMPORTANT: Always provide COMPLETE Pokemon data for every tool call, including:
- pokemon name
- ALL 4 moves (even if only changing one move, include all 4)
- ability
- item
- nature
- evs (full spread)
- tera_type (for Gen 9)
Do NOT send partial data - always send the full build.

For each Pokemon, include:
${toolFields}

Guidelines:
- Be concise and actionable in your explanations
- Reference the meta threats when suggesting counters
- Explain type synergies and team composition briefly
- When building a team, state your strategy/archetype FIRST, then use tools
- If suggesting to replace a Pokemon, reference which one by name and slot number
- When in doubt about a move, check the Popular Moves list or suggest a safe STAB move`;
}

/**
 * Build the full user message with context sections
 */
export function buildUserMessage(
  teamContext: string,
  metaThreats: string,
  popularSetsContext: string,
  message: string,
  format: string,
  team?: TeamPokemon[],
  mode?: Mode,
  teammateAnalysis?: string
): string {
  let contextSection = "";
  if (metaThreats) {
    contextSection += `\n\n## Current Meta Threats (${format}):\n${metaThreats}`;
  }
  if (popularSetsContext) {
    contextSection += `\n\n## Popular Sets (USE THESE MOVES - they are verified legal):\n${popularSetsContext}`;
  }

  // Add VGC-specific team analysis if in VGC mode
  if (mode === "vgc" && team && team.length > 0) {
    const vgcAnalysis = getVGCAnalysisSummary(team);
    if (vgcAnalysis) {
      contextSection += `\n\n## ${vgcAnalysis}`;
    }
  }

  // Add teammate synergy suggestions (useful for both modes but especially VGC)
  if (teammateAnalysis) {
    contextSection += `\n\n## ${teammateAnalysis}`;
  }

  return `Current Team:
${teamContext}
${contextSection}

User's Question: ${message}`;
}
