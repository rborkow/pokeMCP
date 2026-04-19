# Teambuilder App

Next.js 16 App Router application for competitive Pokemon team building with an AI coach. As of v2 the UI is chat-first: landing at `/`, the chat-driven builder at `/builder` (with a Grid-mode escape hatch at `?mode=grid`), and a 4-question LLM interview for cold starts.

## Tech Stack

- **UI**: Tailwind CSS 4, Radix UI primitives, shadcn/ui, Lucide icons
- **State**: Zustand 5 with `persist` middleware (localStorage) — three stores: team, chat, interview
- **Data Fetching**: TanStack Query v5 + TanStack AI (`useChat`) over a custom SSE connection adapter
- **Forms**: React Hook Form + Zod 4
- **Deploy**: Cloudflare Pages via `@opennextjs/cloudflare` (see `open-next.config.ts`)

## Routes

| Route | What lives there |
|-------|------------------|
| `/` | Landing page (hero + three CTAs + interview demo + three-moment sequence + dev footer). Auto-redirects to `/builder` for returning users with a saved team. |
| `/builder` | Chat-first builder (default). Renders the interview when the team is empty; otherwise a 60/40 split of chat + compact team panel + analysis strip. |
| `/builder?mode=grid` | Classic Grid layout (team grid + analysis tabs + side chat) preserved for power users. |
| `/builder?start=interview\|import\|empty` | Landing CTAs pass the user's intent into the builder. `import` auto-opens the import dialog; `empty` skips the interview. |
| `/t/[id]` | Shareable team view. Unchanged by v2. |
| `/admin` | Analytics dashboard. |
| `/api/ai/claude/stream` | Server-sent events endpoint for the chat coach. Streams AG-UI events (TEXT + tool calls). |
| `/api/ai/interview/stream` | Stateless synthesis endpoint for the LLM interview. Accepts the collected answers, streams six `modify_team` + one `interview_synthesis` tool call. |

## Directory Layout

```
src/
├── app/
│   ├── page.tsx                                # Landing
│   ├── builder/page.tsx                        # Delegates to BuilderLayout
│   ├── t/[id]/                                 # Shared team view
│   ├── admin/                                  # Analytics
│   └── api/
│       ├── ai/claude/stream/route.ts           # Chat SSE
│       ├── ai/interview/stream/route.ts        # Interview synthesis SSE
│       └── ai/cloudflare/, admin/, mcp/        # (unchanged)
├── components/
│   ├── ui/                                     # shadcn primitives
│   ├── landing/                                # Hero, StatusBar, InterviewDemoStatic,
│   │                                           # ThreeMoments, TrustChips, DeveloperFooter,
│   │                                           # EmptyStateCTAs, SavedTeamRedirect
│   ├── builder/                                # BuilderLayout (frame switcher),
│   │                                           # ChatFirstFrame, GridFrame
│   ├── interview/                              # InterviewShell, InterviewProgress,
│   │                                           # InterviewStep, AnswerChip, SynthesisPreview
│   ├── chat/                                   # ChatPanel, ChatMessages (timeline
│   │   ├── response/                           # DataCard, TeamDiffCard, MatchupView,
│   │   │                                       # AnalysisHighlight, ResponseDispatcher
│   │   └── SystemLogEntry.tsx                  # Inline "you changed X" line
│   ├── team/                                   # TeamGrid, TeamSlot (Grid mode),
│   │                                           # TeamSlotCompact, TeamStatePanel,
│   │                                           # NewSlotBadge, PokemonEditDialog,
│   │                                           # TeamImportExport (defaultImportOpen prop)
│   ├── analysis/                               # TypeCoverage/ThreatMatrix/SpeedTiers
│   │                                           # (Grid mode) + AnalysisStrip (chat-first)
│   ├── providers/SystemLogBridge.tsx           # team-store → chat-store.systemLog
│   ├── layout/Header.tsx, FormatSelector.tsx,  # ModeToggle (singles/VGC),
│   │         ModeSwitch.tsx                    # ModeSwitch (chat/grid)
│   ├── feedback/, history/, errors/            # (unchanged)
├── stores/
│   ├── team-store.ts      # team, format, mode, uiMode, lastModifiedAt, lastModificationSource
│   ├── chat-store.ts      # personality, enableThinking, systemLog, responseCards (v1 migration
│   │                       #   converts legacy "kukui" persistence → "coach")
│   ├── interview-store.ts # step, status, answers, synthesis intro/proposed/meta (not persisted)
│   └── history-store.ts   # Undo/redo snapshots
├── hooks/                 # usePokemonData, usePokemonEditState, useUrlTeam, useHasSavedTeam
├── lib/
│   ├── ai/
│   │   ├── personalities.ts   # Coach (default), Kukui, Oak, Blue (behind Advanced toggle)
│   │   ├── context.ts         # buildSystemPrompt, buildUserMessage (recentEdits block)
│   │   ├── connection.ts      # TanStack AI adapter; attaches recentEdits
│   │   ├── tools.ts           # modify_team + present_response_card Anthropic schemas
│   │   ├── tools-tanstack.ts  # modify_team client-side mirror
│   │   ├── interview-prompts.ts # 4 step definitions + synthesis system prompt
│   │   ├── interview-tools.ts   # interview_synthesis Anthropic schema
│   │   ├── response-types.ts    # zod discriminated union for response cards
│   │   ├── archetypes.ts, parse-tool-action.ts, …
│   ├── validation/, data/, utils.ts, showdown-parser.ts, share.ts, mcp-client.ts, …
└── types/pokemon.ts
```

## Conventions

- **File naming**: `PascalCase.tsx` for components, `camelCase.ts` for utilities, `kebab-case/` for directories
- **Imports**: Always use `@/` path alias; use `import type` for type-only imports
- **Client components**: Add `"use client"` directive at top of interactive components
- **Variants**: Use `class-variance-authority` (CVA) for component variants
- **Classnames**: Use `cn()` from `@/lib/utils` (never raw `clsx` or string concatenation)
- **Icons**: Use `lucide-react` — do not add other icon libraries
- **Exports**: Named exports for components/utilities; default exports only in `page.tsx`
- **Visual tokens**: The v2 direction retired all gradient/glow utilities. Use the flat tokens — `--surface-canvas`, `--surface-panel`, `--surface-inset`, `--border-hairline`, `--border-hairline-strong` — via the `.chat-first-surface / -panel / -inset` classes and `.signal-mono` for monospace labels.

## Environment Variables

| Variable | Required | Default |
|----------|----------|---------|
| `NEXT_PUBLIC_MCP_URL` | No | `https://api.pokemcp.com` |
| `ANTHROPIC_API_KEY` | Yes (for AI) | — |
| `CLOUDFLARE_AI_GATEWAY_URL` | No | Direct Anthropic API |
| `CF_AIG_TOKEN` | No | — |

## Testing

- **Framework**: Vitest 4 + React Testing Library + jsdom
- **Config**: `vitest.config.ts` (resolves `@/` alias), `vitest.setup.ts`
- **Location**: `src/__tests__/` (unit tests), `src/__tests__/components/` (component tests), `src/__tests__/hooks/` (hook tests)
- **Run**: `npm run test:run` (single run) or `npm run test:coverage`

## Chat-first architecture (v2)

The builder is a state machine of three UI shells driven by `team-store` and `interview-store`:

1. **Interview shell** — rendered when the team is empty and `interview-store.status` is not `skipped` or `applied`. Hand-authored 4-step outer loop; the LLM only runs for synthesis. Synthesis streams from `/api/ai/interview/stream`; proposed `modify_team` inputs stage in `interview-store.proposed`; Apply bulk-commits via `team-store.setPokemon(slot, pokemon, "ai")`.

2. **ChatFirstFrame** — default once a team exists. 60/40 split:
    - Left pane: `ChatPanel` with `layout="fill"` — flex-fills its container, runs against `/api/ai/claude/stream`, renders the unified timeline.
    - Right pane: `TeamStatePanel` — 2×3 `TeamSlotCompact` grid + `VGCTeamWarnings` + `AnalysisStrip` (3 signals).
    - Top bar: `ModeSwitch` reflects chat/grid into `?mode=` URL param + `team-store.uiMode`.

3. **GridFrame** — the pre-v2 Grid layout preserved verbatim. Still uses today's `TeamGrid`, analysis tabs, and the side-panel `ChatPanel`.

### The chat timeline

`ChatMessages` merges three sources into a single virtualized timeline, sorted by `createdAt`:

- TanStack AI `UIMessage[]` from `useChat`
- `chat-store.systemLog` — user-edit narrations pushed by `SystemLogBridge`
- `chat-store.responseCards` — structured cards pushed by `ChatPanel` when the coach calls `present_response_card`

System logs and cards are **never** sent back to the server as user input. The coach sees the last 3 system-log entries via the `recentEdits` field on the chat request body, surfaced as a `## Recent Manual Edits` context block in `buildUserMessage`.

### AI-driven vs user-driven writes

All `team-store` write methods (`setPokemon`, `removePokemon`, `swapSlots`, `importTeam`) take an optional `source: "user" | "ai" | "import"`. This drives two behaviors:

- `NewSlotBadge` flashes `NEW · slot N` for 4 s after an `ai`-tagged write.
- `SystemLogBridge` only emits chat entries for `user`-tagged writes.

`ChatPanel`'s tool-application path tags its writes `ai`; `TeamStatePanel` tags manual edits `user`; Showdown imports tag `import`.

## AI streaming flow

### Chat (`/api/ai/claude/stream`)

1. `ChatPanel` calls `streamChatMessage()` via `useChat({ connection })`
2. `createPokemonChatConnection` POSTs to the route with `{ message, team, format, mode, personality, enableThinking, chatHistory, recentEdits }`
3. Route fetches MCP context in parallel (meta threats, popular sets, teammates, RAG strategy)
4. Claude streams with `modify_team` + `present_response_card` tools
5. Client parses tool calls:
   - `modify_team` → `TeamAction` → approval card (`ActionCard`) or bulk-apply for team generation
   - `present_response_card` → `chat-store.appendResponseCard` → inline card via `ResponseDispatcher`
6. Rate limited: 10 requests/minute per IP

### Interview (`/api/ai/interview/stream`)

1. `InterviewShell` collects 4 answers into `interview-store.answers`
2. On the last step, POSTs `{ answers, format, mode }` to the route
3. Route validates required answers, builds the synthesis system prompt, streams with `modify_team` + `interview_synthesis` tools
4. Each `modify_team` tool call → `interview-store.proposed`
5. `interview_synthesis` → `interview-store.synthesisMeta` (rationale, considered, skipped)
6. UI switches to `SynthesisPreview`; Apply commits all 6 via `team-store.setPokemon(slot, …, "ai")`; Discard resets the interview; `Esc` calls `skip()`
7. Rate limited: 6 requests/minute per IP

## Common Tasks

### Adding a new team archetype

1. Add to `apps/teambuilder/src/lib/ai/archetypes.ts`
2. Include: `id`, `name`, `description`, `icon`, `prompt`, `keyFeatures`, `formats`
3. Set `formats` to `"singles"`, `"doubles"`, or `"both"`
4. Add tests in `src/__tests__/archetypes.test.ts`

### Adding or modifying a personality

1. Edit `apps/teambuilder/src/lib/ai/personalities.ts` — all personality data (system prompt, lore, catchphrases) lives here.
2. Coach is the default. Kukui/Oak/Blue are hidden behind the `Advanced` toggle in `PersonalitySelector`.
3. If you rename an existing id, add a `chat-store` persist migration so users keep their selection.

### Modifying Claude's system prompt or user context

- Edit `apps/teambuilder/src/lib/ai/context.ts` (`buildSystemPrompt`, `buildUserMessage`, `getGimmickGuidance`, `formatTeamContext`)
- New runtime context (e.g., more signals for the coach) goes through `buildUserMessage` so it lands in one `## Section` block; extend the request body in `connection.ts` + API route when plumbing new signals.

### Adding a new response-card kind

1. Add the schema to `apps/teambuilder/src/lib/ai/response-types.ts` (discriminated union on `kind`)
2. Mirror the fields into the Anthropic JSON schema on `PRESENT_RESPONSE_CARD_TOOL` in `tools.ts`
3. Document when to use it in the system prompt (`context.ts`)
4. Add a card component under `components/chat/response/` and wire it into `ResponseDispatcher`

### Adding a new interview step

1. Add an entry to `INTERVIEW_STEPS` in `interview-prompts.ts`
2. Extend `InterviewStepId` in `interview-tools.ts` and the answers shape in `interview-store.ts`
3. If the step's answer is required for synthesis, set `skippable: false` so the API route rejects incomplete submissions.

### Modifying the `modify_team` tool schema

- Edit `apps/teambuilder/src/lib/ai/tools.ts` → update `ModifyTeamInput` interface
- Mirror the client-side TanStack tool in `tools-tanstack.ts`
- Update system prompt guidance in `context.ts`
