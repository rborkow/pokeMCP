# Phase 2: Team Builder & Rater - Implementation Plan

## Overview

Build an interactive web application where users can:
- Paste/build Pokémon teams
- Get AI-powered feedback and suggestions
- Analyze type coverage, threats, and team synergy
- Save/share teams
- Compare teams side-by-side

## Tech Stack

### Frontend Framework
**Next.js 15** (App Router)
- Rich interactivity for team builder UI
- Server-side rendering for performance
- API routes for MCP integration
- Excellent TypeScript support

### Deployment
**Cloudflare Pages** (via OpenNext adapter)
- Same platform as MCP Worker
- Free tier sufficient
- Global CDN
- Easy integration with existing infrastructure

### UI Components
**shadcn/ui** (Radix UI + Tailwind CSS)
- Accessible components
- Copy-paste, you own the code
- Modern, polished design
- Dark mode support built-in

**Key Components:**
- Card - Pokemon cards, analysis panels
- Tabs - Switch between views
- Badge - Type indicators, usage %
- Textarea - Team paste input
- Select - Format picker
- Dialog - Pokemon editor
- Tooltip - Move/ability details
- Accordion - Expandable details

### State Management
**Zustand** or React Context
- Lightweight
- Simple API
- TypeScript-first

### Forms & Validation
**React Hook Form + Zod**
- Type-safe validation
- Great DX
- Integrates with shadcn/ui

### Pokemon Sprites
**PokéAPI CDN**
```
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png
https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/{name}.gif
```

### AI Integration
**Dual approach:**
1. **Cloudflare AI Workers** (default, free)
   - @cf/meta/llama-3.1-8b-instruct
   - On-edge inference
   - Cost-effective for MVP

2. **Claude API** (premium toggle)
   - claude-3-5-sonnet-20241022
   - Highest quality analysis
   - ~$0.02 per team
   - Best user experience

## Architecture

### Data Flow

```
User Input (Showdown paste or builder)
    ↓
Frontend parses to JSON
    ↓
Display team cards with sprites
    ↓
Call MCP tools in sequence:
    1. validate_team
    2. suggest_team_coverage
    3. get_popular_sets (for each Pokemon)
    4. get_checks_counters (for each Pokemon)
    5. get_meta_threats
    ↓
Aggregate results
    ↓
AI synthesis layer (CF AI or Claude)
    ↓
Display analysis + suggestions
```

### MCP Integration Options

**Option A: Direct calls from API routes** (Recommended)
```typescript
// app/api/mcp/route.ts
export async function POST(request: Request) {
  const { tool, args } = await request.json();

  const response = await fetch('https://pokemon-mcp-cloudflare.rborkows.workers.dev/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: tool, arguments: args },
      id: 1
    })
  });

  return response;
}
```

**Option B: New Worker endpoint for batch analysis**
```typescript
// Add to src/index.ts
if (url.pathname === '/analyze-team') {
  const { team, format } = await request.json();

  // Call multiple tools internally
  const validation = validateTeam({ team, format });
  const coverage = suggestTeamCoverage({ current_team, format });
  const popularSets = await Promise.all(...);

  return new Response(JSON.stringify({ validation, coverage, popularSets }));
}
```

## Project Structure

```
apps/teambuilder/
├── app/
│   ├── page.tsx                 # Home (team builder UI)
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/
│   │   ├── mcp/route.ts         # MCP proxy
│   │   └── analyze/route.ts     # AI analysis endpoint
│   └── teams/
│       └── [id]/page.tsx        # Shared team view
├── components/
│   ├── ui/                      # shadcn/ui components
│   ├── TeamInput.tsx            # Paste or build UI
│   ├── PokemonCard.tsx          # Individual Pokemon card
│   ├── TypeCoverageMatrix.tsx   # Visual type grid
│   ├── AnalysisPanel.tsx        # AI feedback display
│   ├── FormatSelector.tsx       # Format dropdown
│   ├── TeamHistory.tsx          # LocalStorage history
│   └── TeamComparison.tsx       # Side-by-side compare
├── lib/
│   ├── mcp-client.ts            # MCP tool caller
│   ├── parser.ts                # Showdown format parser
│   ├── ai.ts                    # AI integration (CF + Claude)
│   ├── storage.ts               # KV for shared teams
│   └── utils.ts
├── types/
│   └── pokemon.ts               # TypeScript types
└── package.json
```

## UI/UX Design

### Team Input Section
```
┌────────────────────────────────────────────┐
│  [Paste Team] [Build from Scratch]         │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │ Paste your Showdown team here...  │    │
│  │                                    │    │
│  │ Garchomp @ Life Orb               │    │
│  │ Ability: Rough Skin               │    │
│  └────────────────────────────────────┘    │
│                                             │
│  Format: [Gen 9 OU ▼]  [Analyze Team →]   │
└────────────────────────────────────────────┘
```

### Team Display
```
Your Team (6/6)                      [Export ▼] [Share] [History]
┌──────┬──────┬──────┬──────┬──────┬──────┐
│ [🦖] │ [🌳] │ [⚡] │ [🔥] │ [💧] │ [🗿] │
│Garcmp│Ferro │Rotom │Volc │Peli  │Lando  │
│  ✓   │  ✓   │  ✓   │  ⚠  │  ✓   │  ✓   │
└──────┴──────┴──────┴──────┴──────┴──────┘
```

### Analysis Panel
```
┌─────────────────────────────────────────┐
│  Team Analysis                 [🌙 Dark] │
├─────────────────────────────────────────┤
│  ✓ VALIDATION PASSED                    │
│                                          │
│  Type Coverage                           │
│  Strong vs: 🔥 🌿 ⚡ 💧 (12 types)      │
│  Weak to: ❄️ 🧚 (2 types)               │
│                                          │
│  Meta Threats (Gen 9 OU)                 │
│  ⚠ Kingambit (48%) - threatens 3        │
│  ⚠ Great Tusk (51%) - threatens 2       │
│                                          │
│  AI Suggestions  [CF AI ▼]              │
│  💡 Ice weakness is critical...          │
│  💡 Consider Heatran over Landorus...    │
└─────────────────────────────────────────┘
```

## Features Breakdown

### Core Features (MVP)
1. ✅ Team paste input (Showdown format)
2. ✅ Parse and display team
3. ✅ Format selector
4. ✅ MCP tool integration (validation, coverage, stats)
5. ✅ Basic analysis display
6. ✅ Export to Showdown format

### Premium Features (Phase 2.1)
1. ✅ **Share/Save Teams** - Generate shareable URLs, store in KV
2. ✅ **Team History** - LocalStorage-based history
3. ✅ **Dark Mode** - Theme toggle
4. ✅ **Compare Teams** - Side-by-side view

### AI Features
1. ✅ Cloudflare AI integration (default)
2. ✅ Claude API toggle (premium)
3. ✅ Smart suggestions based on meta
4. ✅ Streaming responses

### Advanced Features (Future)
- Team builder from scratch (drag-drop)
- Move/ability suggestions
- EV spread calculator
- Damage calculator integration
- Export to Pokemon Showdown (direct import)

## Implementation Phases

### Week 1: Foundation
- [ ] Next.js 15 project setup
- [ ] Install shadcn/ui
- [ ] Create Showdown paste parser
- [ ] Basic team input UI
- [ ] Format selector

### Week 2: Core Features
- [ ] Pokemon card components with sprites
- [ ] MCP client integration
- [ ] validate_team, get_popular_sets calls
- [ ] Type coverage visualization
- [ ] Export functionality

### Week 3: AI Integration
- [ ] Cloudflare AI Workers setup
- [ ] Claude API integration with toggle
- [ ] Suggestion rendering UI
- [ ] Loading states and error handling

### Week 4: Premium Features
- [ ] Share/save teams (KV storage)
- [ ] Team history (localStorage)
- [ ] Dark mode
- [ ] Team comparison
- [ ] Mobile responsive design

### Week 5: Polish & Deploy
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Deploy to Cloudflare Pages
- [ ] User testing
- [ ] Documentation

## Data Models

### Team Schema
```typescript
interface Team {
  id: string;
  name?: string;
  format: string;
  pokemon: TeamPokemon[];
  createdAt: Date;
}

interface TeamPokemon {
  species: string;
  nickname?: string;
  item?: string;
  ability: string;
  moves: string[];
  nature?: string;
  evs?: Stats;
  ivs?: Stats;
  level?: number;
  shiny?: boolean;
}

interface Stats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}
```

### Analysis Result Schema
```typescript
interface AnalysisResult {
  validation: {
    valid: boolean;
    errors: string[];
  };
  coverage: {
    strong: Type[];
    weak: Type[];
    resistances: Type[];
  };
  threats: {
    pokemon: string;
    usage: number;
    threatenedPokemon: string[];
  }[];
  suggestions: {
    type: 'warning' | 'info' | 'success';
    message: string;
  }[];
  aiAnalysis?: string; // From CF AI or Claude
}
```

## Showdown Paste Format

### Input Format
```
Garchomp @ Life Orb
Ability: Rough Skin
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
- Earthquake
- Dragon Claw
- Swords Dance
- Fire Fang
```

### Parser Logic
```typescript
function parseShowdownTeam(paste: string): TeamPokemon[] {
  const blocks = paste.split('\n\n');
  return blocks.map(block => {
    const lines = block.split('\n');
    // Parse name/item from first line
    // Parse ability, EVs, nature, moves
    return teamPokemon;
  });
}
```

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_MCP_URL=https://pokemon-mcp-cloudflare.rborkows.workers.dev
ANTHROPIC_API_KEY=sk-...  # For Claude API (optional)
KV_NAMESPACE_ID=...  # For shared teams (from wrangler)
```

## Cost Estimates

### Development
- Free (Cloudflare Pages free tier)

### Production (Monthly)
- **Cloudflare Pages**: $0 (free tier, 500 builds)
- **Cloudflare KV** (shared teams): $0-5 (1GB free)
- **Cloudflare AI**: $0 (10k Neurons/day free)
- **Claude API** (if used): $5-20 (pay per use)

**Total: $0-25/month**

## Success Metrics

### MVP Success
- [ ] Users can paste and validate teams
- [ ] AI provides useful suggestions
- [ ] <3s analysis time
- [ ] Mobile responsive
- [ ] 90+ Lighthouse score

### Premium Success
- [ ] 100+ shared teams
- [ ] 500+ team analyses
- [ ] <1% error rate
- [ ] Positive user feedback

## Next Steps

After reviewing this plan:
1. Approve tech stack
2. Set up Next.js project
3. Begin Week 1 implementation
4. Iterate based on user feedback

---

**Ready to start Phase 2?** This plan provides a complete roadmap for building the team builder/rater application.
