# Deployment Guide

## Quick Start

### Local Development
```bash
npm run dev
# Server runs at http://localhost:8787
```

### Deploy to Current Environment (Development)
```bash
npm run deploy
```

---

## Environment Setup

### 1. Create Staging Environment

```bash
# Run the automated setup script
chmod +x scripts/setup-staging.sh
npm run setup:staging
```

This creates:
- 2 KV namespaces for staging
- Vectorize index for staging
- Metadata indexes for pokemon, format, section_type

After running, update `wrangler.jsonc` with the KV namespace IDs.

### 2. GitHub Secrets Configuration

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
CLOUDFLARE_API_TOKEN=<your-token>
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

**To get your API token:**
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create Token → Use "Edit Cloudflare Workers" template
3. Add permissions: Account.Workers Scripts (Edit), Account.Workers KV Storage (Edit)

**To get your account ID:**
```bash
npx wrangler whoami
```

### 3. GitHub Environments

Create these environments in GitHub (Settings → Environments):

**Staging:**
- No protection rules
- Auto-deploys on push to `main`

**Production:**
- Required reviewers: Add yourself
- Manual approval required
- Deploy via workflow dispatch

---

## Deployment Workflows

### Deploy to Staging
Automatically deploys when you push to `main`:
```bash
git push origin main
```

Or manually:
```bash
npm run deploy:staging
```

### Deploy to Production
Use GitHub Actions workflow dispatch:
1. Go to Actions → Deploy to Production
2. Click "Run workflow"
3. Enter version tag (e.g., `v0.3.0`)
4. Approve deployment

Or via CLI (after approval setup):
```bash
npm run deploy:production
```

---

## Initial Data Seeding

After deploying a new environment, seed it with data:

### Staging
```bash
curl https://pokemon-mcp-staging.rborkows.workers.dev/test-ingestion
```

### Production
```bash
# Use the full ingestion (will run on cron automatically)
# Or trigger manually via Cloudflare dashboard → Workers → Triggers → Cron
```

---

## Monitoring Deployments

### View Logs in Real-Time
```bash
# Development
npm run tail

# Staging
npm run tail:staging

# Production
npm run tail:production
```

### Check Deployment Status
```bash
# List recent deployments
npx wrangler deployments list

# View specific deployment
npx wrangler deployments view <deployment-id>

# Rollback if needed
npx wrangler rollback <version-id>
```

---

## Health Checks

After deployment, verify services are working:

### 1. Check Server Info
```bash
curl https://your-worker.workers.dev/
```

Should return server version and available tools.

### 2. Test RAG Query
```bash
curl -G "https://your-worker.workers.dev/test-rag" \
  --data-urlencode "q=How to counter Garchomp?"
```

Should return strategic content results.

### 3. Check Vectorize
```bash
npx wrangler vectorize list
npx wrangler vectorize info pokemon-strategy-index
```

Should show 27+ vectors indexed.

---

## Rollback Procedure

If a deployment causes issues:

### Via Cloudflare Dashboard
1. Go to Workers → pokemon-mcp-production
2. Click "Deployments"
3. Find last working version
4. Click "Rollback to this deployment"

### Via CLI
```bash
# List deployments
npx wrangler deployments list --env production

# Rollback to specific version
npx wrangler rollback <version-id> --env production
```

---

## Troubleshooting

### Deployment Fails with "KV namespace not found"
- Check KV namespace IDs in `wrangler.jsonc`
- Verify namespaces exist: `npx wrangler kv namespace list`

### "Vectorize index not found"
- Create the index: `npx wrangler vectorize create <index-name>`
- Create metadata indexes (see setup script)

### GitHub Actions fails with "Invalid API token"
- Verify `CLOUDFLARE_API_TOKEN` secret is set
- Check token has required permissions
- Token may have expired - regenerate

### Ingestion cron not running
- Check cron trigger in Cloudflare dashboard
- Verify cron schedule in `wrangler.jsonc`
- Test manually via `/test-ingestion` endpoint

---

## Cost Monitoring

Keep an eye on these metrics in Cloudflare Dashboard:

**Workers:**
- Requests per day
- CPU time
- Errors

**KV:**
- Read operations
- Write operations
- Storage used

**Vectorize:**
- Query count
- Dimensions indexed

**Workers AI:**
- Inference requests
- Model usage

Set up billing alerts in Cloudflare Dashboard → Billing.

---

## Next Steps

After initial deployment:

1. ✅ Monitor logs for errors
2. ✅ Set up alerting (see PRODUCTION_READINESS.md)
3. ✅ Run full ingestion to populate data
4. ✅ Test MCP tools in Claude Desktop
5. ✅ Monitor usage and costs
6. ✅ Scale as needed
