# VGC Teambuilder

[![Build](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml/badge.svg)](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml)

VGC Teambuilder is a read-only [Model Context Protocol](https://modelcontextprotocol.io) connector for competitive Pokémon doubles. Add it to Claude, ChatGPT or any MCP client and the assistant can look up Pokémon Champions usage statistics, check a team's legality, analyse its typing and follow how the metagame moves.

```
https://api.pokemcp.com/mcp
```

It needs no account and takes no personal information. Add it as a custom connector by address.

**Connect:** [docs.pokemcp.com/getting-started](https://docs.pokemcp.com/getting-started) · **Tool reference:** [docs.pokemcp.com/tools](https://docs.pokemcp.com/tools) · **Results and reports:** [www.pokemcp.com](https://www.pokemcp.com)

## Tools

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
| `calculate_damage` | Calculate damage for one move |
| `compare_speed` | Compare Speed and turn order |
| `check_team_threats` | Check a team against the most-used Pokémon |
<!-- AUTOGEN:TOOLS:END -->

The tools live in `src/connector/`; run `bun run generate-tool-docs` after changing them. They cover Pokémon Champions regulations only. The legacy `/sse` and `/api/tools` endpoints stay retired and return `410 Gone`.

## The website

[www.pokemcp.com](https://www.pokemcp.com) is the connector's content and reference site, not an application:

- tournament results from completed public Limitless events;
- monthly meta reports and per-Pokémon trend pages, generated from Smogon's usage statistics;
- the privacy policy.

It has no accounts and calls no AI provider. The matchup planner, team builder and coach it once offered (PokeMCP Prep) were retired in November 2026; their old addresses lead to a notice page.

## Repository

- `src/` — the Cloudflare Worker at `api.pokemcp.com`: the connector (`src/connector/`), regulation and usage data, tournament ingestion, legacy shared-team reads, and administration.
- `apps/teambuilder/` — the website (Next.js 16 on Cloudflare Workers through OpenNext). The directory name is historical.
- `apps/docs/` — the documentation site (Nextra).
- `scripts/` — stats refresh, regulation legality ingestion and report generation.
- `migrations/d1/` — usage-history and tournament D1 schema.

## Development

The repository pins Bun 1.3+.

```bash
bun install
bun run dev                # the worker, at http://localhost:8787/mcp
bun run dev:teambuilder    # the website, at http://localhost:3000
bun run dev:docs           # the docs site, at http://localhost:3001
```

Checks:

```bash
bun run ci:worker                        # type check, tests, migrations, dry-run build
cd apps/teambuilder && bun run ci        # lint, tests, production bundle, type checks
```

Local worker storage starts empty, so usage and trend tools answer "unavailable" until it is seeded. See `CLAUDE.md` for the data pipelines, the checklist for adding a regulation, and how production data is refreshed.

## Data sources

- Pokémon, move and ability data: Pokémon Showdown.
- Usage statistics: Pokémon Showdown ladder data published monthly by Smogon.
- Allowed Pokémon: each regulation's published eligible list.
- Tournament results: Limitless.

## Privacy

The connector stores no tool inputs or results; it records only which tool was called, the format, whether it succeeded and how long it took. Full policy: [www.pokemcp.com/privacy](https://www.pokemcp.com/privacy).

## License and affiliation

[GNU Affero General Public License v3.0](LICENSE)

VGC Teambuilder is an unofficial fan project. It is not affiliated with or endorsed by Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company.
