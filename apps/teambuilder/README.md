# PokeMCP Prep web application

The Champions-first preparation workspace at [www.pokemcp.com](https://www.pokemcp.com).

Primary routes:

- `/` — sourced tournament newsroom
- `/events/[slug]` — event results and published teams
- `/prep/new` — own-team and opponent setup
- `/prep/[id]` — Match Desk and plan-scoped coach
- `/teams` — anonymous or synced team library
- `/build` — secondary team builder
- `/account` — sign-in, sync, export, privacy, and deletion

Anonymous teams and plans are saved in IndexedDB. Signed-in workspaces use `PREP_DB`; tournament snapshots use `META_DB`. Analysis reaches the private Worker entrypoint through a Cloudflare service binding. The browser has no public MCP or provider-key access.

## Development

```bash
bun install
bun run dev
bun run lint
bunx tsc --noEmit
bun run test:run
bun run build
```

Copy `.env.example` to `.env.local` for local AI and Better Auth configuration. Production also requires the bindings in `wrangler.toml` and version-controlled D1 migrations in `migrations/prep/`.

## License

AGPL-3.0. See the repository root for details.
