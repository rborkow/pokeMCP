import type { TeamPokemon } from "@/types/pokemon";

/**
 * Format a team for inclusion in prompts
 */
export function formatTeamForPrompt(team: TeamPokemon[]): string {
  if (team.length === 0) {
    return "No Pokemon in team yet.";
  }

  return team
    .map((p, i) => {
      const parts = [`${i + 1}. ${p.pokemon}`];
      if (p.item) parts.push(`@ ${p.item}`);
      if (p.ability) parts.push(`(${p.ability})`);
      if (p.teraType) parts.push(`[Tera: ${p.teraType}]`);
      if (p.moves.length > 0) {
        parts.push(`\n   Moves: ${p.moves.join(", ")}`);
      }
      if (p.evs) {
        const evStr = Object.entries(p.evs)
          .filter(([, v]) => v && v > 0)
          .map(([k, v]) => `${v} ${k.toUpperCase()}`)
          .join(" / ");
        if (evStr) parts.push(`\n   EVs: ${evStr}`);
      }
      if (p.nature) parts.push(`\n   Nature: ${p.nature}`);
      return parts.join(" ");
    })
    .join("\n\n");
}

/**
 * Build the system prompt for the AI
 */
export function buildSystemPrompt(format: string): string {
  return `You are a Pokemon competitive team building assistant specializing in ${format.toUpperCase()} format.

Your role is to help users build and improve their competitive Pokemon teams. You have access to:
- Deep knowledge of the ${format.toUpperCase()} metagame
- Type matchups and coverage analysis
- Common sets, EVs, and item choices
- Team synergy and threat assessment

When the user asks for team changes, you can suggest specific modifications. Format your suggestions as follows:

1. Explain your reasoning clearly
2. If suggesting a specific change, include an ACTION block:

[ACTION]
{
  "type": "add_pokemon" | "replace_pokemon" | "update_moveset" | "update_item" | "update_ability",
  "slot": 0-5,
  "payload": {
    "pokemon": "Pokemon Name",
    "moves": ["Move1", "Move2", "Move3", "Move4"],
    "ability": "Ability Name",
    "item": "Item Name",
    "nature": "Nature",
    "teraType": "Type"
  },
  "reason": "Brief reason for the change"
}
[/ACTION]

Guidelines:
- Be specific and actionable in your advice
- Consider the current metagame trends
- Explain type synergies and coverage gaps
- Suggest Pokemon that complement the existing team
- Keep responses concise but informative
- Only include fields in payload that are relevant to the change`;
}

/**
 * Build a user prompt with team context
 */
export function buildUserPrompt(message: string, team: TeamPokemon[]): string {
  const teamContext = formatTeamForPrompt(team);
  return `Current Team:
${teamContext}

User's Question: ${message}`;
}
