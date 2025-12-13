# PokeMCP Team Builder

Interactive web application for Pokemon competitive team building with AI-powered assistance.

**Live:** [www.pokemcp.com](https://www.pokemcp.com)

## Features

- **Team Building** - Import/export Showdown format, click-to-edit Pokemon sets
- **AI Chat Assistant** - Get team advice, coverage analysis, and suggestions
- **Threat Matrix** - Visual matchup analysis vs top meta threats
- **Team History** - Track changes with diff view
- **Format Support** - Gen 7-9 Singles and VGC formats

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **UI:** shadcn/ui + Tailwind CSS 4
- **State:** Zustand
- **Data Fetching:** TanStack Query
- **Deployment:** Cloudflare Pages via OpenNext
- **API:** Connects to PokeMCP server at api.pokemcp.com

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test:run

# Type checking
npx tsc --noEmit

# Build for production
npm run pages:build

# Deploy to Cloudflare Pages
npm run deploy
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Main team builder page
│   ├── layout.tsx         # Root layout with providers
│   └── api/
│       ├── mcp/           # MCP proxy endpoint
│       └── ai/            # AI chat endpoints
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, FormatSelector
│   ├── team/              # TeamGrid, PokemonEditDialog, PokemonSprite
│   ├── chat/              # ChatPanel, ChatMessages, ActionCard
│   ├── analysis/          # ThreatMatrix, AnalysisTabs
│   └── history/           # TeamHistory, TeamDiff
├── stores/
│   ├── team-store.ts      # Team state (format, pokemon)
│   ├── chat-store.ts      # Chat messages and actions
│   └── history-store.ts   # Undo/redo history
├── lib/
│   ├── mcp-client.ts      # MCP server client + React Query hooks
│   ├── showdown-parser.ts # Parse/export Showdown format
│   └── data/              # Pokemon types, formats
└── types/
    ├── pokemon.ts         # TeamPokemon, BaseStats, etc.
    └── chat.ts            # ChatMessage, TeamAction
```

## Environment Variables

```bash
# MCP server URL (defaults to api.pokemcp.com)
NEXT_PUBLIC_MCP_URL=https://api.pokemcp.com
```

## Related

- [PokeMCP Docs](https://docs.pokemcp.com) - Full documentation
- [MCP Server](../../) - Root directory contains the MCP server
