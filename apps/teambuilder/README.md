# PokeMCP Team Builder

Interactive web application for Pokemon competitive team building with AI-powered assistance.

**Live:** [www.pokemcp.com](https://www.pokemcp.com)

## Features

### Team Building
- Import/export Showdown format with shareable URLs
- Click-to-edit Pokemon sets with full EV/IV/nature support
- Drag-and-drop team reordering
- Quick format toggle (Singles/VGC) with advanced format dropdown

### AI Coach
- Claude-powered assistant with personality themes (Professor Kukui, Oak, Blue)
- Team Archetypes for guided generation:
  - **Singles**: Hyper Offense, Bulky Offense, Balance, Stall, Weather
  - **Doubles/VGC**: Goodstuffs, Trick Room, Tailwind, Sun, Rain, Sand
  - **Goblin Mode**: Wolfe Glick-inspired creative/unorthodox teams
- Context-aware suggestions using teammate analysis
- Streaming responses with tool call visualization

### Analysis Tools
- **Type Coverage**: Visual breakdown of weaknesses and resistances
- **Threat Matrix**: Matchup analysis vs top meta threats with usage weighting
- **Speed Tiers**: Calculated speed stats at Level 50 with:
  - Speed tier classification (very fast → very slow)
  - Benchmark comparisons (outspeeds X, outsped by Y)
  - Speed control detection (Tailwind, Trick Room, Icy Wind)
  - Modifier badges (Choice Scarf, Tailwind access)

### VGC Features
- Bring Four selector for team preview practice
- VGC-specific tips and warnings
- Format fallback for newer regulations without stats data

### Team History
- Track changes with diff view
- Undo/redo support
- Reset button to clear team, chat, and history

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
│       └── ai/claude/     # AI chat streaming endpoint
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Header, FormatSelector, ModeToggle
│   ├── team/              # TeamGrid, TeamSlot, PokemonEditDialog, BringFourSelector
│   ├── chat/              # ChatPanel, ChatMessages, ActionCard, ThinkingCollapsible
│   ├── analysis/          # TypeCoverage, ThreatMatrix, SpeedTiers, VGCTeamWarnings
│   ├── history/           # TeamHistory, TeamDiff
│   └── welcome/           # WelcomeOverlay, ArchetypeSelector
├── stores/
│   ├── team-store.ts      # Team state (format, mode, pokemon)
│   ├── chat-store.ts      # Chat messages, actions, personality
│   └── history-store.ts   # Undo/redo history
├── lib/
│   ├── ai/                # AI integration
│   │   ├── index.ts       # Streaming client with tool parsing
│   │   ├── context.ts     # System prompts, team formatting
│   │   ├── tools.ts       # Claude tool schema (modify_team)
│   │   ├── archetypes.ts  # Team archetype definitions
│   │   └── personalities.ts # AI personality configs
│   ├── mcp-client.ts      # MCP server client + React Query hooks
│   ├── showdown-parser.ts # Parse/export Showdown format
│   ├── speed-calc.ts      # Speed calculation and tier classification
│   └── data/              # Pokemon types, base stats, formats
└── types/
    ├── pokemon.ts         # TeamPokemon, Mode, Format types
    └── chat.ts            # ChatMessage, TeamAction
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for AI coach ([get one](https://console.anthropic.com/)) |
| `NEXT_PUBLIC_MCP_URL` | No | MCP API URL (defaults to `https://api.pokemcp.com`) |

## Related

- [PokeMCP Docs](https://docs.pokemcp.com) - Full documentation
- [MCP Server](../../) - Root directory contains the MCP server
