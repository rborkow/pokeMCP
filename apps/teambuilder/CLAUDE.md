# Teambuilder App

Next.js 16 App Router application for competitive Pokemon team building with an AI coach.

## Tech Stack

- **UI**: Tailwind CSS 4, Radix UI primitives, shadcn/ui, Lucide icons
- **State**: Zustand 5 with `persist` middleware (localStorage)
- **Data Fetching**: TanStack Query v5
- **Forms**: React Hook Form + Zod 4
- **Deploy**: Cloudflare Pages via `@opennextjs/cloudflare` (see `open-next.config.ts`)

## Directory Layout

```
src/
├── app/                        # Next.js App Router (layout, page, api routes)
│   └── api/ai/claude/stream/   # SSE streaming endpoint for AI coach
├── components/
│   ├── ui/           # shadcn primitives (button, dialog, tabs, etc.)
│   ├── chat/         # ChatPanel, message rendering, ActionCard
│   ├── team/         # TeamGrid, TeamImportExport, PokemonEditDialog
│   ├── analysis/     # TypeCoverage, ThreatMatrix, SpeedTiers
│   ├── pokemon/      # Pokemon card/slot components
│   ├── welcome/      # WelcomeOverlay onboarding flow
│   ├── feedback/     # FeedbackButton + dialog
│   ├── layout/       # Header, FormatSelector
│   ├── history/      # TeamHistory (undo/redo)
│   └── errors/       # ErrorBoundary
├── stores/
│   ├── team-store.ts      # Team state, format, mode, import/export
│   ├── chat-store.ts      # Chat messages, streaming state, queued prompts
│   └── history-store.ts   # Undo/redo snapshots (last 50 entries)
├── hooks/            # usePokemonData, usePokemonEditState, useUrlTeam
├── lib/
│   ├── ai/           # AI coach logic (see root CLAUDE.md for details)
│   ├── validation/   # pokemon.ts - EV/IV/data validation
│   ├── data/         # Static Pokemon data (types, moves, items)
│   ├── utils.ts      # cn() = clsx + tailwind-merge
│   ├── showdown-parser.ts   # Showdown format import/export
│   ├── share.ts             # URL-based team sharing
│   ├── mcp-client.ts        # REST client for api.pokemcp.com/api/tools
│   └── speed-calc.ts, threat-matrix-utils.ts, vgc-analysis.ts
└── types/
    └── pokemon.ts    # TeamPokemon, FormatId, Mode, format lists
```

## Conventions

- **File naming**: `PascalCase.tsx` for components, `camelCase.ts` for utilities, `kebab-case/` for directories
- **Imports**: Always use `@/` path alias; use `import type` for type-only imports
- **Client components**: Add `"use client"` directive at top of interactive components
- **Variants**: Use `class-variance-authority` (CVA) for component variants
- **Classnames**: Use `cn()` from `@/lib/utils` (never raw `clsx` or string concatenation)
- **Icons**: Use `lucide-react` — do not add other icon libraries
- **Exports**: Named exports for components/utilities; default exports only in `page.tsx`

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `NEXT_PUBLIC_MCP_URL` | No | `https://api.pokemcp.com` |
| `ANTHROPIC_API_KEY` | Yes (for AI) | — |

## Testing

- **Framework**: Vitest 4 + React Testing Library + jsdom
- **Config**: `vitest.config.ts` (resolves `@/` alias), `vitest.setup.ts`
- **Location**: `src/__tests__/` (unit tests), `src/__tests__/components/` (component tests)
- **Run**: `npm run test:run` (single run) or `npm run test:coverage`

## AI Streaming Flow

1. `ChatPanel` calls `streamChatMessage()` from `lib/ai/index.ts`
2. POST to `/api/ai/claude/stream` (SSE endpoint)
3. Route fetches MCP context in parallel (meta threats, popular sets, teammates)
4. Streams Claude response with `modify_team` tool calls
5. Client parses tool calls into `TeamAction` objects rendered as approval cards
6. Rate limited: 10 requests/minute per IP
