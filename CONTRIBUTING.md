# Contributing to PokeMCP

Thank you for your interest in contributing to PokeMCP! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm
- A Cloudflare account (free tier works fine for development)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/rborkow/pokeMCP.git
   cd pokeMCP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start local development server**
   ```bash
   npm run dev
   ```

   This runs the MCP server locally at `http://localhost:8787`. Wrangler automatically simulates KV storage locally, so you don't need any cloud resources.

4. **Test the server**
   ```bash
   # In another terminal
   curl http://localhost:8787/
   ```

### Local Development Notes

- **KV Storage**: When running `npm run dev`, Wrangler uses local simulation for KV. No cloud resources are accessed.
- **No API Keys Needed**: Local development doesn't require Cloudflare API tokens.
- **Stats Data**: The `src/cached-stats/` directory contains cached Smogon statistics that are used for local testing.

## Project Structure

```
pokeMCP/
├── src/                    # MCP Server (Cloudflare Worker)
│   ├── index.ts           # Main entry point
│   ├── tools.ts           # Pokemon lookup, validation tools
│   ├── stats.ts           # Usage statistics tools
│   ├── data/              # Bundled Pokemon Showdown data
│   └── cached-stats/      # Cached Smogon usage statistics
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
  npm run lint:fix
  npm run format
  ```

- Follow existing code patterns in the repository

### Testing Your Changes

1. **MCP Server changes**:
   ```bash
   npm run dev
   # Test your changes at http://localhost:8787
   ```

2. **Teambuilder changes**:
   ```bash
   cd apps/teambuilder
   npm install
   npm run dev
   # Test at http://localhost:3000
   ```

3. **Documentation changes**:
   ```bash
   cd apps/docs
   npm install
   npm run dev
   ```

## Pull Request Process

1. Ensure your code builds without errors
2. Update documentation if you've changed APIs or added features
3. Create a PR with a clear description of your changes
4. Wait for CI checks to pass
5. A maintainer will review your PR

### What Happens After Merge

When your PR is merged to `main`:
- The **MCP Worker** automatically deploys to https://api.pokemcp.com
- The **Teambuilder** automatically deploys to https://www.pokemcp.com
- The **Documentation** automatically deploys to https://docs.pokemcp.com

## Environment Overview

| Environment | Purpose | How to Access |
|-------------|---------|---------------|
| Local Dev | Development & testing | `npm run dev` |
| Production | Live services | Auto-deploys on merge to main |

### Production Deployment (Maintainers Only)

Production deployment is handled automatically by GitHub Actions:
- **Auto-deploy**: Merging to `main` triggers deployment
- **Manual deploy**: Use the "Deploy to Production" workflow in GitHub Actions
- **Stats updates**: Run monthly via "Update Smogon Stats" workflow

## Common Tasks

### Adding a New MCP Tool

1. Implement the function in `src/tools.ts` or `src/stats.ts`
2. Register it in `src/index.ts` with a Zod schema
3. Test locally with `npm run dev`

### Adding a New Pokemon Format

1. Add the format to `apps/teambuilder/src/types/pokemon.ts`
2. Add stats for the format to `scripts/fetch-stats.ts`
3. Update documentation in `README.md`

### Updating Usage Statistics (Maintainers)

Stats are updated monthly via GitHub Actions, but can be run manually:

```bash
npm run fetch-stats    # Download from Smogon
npm run upload-stats   # Upload to KV (requires Cloudflare auth)
```

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating a new one
- For questions, start a discussion in the repository

## Code of Conduct

Be respectful and constructive. We're all here because we love Pokemon!
