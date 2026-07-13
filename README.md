# PokeMCP Prep

[![Build](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml/badge.svg)](https://github.com/rborkow/pokeMCP/actions/workflows/build.yml)

PokeMCP Prep turns current Pokémon Champions tournament teams into matchup plans players can practice. The web product combines a sourced tournament newsroom, team-sheet comparison, structured battle cards, and a plan-specific coach.

**Product:** [www.pokemcp.com](https://www.pokemcp.com) · **Documentation:** [docs.pokemcp.com](https://docs.pokemcp.com)

## Product shape

- Champions Regulation M-B is the default and primary format.
- Completed public Limitless events supply team sheets and results.
- A battle card includes Bring 4, two leads, likely opposing leads, opening lines, dangers, evidence, and practice work.
- Anonymous teams and plans live locally; optional Discord or Google accounts sync through Better Auth and D1.
- Exact VP-sensitive speed calculations and incomplete Champions move interactions are labeled as mechanics beta.
- AI team generation remains available as a secondary **Build a team** workflow.

The former public MCP and REST tool endpoints are retired and return `410 Gone`. Their capabilities remain available to the web product through a private Cloudflare service binding.

## Repository

- `apps/teambuilder/` — Next.js 16 / OpenNext web application.
- `apps/docs/` — Nextra documentation.
- `src/` — internal Cloudflare analysis worker, tournament ingestion, shared-team compatibility, and administration.
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

Operational analytics measure the preparation funnel. Arbitrary prompts and responses are not retained for model training by default. Signed-in users may delete synced teams, plans, coach history, sessions, and provider links from the account page.

## License

[GNU Affero General Public License v3.0](LICENSE)
