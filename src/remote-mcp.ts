#!/usr/bin/env node

/**
 * Remote MCP Server for Claude.ai Web Interface
 * Uses Streamable HTTP transport for remote connections
 *
 * Deploy this to Vercel/Railway/Render and add as a custom connector in Claude.ai
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import {
  lookupPokemon as lookupPokemonImpl,
  validateMoveset as validateMovesetImpl,
  validateTeam as validateTeamImpl,
  suggestTeamCoverage as suggestTeamCoverageImpl,
} from './tools.js';
import {
  getPopularSets,
  getMetaThreats,
  getTeammates,
  getChecksCounters,
  getMetagameStats,
} from './stats.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for Claude.ai
app.use(cors({
  origin: [
    'https://claude.ai',
    'https://*.claude.ai',
    'https://api.claude.com',
  ],
  credentials: true,
}));

app.use(express.json());

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
  {
    name: 'get_popular_sets',
    description: 'Get the most popular competitive sets for a Pokémon from Smogon usage statistics (moves, items, abilities, spreads)',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: {
          type: 'string',
          description: 'The Pokémon name',
        },
        format: {
          type: 'string',
          description: 'Format to check (e.g., "gen9ou", "gen9vgc2024"). Defaults to "gen9ou".',
        },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_meta_threats',
    description: 'Get the top threats in the metagame by usage percentage',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Format to check (e.g., "gen9ou", "gen9ubers"). Defaults to "gen9ou".',
        },
        limit: {
          type: 'number',
          description: 'Number of top Pokémon to show. Defaults to 20.',
        },
      },
    },
  },
  {
    name: 'get_teammates',
    description: 'Get common teammates for a Pokémon based on actual team compositions from competitive play',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: {
          type: 'string',
          description: 'The Pokémon name',
        },
        format: {
          type: 'string',
          description: 'Format to check (e.g., "gen9ou"). Defaults to "gen9ou".',
        },
        limit: {
          type: 'number',
          description: 'Number of teammates to show. Defaults to 10.',
        },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_checks_counters',
    description: 'Get the most effective checks and counters for a Pokémon based on battle statistics',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: {
          type: 'string',
          description: 'The Pokémon name',
        },
        format: {
          type: 'string',
          description: 'Format to check (e.g., "gen9ou"). Defaults to "gen9ou".',
        },
        limit: {
          type: 'number',
          description: 'Number of checks/counters to show. Defaults to 15.',
        },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_metagame_stats',
    description: 'Get overall metagame statistics including playstyle distribution and unique Pokémon count',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Format to check (e.g., "gen9ou"). Defaults to "gen9ou".',
        },
      },
    },
  },
];

// Create MCP Server
const server = new Server(
  {
    name: 'pokemon-mcp-server',
    version: '0.2.0',
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
      case 'lookup_pokemon': {
        const lookupResult = lookupPokemonImpl(args as { pokemon: string; generation?: string });
        return {
          content: [{ type: 'text' as const, text: lookupResult }],
        };
      }

      case 'validate_moveset': {
        const movesetResult = validateMovesetImpl(args as { pokemon: string; moves: string[]; generation?: string });
        return {
          content: [{ type: 'text' as const, text: movesetResult }],
        };
      }

      case 'validate_team': {
        const teamResult = validateTeamImpl(args as { team: any[]; format?: string });
        return {
          content: [{ type: 'text' as const, text: teamResult }],
        };
      }

      case 'suggest_team_coverage': {
        const coverageResult = suggestTeamCoverageImpl(args as { current_team: string[]; format?: string });
        return {
          content: [{ type: 'text' as const, text: coverageResult }],
        };
      }

      case 'get_popular_sets': {
        const setsResult = await getPopularSets(args as { pokemon: string; format?: string });
        return {
          content: [{ type: 'text' as const, text: setsResult }],
        };
      }

      case 'get_meta_threats': {
        const threatsResult = await getMetaThreats(args as { format?: string; limit?: number });
        return {
          content: [{ type: 'text' as const, text: threatsResult }],
        };
      }

      case 'get_teammates': {
        const teammatesResult = await getTeammates(args as { pokemon: string; format?: string; limit?: number });
        return {
          content: [{ type: 'text' as const, text: teammatesResult }],
        };
      }

      case 'get_checks_counters': {
        const countersResult = await getChecksCounters(args as { pokemon: string; format?: string; limit?: number });
        return {
          content: [{ type: 'text' as const, text: countersResult }],
        };
      }

      case 'get_metagame_stats': {
        const metaResult = await getMetagameStats(args as { format?: string });
        return {
          content: [{ type: 'text' as const, text: metaResult }],
        };
      }

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

// Health check / protocol discovery
app.head('/', (req, res) => {
  res.setHeader('X-MCP-Version', '2024-11-05');
  res.setHeader('X-MCP-Transport', 'sse');
  res.status(200).end();
});

app.get('/', (req, res) => {
  res.json({
    name: 'Pokémon MCP Server',
    version: '0.2.0',
    description: 'Remote MCP server for Pokémon team building and validation',
    transport: 'sse',
    endpoints: {
      sse: '/sse',
      message: '/message',
    },
  });
});

// SSE endpoint for server -> client messages
app.get('/sse', async (req, res) => {
  const transport = new SSEServerTransport('/message', res);
  await server.connect(transport);
  console.log('SSE client connected');
});

// Message endpoint for client -> server messages
app.post('/message', async (req, res) => {
  // The SSE transport handles this internally
  res.status(200).json({ received: true });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Remote Pokémon MCP Server running on http://localhost:${PORT}`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`✉️  Message endpoint: http://localhost:${PORT}/message`);
  console.log(`\n🔗 Add to Claude.ai:`);
  console.log(`   URL: https://your-deployment.vercel.app`);
});
