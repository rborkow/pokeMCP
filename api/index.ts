import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  lookupPokemon as lookupPokemonImpl,
  validateMoveset as validateMovesetImpl,
  validateTeam as validateTeamImpl,
  suggestTeamCoverage as suggestTeamCoverageImpl,
} from '../src/tools.js';
import {
  getPopularSets,
  getMetaThreats,
  getTeammates,
  getChecksCounters,
  getMetagameStats,
} from '../src/stats.js';

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: 'lookup_pokemon',
    description: 'Look up detailed information about a Pokémon including stats, types, abilities, and available moves',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: { type: 'string', description: 'The name of the Pokémon to look up' },
        generation: { type: 'string', description: 'Optional: Game generation (e.g., "9")' },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'validate_moveset',
    description: 'Check if a moveset is legal for a specific Pokémon',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: { type: 'string' },
        moves: { type: 'array', items: { type: 'string' } },
        generation: { type: 'string' },
      },
      required: ['pokemon', 'moves'],
    },
  },
  {
    name: 'validate_team',
    description: 'Validate a team against format rules',
    inputSchema: {
      type: 'object',
      properties: {
        team: { type: 'array', items: { type: 'object' } },
        format: { type: 'string' },
      },
      required: ['team'],
    },
  },
  {
    name: 'suggest_team_coverage',
    description: 'Analyze team coverage and suggest improvements',
    inputSchema: {
      type: 'object',
      properties: {
        current_team: { type: 'array', items: { type: 'string' } },
        format: { type: 'string' },
      },
      required: ['current_team'],
    },
  },
  {
    name: 'get_popular_sets',
    description: 'Get popular sets from Smogon usage statistics',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: { type: 'string' },
        format: { type: 'string' },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_meta_threats',
    description: 'Get top threats in the metagame',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_teammates',
    description: 'Get common teammates for a Pokémon',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: { type: 'string' },
        format: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_checks_counters',
    description: 'Get checks and counters for a Pokémon',
    inputSchema: {
      type: 'object',
      properties: {
        pokemon: { type: 'string' },
        format: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['pokemon'],
    },
  },
  {
    name: 'get_metagame_stats',
    description: 'Get overall metagame statistics',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string' },
      },
    },
  },
];

// Create MCP server instance
function createServer() {
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

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'lookup_pokemon':
          return {
            content: [{ type: 'text' as const, text: lookupPokemonImpl(args as any) }],
          };
        case 'validate_moveset':
          return {
            content: [{ type: 'text' as const, text: validateMovesetImpl(args as any) }],
          };
        case 'validate_team':
          return {
            content: [{ type: 'text' as const, text: validateTeamImpl(args as any) }],
          };
        case 'suggest_team_coverage':
          return {
            content: [{ type: 'text' as const, text: suggestTeamCoverageImpl(args as any) }],
          };
        case 'get_popular_sets':
          return {
            content: [{ type: 'text' as const, text: await getPopularSets(args as any) }],
          };
        case 'get_meta_threats':
          return {
            content: [{ type: 'text' as const, text: await getMetaThreats(args as any) }],
          };
        case 'get_teammates':
          return {
            content: [{ type: 'text' as const, text: await getTeammates(args as any) }],
          };
        case 'get_checks_counters':
          return {
            content: [{ type: 'text' as const, text: await getChecksCounters(args as any) }],
          };
        case 'get_metagame_stats':
          return {
            content: [{ type: 'text' as const, text: await getMetagameStats(args as any) }],
          };
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

  return server;
}

// Store server instances per session
const servers = new Map<string, Server>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Debug logging
  console.log(`[MCP] ${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query
  });

  // Set CORS headers - allow all Claude domains
  const origin = req.headers.origin || req.headers.referer;
  if (origin && (origin.includes('claude.ai') || origin.includes('claude.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://claude.ai');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // OAuth discovery endpoints - return 404 to signal authless server
  if (req.url?.includes('/.well-known/oauth') || req.url?.includes('/register')) {
    res.status(404).json({ error: 'OAuth not supported - this is an authless server' });
    return;
  }

  // Protocol discovery endpoint
  if (req.method === 'HEAD' && req.url === '/') {
    res.setHeader('X-MCP-Version', '2024-11-05');
    res.setHeader('X-MCP-Transport', 'sse');
    res.status(200).end();
    return;
  }

  // Info endpoint
  if (req.method === 'GET' && req.url === '/') {
    res.status(200).json({
      name: 'Pokémon MCP Server',
      version: '0.2.0',
      description: 'Remote MCP server for Pokémon team building and validation',
      transport: 'sse',
      capabilities: {
        tools: true,
      },
      endpoints: {
        sse: '/sse',
        message: '/message',
      },
    });
    return;
  }

  // SSE endpoint - handle both GET /sse and POST / (for MCP protocol)
  const isSSE = (req.method === 'GET' && (req.url?.includes('/sse') || req.url === '/sse')) ||
                (req.method === 'POST' && req.url === '/');

  if (isSSE) {
    const sessionId = req.query.sessionId as string || 'default';

    let server = servers.get(sessionId);
    if (!server) {
      server = createServer();
      servers.set(sessionId, server);
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial comment to establish connection
    res.write(':ok\n\n');
    res.flush?.();

    const transport = new SSEServerTransport('/message', res);

    try {
      await server.connect(transport);
    } catch (error) {
      console.error('[MCP] Connection error:', error);
    }

    req.on('close', () => {
      console.log('[MCP] Client disconnected');
      servers.delete(sessionId);
    });

    // Don't call res.end() - keep connection open
    return;
  }

  // Message endpoint - handle both /message and /api/message paths
  const isMessage = req.method === 'POST' && (req.url?.includes('/message') || req.url === '/message');
  if (isMessage) {
    res.status(200).json({ received: true });
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
