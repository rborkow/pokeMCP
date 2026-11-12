# VGC Teambuilder documentation

Static Nextra documentation for the VGC Teambuilder connector, served at `docs.pokemcp.com`.

```bash
bun install
bun run dev
bun run build
```

Production docs are exported to `out/` and served from the Cloudflare Pages project for `docs.pokemcp.com`. The tool table on the Tools page is generated from `src/connector/tools.ts`: run `bun run generate-tool-docs` from the repo root after changing a tool. Do not name a specific regulation as "current" in prose — regulations rotate every few months.

Licensed under AGPL-3.0.
