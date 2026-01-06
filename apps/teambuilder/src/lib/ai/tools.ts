/**
 * Claude tool definitions for structured team modifications
 */

export const TEAM_TOOLS = [
  {
    name: "modify_team",
    description: `Modify the user's Pokemon team. Use this tool to add, replace, update, or remove Pokemon.

Action types:
- "add_pokemon": Add a new Pokemon to an empty slot
- "replace_pokemon": Replace an existing Pokemon entirely
- "update_pokemon": Update specific fields of an existing Pokemon (moves, item, ability, etc.)
- "remove_pokemon": Remove a Pokemon from the team

For add/replace/update, provide the full Pokemon data in the payload.
For granular updates, you can update just specific fields (e.g., only item, only one move).`,
    input_schema: {
      type: "object" as const,
      properties: {
        action_type: {
          type: "string",
          enum: ["add_pokemon", "replace_pokemon", "update_pokemon", "remove_pokemon"],
          description: "The type of modification to make",
        },
        slot: {
          type: "number",
          description: "Team slot (0-5). For add_pokemon, use the next empty slot.",
        },
        reason: {
          type: "string",
          description: "Brief explanation of why this change is being made",
        },
        pokemon: {
          type: "string",
          description: "Pokemon species name (e.g., 'Great Tusk', 'Gholdengo')",
        },
        moves: {
          type: "array",
          items: { type: "string" },
          description: "Array of 4 move names",
        },
        ability: {
          type: "string",
          description: "Pokemon's ability",
        },
        item: {
          type: "string",
          description: "Held item",
        },
        nature: {
          type: "string",
          description: "Pokemon's nature (e.g., 'Jolly', 'Modest')",
        },
        tera_type: {
          type: "string",
          description: "Tera type for terastallization",
        },
        evs: {
          type: "object",
          properties: {
            hp: { type: "number" },
            atk: { type: "number" },
            def: { type: "number" },
            spa: { type: "number" },
            spd: { type: "number" },
            spe: { type: "number" },
          },
          description: "EV spread (should total 508-510)",
        },
        ivs: {
          type: "object",
          properties: {
            hp: { type: "number" },
            atk: { type: "number" },
            def: { type: "number" },
            spa: { type: "number" },
            spd: { type: "number" },
            spe: { type: "number" },
          },
          description: "IV spread (usually 31s, but 0 Atk for special attackers, 0 Spe for Trick Room)",
        },
        move_slot: {
          type: "number",
          description: "For single move updates, which slot (0-3) to change",
        },
      },
      required: ["action_type", "slot", "reason"],
    },
  },
];

/**
 * Type for the tool input
 */
export interface ModifyTeamInput {
  action_type: "add_pokemon" | "replace_pokemon" | "update_pokemon" | "remove_pokemon";
  slot: number;
  reason: string;
  pokemon?: string;
  moves?: string[];
  ability?: string;
  item?: string;
  nature?: string;
  tera_type?: string;
  evs?: {
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  };
  ivs?: {
    hp?: number;
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
  };
  move_slot?: number;
}

