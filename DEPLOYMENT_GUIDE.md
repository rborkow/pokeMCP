# Complete Deployment Guide for pokemcp.com

## Overview

Deploy PokéMCP to your domain **pokemcp.com** with:
- **MCP Worker** → `api.pokemcp.com` (or `pokemcp.com/mcp`)
- **Documentation** → `pokemcp.com`

---

## Step 1: Deploy MCP Worker

### Current Status
Your worker is currently at: `pokemon-mcp-cloudflare.rborkows.workers.dev`

### Deploy to Production

```bash
# From project root
npm run deploy:production
```

This deploys the worker with production configuration from `wrangler.jsonc`.

### Add Custom Domain to Worker

**Option A: Subdomain (Recommended)**

1. **In Cloudflare Dashboard:**
   - Go to Workers & Pages → pokemon-mcp-cloudflare
   - Click "Triggers" tab
   - Under "Custom Domains", click "Add Custom Domain"
   - Enter: `api.pokemcp.com`
   - Click "Add Domain"

2. **DNS is automatic** - Cloudflare handles it since domain is on CF

**Option B: Route Pattern**
- Use route: `pokemcp.com/mcp/*` → routes to worker
- Less clean but keeps everything on root domain

**Recommended: Use `api.pokemcp.com`** for clean separation.

---

## Step 2: Deploy Documentation Site

### Build Documentation

```bash
cd apps/docs
npm run build
```

Verify the `out/` directory is created.

### Deploy to Cloudflare Pages

#### Method 1: GitHub Integration (Recommended)

1. **Push to GitHub** (if not already)
   ```bash
   git add apps/docs
   git commit -m "Add documentation site"
   git push origin main
   ```

2. **Create Pages Project:**
   - Go to Cloudflare Dashboard → Pages
   - Click "Create a project"
   - Select "Connect to Git"
   - Authorize GitHub, select your repo

3. **Configure Build:**
   - **Project name**: `pokemcp-docs`
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Root directory**: `apps/docs`
   - **Environment variables**:
     - `NODE_VERSION` = `20`

4. **Deploy:**
   - Click "Save and Deploy"
   - Wait ~2 minutes for first build

#### Method 2: Direct Upload via Wrangler

```bash
cd apps/docs
npx wrangler pages deploy out --project-name=pokemcp-docs
```

After first deploy, you'll get a URL like: `pokemcp-docs.pages.dev`

---

## Step 3: Configure Custom Domains

### For Documentation (pokemcp.com)

1. **In Cloudflare Pages:**
   - Go to Pages → pokemcp-docs
   - Click "Custom domains" tab
   - Click "Set up a custom domain"
   - Enter: `pokemcp.com`
   - Click "Continue"

2. **DNS Configuration:**
   - Cloudflare will auto-configure DNS (since domain is on CF)
   - Creates CNAME: `pokemcp.com` → `pokemcp-docs.pages.dev`

3. **SSL Certificate:**
   - Automatically provisioned
   - Ready in ~15 minutes

### For MCP Worker (api.pokemcp.com)

Already done in Step 1! DNS is automatic since domain is on Cloudflare.

### Optional: www redirect

Set up `www.pokemcp.com` → `pokemcp.com`:

1. **Page Rules** (Cloudflare Dashboard):
   - Go to pokemcp.com → Rules → Page Rules
   - Create rule: `www.pokemcp.com/*`
   - Forwarding URL (301): `https://pokemcp.com/$1`

---

## Step 4: Update MCP Endpoint URLs

### In Documentation

Update all references from:
```
https://pokemon-mcp-cloudflare.rborkows.workers.dev/mcp
```

To:
```
https://api.pokemcp.com/mcp
```

**Files to update:**
- `apps/docs/pages/index.mdx`
- `apps/docs/pages/getting-started.mdx`
- Root `README.md`

### In Code

Update any hardcoded URLs in:
- `apps/docs/` (if any API calls)
- `CLAUDE.md`
- `README.md`

---

## Step 5: Verify Deployment

### Test MCP Worker

```bash
# Test root endpoint
curl https://api.pokemcp.com/

# Should return JSON with server info
```

### Test Documentation

Open in browser:
- https://pokemcp.com

Should see the Nextra docs homepage.

### Test MCP Endpoint

```bash
curl -X POST https://api.pokemcp.com/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

Should return list of 11 tools.

### Test SSL

Both should show valid SSL certificates:
- https://pokemcp.com
- https://api.pokemcp.com

---

## Final URLs

After deployment:

| Service | URL | Purpose |
|---------|-----|---------|
| **Documentation** | https://pokemcp.com | Main website & docs |
| **MCP Endpoint** | https://api.pokemcp.com/mcp | MCP server for Claude.ai |
| **Worker Root** | https://api.pokemcp.com/ | API info endpoint |
| **GitHub** | https://github.com/rborkow/pokeMCP | Source code |

---

## Update Claude.ai Custom Connector

Once deployed, update your connector:

1. Claude.ai → Settings → Integrations → Custom Connectors
2. Find "PokéMCP" connector
3. Edit URL to: `https://api.pokemcp.com/mcp`
4. Save

---

## DNS Records (Reference)

Cloudflare will auto-create these:

```
Type    Name    Content
CNAME   @       pokemcp-docs.pages.dev (proxied)
CNAME   api     pokemon-mcp-cloudflare.rborkows.workers.dev (proxied)
```

---

## Monitoring & Analytics

### Cloudflare Dashboard

**Pages Analytics:**
- Go to Pages → pokemcp-docs → Analytics
- View visits, bandwidth, requests

**Workers Analytics:**
- Go to Workers & Pages → pokemon-mcp-cloudflare → Metrics
- View requests, errors, CPU time

### Enable Web Analytics (Optional)

For documentation site:
1. Cloudflare Dashboard → Web Analytics
2. Add site: `pokemcp.com`
3. Copy beacon code
4. Add to `apps/docs/pages/_app.tsx`

---

## Troubleshooting

### Documentation Not Building

```bash
cd apps/docs
npm run build

# Check for errors
# Common: missing dependencies
npm install
```

### Worker Not Responding

```bash
# Check deployment status
npx wrangler deployments list

# View logs
npx wrangler tail
```

### Custom Domain Not Working

- Wait 15 minutes for SSL provisioning
- Check DNS propagation: `dig pokemcp.com`
- Verify domain is set to "Proxied" (orange cloud) in DNS

### 404 on Pages

- Ensure `trailingSlash: true` in `next.config.mjs`
- Clear browser cache
- Try incognito mode

---

## Cost Summary

With Cloudflare free tier:

| Service | Cost |
|---------|------|
| Workers (MCP) | Free (100k req/day) |
| Pages (Docs) | Free (500 builds/month) |
| KV Storage | Free (1GB) |
| Vectorize | Free (30M queries/month) |
| AI Workers | Free (10k neurons/day) |
| Custom Domain | Free (included with CF domain) |
| SSL Certificates | Free (auto) |

**Total: $0/month** 🎉

---

## Next Steps After Deployment

1. ✅ Test all endpoints
2. ✅ Update README.md with new URLs
3. ✅ Share pokemcp.com with users
4. ✅ Monitor analytics
5. 🚀 Start building Phase 2 (team builder) at `team.pokemcp.com`

---

## Quick Reference Commands

```bash
# Deploy MCP Worker
npm run deploy:production

# Deploy Documentation
cd apps/docs && npm run build
npx wrangler pages deploy out --project-name=pokemcp-docs

# View Worker logs
npx wrangler tail

# View Pages deployments
npx wrangler pages deployments list --project-name=pokemcp-docs
```

---

**Ready to deploy!** Follow steps 1-5 above in order.
