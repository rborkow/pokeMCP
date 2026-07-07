# Contributing to PokeMCP

Thank you for your interest in contributing to PokeMCP! This guide will help you get started.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- A Cloudflare account (free tier works fine for development)

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/rborkow/pokeMCP.git
   cd pokeMCP
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Start local development server**

   ```bash
   bun run dev
   ```

   This runs the MCP server locally at `http://localhost:8787`. Wrangler automatically simulates KV storage locally, so you don't need any cloud resources.

4. **Test the server**
   ```bash
   # In another terminal
   curl http://localhost:8787/
   ```

### Local Development Notes

- **KV Storage**: When running `bun run dev`, Wrangler uses local simulation for KV. No cloud resources are accessed.
- **No API Keys Needed**: Local development doesn't require Cloudflare API tokens.
- **Stats Data**: `src/cached-stats/` is a gitignored working directory — fresh clones don't include it. Run `bun run fetch-stats` to populate it with current Smogon statistics if you need them locally (production reads stats from KV, not from these files).

## Project Structure

```
pokeMCP/
├── src/                    # MCP Server (Cloudflare Worker)
│   ├── index.ts           # Main entry point
│   ├── tools.ts           # Pokemon lookup, validation tools
│   ├── stats.ts           # Usage statistics tools
│   ├── data/              # Bundled Pokemon Showdown data
│   └── cached-stats/      # Smogon stats working dir (gitignored; bun run fetch-stats)
├── apps/
│   ├── teambuilder/       # Next.js Team Builder UI
│   └── docs/              # Documentation site
└── scripts/               # Utility scripts
```

## Making Changes

### Branch Strategy

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit with clear messages

3. Push and create a Pull Request

### Code Style

- Run linting before committing:

  ```bash
  bun run lint:fix
  bun run format
  ```

- Follow existing code patterns in the repository

### Testing Your Changes

1. **MCP Server changes**:

   ```bash
   bun run dev
   # Test your changes at http://localhost:8787
   ```

2. **Teambuilder changes**:

   ```bash
   cd apps/teambuilder
   bun install
   bun run dev
   # Test at http://localhost:3000
   ```

3. **Documentation changes**:
   ```bash
   cd apps/docs
   bun install
   bun run dev
   ```

## Pull Request Process

1. Ensure your code builds without errors
2. Update documentation if you've changed APIs or added features
3. Create a PR with a clear description of your changes
4. Wait for CI checks to pass
5. A maintainer will review your PR

### What Happens After Merge

When your PR is merged to `main`, Cloudflare picks it up automatically:

- **MCP Worker** → https://api.pokemcp.com (Cloudflare Workers Builds)
- **Teambuilder** → https://www.pokemcp.com (Cloudflare Workers Builds)
- **Documentation** → https://docs.pokemcp.com (Cloudflare Pages Git integration)

## Environment Overview

| Environment | Purpose               | How to Access                 |
| ----------- | --------------------- | ----------------------------- |
| Local Dev   | Development & testing | `bun run dev`                 |
| Production  | Live services         | Auto-deploys on merge to main |

### Production Deployment (Maintainers Only)

All production deploys are owned by Cloudflare. The GitHub Actions in this repo only run PR
build verification (`build.yml`) and the monthly Smogon stats refresh (`update-stats.yml`).

- **MCP Worker**: Cloudflare Workers Builds project `pokemon-mcp-production` redeploys on every push to `main`
- **Teambuilder**: Cloudflare Workers Builds project `pokemcp-teambuilder` redeploys on every push to `main`
- **Documentation**: Cloudflare Pages Git integration deploys `apps/docs/` changes from `main`
- **Stats updates**: Run monthly via "Update Smogon Stats" workflow — the stats commit it pushes to `main` triggers the Workers Builds redeploy

## Common Tasks

### Adding a New MCP Tool

1. Implement the function in `src/tools.ts` or `src/stats.ts`
2. Register it in `src/index.ts` with a Zod schema
3. Test locally with `bun run dev`

### Adding a New Pokemon Format

1. Add the format to `apps/teambuilder/src/types/pokemon.ts`
2. Add stats for the format to `scripts/fetch-stats.ts`
3. Update documentation in `README.md`

### Updating Usage Statistics (Maintainers)

Stats are updated monthly via GitHub Actions, but can be run manually:

```bash
bun run fetch-stats    # Download from Smogon
bun run upload-stats   # Upload to KV (requires Cloudflare auth)
```

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating a new one
- For questions, start a discussion in the repository

## Code of Conduct

Be respectful and constructive. We're all here because we love Pokemon!
