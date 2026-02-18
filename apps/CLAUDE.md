# Apps Directory

This directory contains two independently managed applications. There is **no workspace tooling** (no Turbo, Nx, or npm workspaces) — each app has its own `package.json` and `node_modules`.

## Version Divergence

| App | Framework | React | Tailwind | Deploy Target |
|-----|-----------|-------|----------|---------------|
| `teambuilder/` | Next.js 16 (App Router) | 19 | 4 | Cloudflare Pages (OpenNext) |
| `docs/` | Next.js 14 (Pages Router) | 18 | 3 | Cloudflare Pages (static export) |

Do **not** align framework versions across apps — they are intentionally pinned differently.

## Dependency Management

- Run `npm install` inside each app directory independently
- Root `biome.json` formatting/linting rules apply to both apps
- Teambuilder additionally uses `eslint-config-next` (ESLint flat config in `eslint.config.mjs`)

## Coupling

Apps are loosely coupled. The teambuilder calls the MCP server at `api.pokemcp.com` via REST (`/api/tools`) and SSE (`/ai/chat`). There is no shared code between apps or between apps and the root `src/`.

## Running Locally

```bash
# From repo root:
npm run dev:teambuilder   # port 3000
npm run dev:docs          # port 3001
```

## Docs App Notes

- Uses Nextra 3 with `nextra-theme-docs`
- Static export (`output: "export"`) — no server runtime
- Pages live in `docs/pages/` as `.mdx` files with `_meta.ts` for nav ordering
- Theme configured in `theme.config.tsx`
