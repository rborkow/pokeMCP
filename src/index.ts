#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  lookupPokemon as lookupPokemonImpl,
  validateMoveset as validateMovesetImpl,
  validateTeam as validateTeamImpl,
  suggestTeamCoverage as suggestTeamCoverageImpl,
} from './tools.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'lookup_pokemon',
    description: 'Look up detailed information about a Pokémon including stats, types, abilities, and available moves',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: {
          type: 'string',
          description: 'The name of the Pokémon to look up (e.g., "Pikachu", "Charizard")',
        },
        generation: {
          type: 'string',
          description: 'Optional: Game generation to check (e.g., "9" for Gen 9). Defaults to latest.',
        },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'validate_moveset',
    description: 'Check if a moveset is legal for a specific Pokémon in a given generation/format',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: {
          type: 'string',
          description: 'The Pokémon name',
        },
        moves: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of move names to validate',
        },
        generation: {
          type: 'string',
          description: 'Game generation (e.g., "9"). Defaults to latest.',
        },
      },
      required: ['pokemon', 'moves'],
    },
  },
  {
    name: 'validate_team',
    description: 'Validate a team of 6 Pokémon against format rules (Species Clause, move legality, tier restrictions)',
    inputSchema: {
      type: 'object',
      properties: {
        team: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pokemon: { type: 'string' },
              moves: {
                type: 'array',
                items: { type: 'string' },
              },
              ability: { type: 'string' },
              item: { type: 'string' },
            },
            required: ['pokemon', 'moves'],
          },
          description: 'Array of team members with their movesets',
        },
        format: {
          type: 'string',
          description: 'Format to validate against (e.g., "OU", "Ubers", "VGC2024"). Defaults to "OU".',
        },
      },
      required: ['team'],
    },
  },
  {
    name: 'suggest_team_coverage',
    description: 'Analyze a partial team and suggest Pokémon to improve type coverage and handle threats',
    inputSchema: {
      type: 'object',
      properties: {
        current_team: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Pokémon names currently on the team',
        },
        format: {
          type: 'string',
          description: 'Format for suggestions (e.g., "OU"). Defaults to "OU".',
        },
      },
      required: ['current_team'],
    },
  },
];

// Server implementation
const server = new Server(
  {
    name: 'pokemon-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'lookup_pokemon':
        return await lookupPokemon(args as { pokemon: string; generation?: string });

      case 'validate_moveset':
        return await validateMoveset(args as { pokemon: string; moves: string[]; generation?: string });

      case 'validate_team':
        return await validateTeam(args as { team: any[]; format?: string });

      case 'suggest_team_coverage':
        return await suggestTeamCoverage(args as { current_team: string[]; format?: string });

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Tool implementations
async function lookupPokemon(args: { pokemon: string; generation?: string }) {
  const result = lookupPokemonImpl(args);
  return {
    content: [{ type: 'text' as const, text: result }],
  };
}

async function validateMoveset(args: { pokemon: string; moves: string[]; generation?: string }) {
  const result = validateMovesetImpl(args);
  return {
    content: [{ type: 'text' as const, text: result }],
  };
}

async function validateTeam(args: { team: any[]; format?: string }) {
  const result = validateTeamImpl(args);
  return {
    content: [{ type: 'text' as const, text: result }],
  };
}

async function suggestTeamCoverage(args: { current_team: string[]; format?: string }) {
  const result = suggestTeamCoverageImpl(args);
  return {
    content: [{ type: 'text' as const, text: result }],
  };
}

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Pokémon MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
