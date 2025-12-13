# Monorepo Streamlining Proposal

## Current State

The PokeMCP project consists of 3 applications:

| App | Location | Framework | Deployment | Purpose |
|-----|----------|-----------|------------|---------|
| MCP Server | `/` (root) | Cloudflare Workers | `api.pokemcp.com` | MCP protocol + REST API |
| Docs | `/apps/docs` | Next.js + Nextra | `docs.pokemcp.com` | Documentation site |
| Team Builder | `/apps/teambuilder` | Next.js 16 | `www.pokemcp.com` | Interactive web app |

### Current Issues

1. **No workspace management**: Each app has its own `node_modules` and `package-lock.json`
2. **Scattered configuration**: Deployment docs in multiple places
3. **Inconsistent tooling**: Biome (root), ESLint (teambuilder), none (docs)
4. **Manual deployments**: No unified deploy command
5. **Staging incomplete**: KV namespaces have placeholder IDs

---

## Proposed Improvements

### Phase 1: Unified Deployment (Quick Wins)

Add root-level deployment scripts in `package.json`:

```json
{
  "scripts": {
    "deploy:all": "npm run deploy:mcp && npm run deploy:teambuilder && npm run deploy:docs",
    "deploy:mcp": "wrangler deploy --env production",
    "deploy:teambuilder": "cd apps/teambuilder && npm run deploy",
    "deploy:docs": "cd apps/docs && npm run build",
    "dev:teambuilder": "cd apps/teambuilder && npm run dev",
    "dev:docs": "cd apps/docs && npm run dev"
  }
}
```

### Phase 2: GitHub Actions Improvements

Update `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy All
on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  deploy-mcp:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy --env production

  deploy-teambuilder:
    runs-on: ubuntu-latest
    needs: deploy-mcp  # Wait for MCP server
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
        working-directory: apps/teambuilder
      - run: npm run deploy
        working-directory: apps/teambuilder

  deploy-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
        working-directory: apps/docs
      - run: npm run build
        working-directory: apps/docs
      # Cloudflare Pages handles deployment via GitHub integration
```

### Phase 3: npm Workspaces (Optional)

Convert to npm workspaces for shared dependencies:

```json
// root package.json
{
  "workspaces": [
    "apps/*"
  ]
}
```

Benefits:
- Single `npm install` at root
- Shared dependencies deduplicated
- Can share TypeScript types between apps

### Phase 4: Shared Types Package (Future)

Create a shared types package:

```
packages/
  types/
    src/
      pokemon.ts    # Shared Pokemon types
      team.ts       # TeamPokemon interface
      formats.ts    # Format definitions
    package.json
```

Apps would import: `import { TeamPokemon } from '@pokemcp/types'`

---

## Recommended Directory Structure

```
pokemcp/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Unified deployment workflow
├── apps/
│   ├── docs/                   # Documentation site
│   └── teambuilder/            # Web app
├── packages/                   # (Future) Shared packages
│   └── types/
├── src/                        # MCP server source
├── package.json                # Root with workspaces + deploy scripts
├── wrangler.jsonc              # MCP server config
├── biome.json                  # Shared lint config
├── README.md                   # Main project docs
└── CLAUDE.md                   # AI assistant instructions
```

---

## URL Strategy

| Domain | App | Status |
|--------|-----|--------|
| `api.pokemcp.com` | MCP Server | Active |
| `www.pokemcp.com` | Team Builder | Active |
| `docs.pokemcp.com` | Documentation | Needs setup |
| `pokemcp.com` | Redirect → www | Needs setup |

---

## Immediate Actions

1. **Add root deploy scripts** - 5 min
2. **Update GitHub workflow** - 15 min
3. **Set up docs.pokemcp.com domain** - Manual in Cloudflare
4. **Complete staging KV setup** - Manual in Cloudflare

## Future Considerations

- Consider Turborepo for build caching if build times become an issue
- Consider shared ESLint/Biome config once tooling is unified
- Consider shared UI components if more apps are added
