import { getPersonality, type PersonalityId } from "./personalities";

export interface TeamPokemon {
  pokemon: string;
  moves?: string[];
  ability?: string;
  item?: string;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

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
 * Format team array into readable context string
 */
export function formatTeamContext(team: TeamPokemon[]): string {
  if (team.length === 0) {
    return "No Pokemon in team yet.";
  }
  return team.map((p, i) => {
    const parts = [`${i + 1}. ${p.pokemon}`];
    if (p.item) parts.push(`@ ${p.item}`);
    if (p.ability) parts.push(`(${p.ability})`);
    if (p.moves && p.moves.length > 0) parts.push(`- Moves: ${p.moves.join(", ")}`);
    return parts.join(" ");
  }).join("\n");
}

/**
 * Build the system prompt with personality enrichment
 */
export function buildSystemPrompt(personalityId: PersonalityId, format: string, teamSize: number): string {
  const personality = getPersonality(personalityId);

  const loreSection = personality.loreReferences.length > 0
    ? `\n\nCHARACTER BACKGROUND (use these naturally in conversation):\n${personality.loreReferences.map(l => `- ${l.topic}: "${l.reference}"`).join('\n')}`
    : "";

  const preferredPokemonSection = personality.preferredPokemon.length > 0
    ? `\n\nYOUR FAVORITE POKEMON (show extra enthusiasm for these):\n${personality.preferredPokemon.join(', ')}`
    : "";

  const feedbackSection = `\n\nFEEDBACK STYLE:\n- When praising: ${personality.praiseStyle[0]}\n- When critiquing: ${personality.criticismStyle[0]}`;

  return `${personality.systemPromptPrefix}${loreSection}${preferredPokemonSection}${feedbackSection}

You are helping with Pokemon competitive team building for ${format.toUpperCase()}.

CRITICAL RULES:
1. ONLY suggest Pokemon that are legal in ${format.toUpperCase()}. Reference the meta threats list.
2. ONLY use moves from the "Popular Moves" section when provided. These are VERIFIED learnable moves.
3. If no popular sets are provided for a Pokemon, use ONLY standard competitive moves you are certain it can learn.
4. NEVER suggest moves like Trick Room, Wish, or other specialized moves unless you see them in the Popular Moves list.
5. Use REAL abilities from the "Popular Abilities" section when provided.
6. When suggesting team changes, use the modify_team tool to make changes.
7. ALWAYS include competitive EV spreads (totaling 508-510 EVs). Common spreads:
   - Offensive: 252 Atk or SpA / 4 Def or SpD / 252 Spe
   - Bulky: 252 HP / 252 Def or SpD / 4 Atk or SpA
   - Mixed bulk: 252 HP / 128 Def / 128 SpD

CURRENT TEAM STATUS:
- Team has ${teamSize} Pokemon (slots 0-${teamSize - 1} are filled, slots ${teamSize}-5 are empty)
- Use "add_pokemon" ONLY for empty slots (${teamSize > 5 ? "team is full!" : `slot ${teamSize} is the next empty slot`})
- Use "replace_pokemon" to swap out an existing Pokemon at their slot
- Use "update_pokemon" for partial updates to existing Pokemon

USING THE modify_team TOOL:
When the user asks you to add, replace, or modify Pokemon, use the modify_team tool. You can call it multiple times to build a full team.

For each Pokemon, include:
- pokemon: Species name (e.g., "Great Tusk")
- moves: Array of 4 move names
- ability: The Pokemon's ability
- item: Held item
- nature: Nature name (e.g., "Jolly", "Modest")
- tera_type: Tera type for terastallization
- evs: Object with hp, atk, def, spa, spd, spe values
- reason: Brief explanation of the choice

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
  format: string
): string {
  let contextSection = "";
  if (metaThreats) {
    contextSection += `\n\n## Current Meta Threats (${format}):\n${metaThreats}`;
  }
  if (popularSetsContext) {
    contextSection += `\n\n## Popular Sets (USE THESE MOVES - they are verified legal):\n${popularSetsContext}`;
  }

  return `Current Team:
${teamContext}
${contextSection}

User's Question: ${message}`;
}
