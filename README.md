# PokeMCP Prep

[![Build](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml/badge.svg)](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml)

PokeMCP Prep turns current Pokémon Champions tournament teams into matchup plans players can practice. The web product combines a sourced tournament newsroom, team-sheet comparison, and structured, rule-based battle cards. It calls no AI provider.

**Product:** [www.pokemcp.com](https://www.pokemcp.com) · **Documentation:** [docs.pokemcp.com](https://docs.pokemcp.com)

## Product shape

- Champions Regulation M-B is the default and primary format.
- Completed public Limitless events supply team sheets and results.
- A battle card includes Bring 4, two leads, likely opposing leads, opening lines, dangers, evidence, and practice work.
- Anonymous teams and plans live locally; optional Discord or Google accounts sync through Better Auth and D1.
- Exact VP-sensitive speed calculations and incomplete Champions move interactions are labeled as mechanics beta.

## VGC Teambuilder connector

The same analysis is available to AI assistants as **VGC Teambuilder**, a read-only [Model Context Protocol](https://modelcontextprotocol.io) server:

```
https://api.pokemcp.com/mcp
```

It needs no account and takes no personal information. Connect it as a custom connector in Claude or ChatGPT, or from any MCP client that speaks Streamable HTTP. Full reference: [docs.pokemcp.com/tools](https://docs.pokemcp.com/tools).

<!-- AUTOGEN:TOOLS:BEGIN -->
| Tool | What it does |
|------|--------------|
| `list_formats` | List supported formats |
| `lookup_pokemon` | Look up a Pokémon |
| `validate_moveset` | Check which moves a Pokémon can learn |
| `validate_team` | Validate a team for a regulation |
| `analyze_team_types` | Analyze a team's defensive typing |
| `get_top_usage` | Get the most-used Pokémon |
| `get_pokemon_usage` | Get how a Pokémon is built |
| `get_teammates` | Get a Pokémon's common teammates |
| `get_checks_and_counters` | Get a Pokémon's checks and counters |
| `get_usage_trend` | Get a Pokémon's usage over time |
| `get_meta_shifts` | Compare usage between two months |
| `get_usage_momentum` | Find rising and falling Pokémon |
<!-- AUTOGEN:TOOLS:END -->

The tools live in `src/connector/`; run `bun run generate-tool-docs` after changing them. The legacy `/sse` and `/api/tools` endpoints stay retired and return `410 Gone`. The web product reaches its own, separate tool set through a private Cloudflare service binding.

VGC Teambuilder is an unofficial fan project. It is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company.

## Repository

- `apps/teambuilder/` — Next.js 16 / OpenNext web application.
- `apps/docs/` — Nextra documentation.
- `apps/pokemonitor/` — daily Cloudflare Worker reporting, AI-usage monitoring, and email delivery.
- `src/` — Cloudflare analysis worker: the public VGC Teambuilder connector (`src/connector/`), the internal analysis service, tournament ingestion, shared-team compatibility, and administration.
- `migrations/d1/` — metagame and tournament D1 schema.
- `apps/teambuilder/migrations/prep/` — account, team, plan, and coach-history schema.

## Development

The repository pins Bun 1.3+.

```bash
bun install
bun run dev:teambuilder
```

The teambuilder runs at `http://localhost:3000`. Anonymous preparation works without Cloudflare bindings or OAuth credentials.

Useful checks:

```bash
cd apps/teambuilder
bun run test:run
bun run build

cd ../..
bun run type-check
bun run lint
```

### Optional account sync

Configure these secrets on the `pokemcp-teambuilder` Worker:

- `BETTER_AUTH_SECRET`
- `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

Apply product migrations with:

```bash
cd apps/teambuilder
bunx wrangler d1 migrations apply PREP_DB --remote --config wrangler.toml
```

OAuth callbacks use:

- `https://www.pokemcp.com/api/auth/callback/discord`
- `https://www.pokemcp.com/api/auth/callback/google`

Before a production migration or cutover, follow the [Cloudflare relaunch runbook](docs/RELAUNCH_RUNBOOK.md). The repository includes repeatable commands for validated D1 exports and a read-only account/binding preflight:

```bash
bun run cloudflare:backup pokemcp-meta-history pokemcp-prep
bun run cloudflare:preflight
```

### Tournament data

The internal Worker refreshes completed public Regulation M-B events daily at 06:00 UTC and stores normalized event/team records in `META_DB`. Generated JSON in the repository remains a build-time and local-development fallback.

## Privacy

Operational analytics measure the preparation funnel. The site sends nothing to an AI provider. Signed-in users may delete synced teams, plans, saved coach conversations, sessions, and provider links from the account page. Full policy: [www.pokemcp.com/privacy](https://www.pokemcp.com/privacy).

## License

[GNU Affero General Public License v3.0](LICENSE)
