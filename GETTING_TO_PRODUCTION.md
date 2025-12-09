# Getting to Production - Quick Start Guide

This guide gets you from development to production-ready deployment in ~1-2 weeks.

---

## 📋 Overview

**What you have now:**
- ✅ Working MCP server with 11 tools
- ✅ RAG system with semantic search
- ✅ Deployed to development environment
- ✅ Basic monitoring via Cloudflare dashboard

**What you'll add:**
- ✨ CI/CD pipeline (GitHub Actions)
- ✨ Staging environment
- ✨ Production environment with safeguards
- ✨ Monitoring and alerting
- ✨ Automated deployments

---

## 🚀 Quick Start (30 minutes)

### Step 1: Set Up GitHub Actions (5 min)

Files already created:
- `.github/workflows/test.yml` - Runs on every PR
- `.github/workflows/deploy-staging.yml` - Auto-deploys to staging
- `.github/workflows/deploy-production.yml` - Manual production deployment

**Action Required:**
1. Add secrets to GitHub repo (Settings → Secrets → Actions):
   - `CLOUDFLARE_API_TOKEN` - Get from Cloudflare dashboard
   - `CLOUDFLARE_ACCOUNT_ID` - Run `npx wrangler whoami`

### Step 2: Create Staging Environment (10 min)

```bash
# Run automated setup
chmod +x scripts/setup-staging.sh
npm run setup:staging
```

This creates:
- 2 KV namespaces for staging
- Vectorize index for staging
- Metadata indexes

**Action Required:**
Update `wrangler.jsonc` with the KV IDs output by the script.

### Step 3: Deploy to Staging (5 min)

```bash
# Deploy
npm run deploy:staging

# Seed with test data
curl https://pokemon-mcp-staging.rborkows.workers.dev/test-ingestion

# Verify
curl https://pokemon-mcp-staging.rborkows.workers.dev/test-rag?q=counter+garchomp
```

### Step 4: Set Up GitHub Environments (10 min)

In GitHub (Settings → Environments):

**Create "staging" environment:**
- No protection rules
- Auto-deploys on push to main

**Create "production" environment:**
- Add yourself as required reviewer
- Deployment branches: only `main`
- Secrets: Same as above

---

## 📊 Cloudflare Dashboard Setup (20 minutes)

### 1. Enable Advanced Features

**Workers Analytics:**
- Navigate to Workers → pokemon-mcp-production
- Go to Metrics tab
- Enable analytics (free on Paid plan)

**Rate Limiting:**
- Navigate to Security → WAF
- Create rule: "Rate limit MCP endpoints"
  - Expression: `http.request.uri.path contains "/mcp"`
  - Action: Block
  - Threshold: 100 requests per minute

**Alerts:**
- Go to Notifications → Add
- Alert types to enable:
  - Worker Errors > 5% for 5 minutes
  - Worker P95 Latency > 2s for 5 minutes
  - Worker Availability < 99%

### 2. Review Current Usage

Check these pages monthly:
- Workers → Analytics (request volume, errors)
- KV → Usage (storage, operations)
- Vectorize → Dashboard (queries, storage)
- Billing → Usage (costs)

---

## 🔒 Security Hardening (30 minutes)

### 1. Add Rate Limiting to Code

Create `src/middleware/rateLimit.ts` (see PRODUCTION_READINESS.md for code)

Apply to sensitive endpoints:
- `/mcp` - MCP tool calls
- `/test-rag` - RAG queries
- `/test-ingestion` - Ingestion trigger

### 2. Add Input Validation

Already using Zod, but add:
- Max query length: 1000 chars
- Pokemon name allowlist validation
- Sanitize user inputs

### 3. Configure CORS

Add proper CORS headers (see PRODUCTION_READINESS.md).

---

## 📈 Monitoring Setup (1 hour)

### Option 1: Basic (Cloudflare only)

**Already Have:**
- Cloudflare Workers logs
- Real-time tail: `npm run tail:production`
- Analytics dashboard

**Add:**
- Custom analytics events for key metrics
- Alerting via email/Slack webhook

### Option 2: Advanced (Sentry integration)

**Add Sentry:**
```bash
npm install @sentry/cloudflare
```

Configure in code (see PRODUCTION_READINESS.md).

**Benefits:**
- Detailed error tracking
- Performance monitoring
- Release tracking
- User impact analysis

---

## 🧪 Testing Strategy (2-4 hours)

### 1. Add Basic Tests

```bash
npm install -D vitest @cloudflare/vitest-pool-workers
```

Create `tests/` directory with:
- Unit tests for RAG functions
- Integration tests for MCP tools
- Load tests for scale validation

### 2. Run in CI

Already configured in `.github/workflows/test.yml` - uncomment test step when ready.

---

## 📦 First Production Deployment

### Pre-Deployment Checklist

Use `PRODUCTION_CHECKLIST.md` - key items:
- [ ] Staging tested thoroughly
- [ ] All checks passing in GitHub
- [ ] Monitoring and alerts configured
- [ ] Team notified
- [ ] Rollback plan ready

### Deploy Process

1. **Create release branch:**
   ```bash
   git checkout -b release/v0.3.0
   git tag v0.3.0
   git push origin v0.3.0
   ```

2. **Deploy via GitHub Actions:**
   - Go to Actions → Deploy to Production
   - Click "Run workflow"
   - Enter version: `v0.3.0`
   - Wait for approval notification
   - Approve deployment

3. **Monitor:**
   ```bash
   npm run tail:production
   ```

4. **Verify:**
   ```bash
   curl https://pokemon-mcp-production.rborkows.workers.dev/
   curl https://pokemon-mcp-production.rborkows.workers.dev/test-rag?q=test
   ```

5. **Seed Data:**
   - Wait for Sunday 3am UTC (automatic cron)
   - OR trigger manually via Cloudflare dashboard

---

## 💰 Cost Management

### Current Costs (Estimated)

With 27 vectors and light usage:
- Workers: **~$0** (within free tier)
- KV: **~$0** (within free tier)
- Vectorize: **~$0.10/month** (query-based)
- Workers AI: **~$0.50/month** (embedding generation)

**Total: ~$0.60/month** for development/light usage

### Scaling Costs

At 10,000 queries/month with full ingestion (300 Pokemon):
- Workers: **$5/month** (paid plan)
- KV: **$1/month**
- Vectorize: **$10-20/month**
- Workers AI: **$15/month**

**Total: ~$30-40/month** for moderate production usage

### Set Budget Alerts

In Cloudflare Dashboard → Billing:
- Set alert at $10/month
- Set alert at $50/month
- Review usage weekly

---

## 📚 Documentation

Key documents created:

1. **PRODUCTION_READINESS.md** - Comprehensive production plan
2. **DEPLOYMENT.md** - Deployment procedures and commands
3. **PRODUCTION_CHECKLIST.md** - Pre-deployment checklist
4. **This file** - Quick start guide

Keep these updated as you iterate.

---

## 🎯 Success Metrics

### Week 1
- ✅ CI/CD pipeline working
- ✅ Staging environment stable
- ✅ Monitoring and alerts active
- ✅ Documentation complete

### Week 2
- ✅ Production deployed successfully
- ✅ No critical issues
- ✅ RAG queries working well
- ✅ Users able to connect via MCP

### Month 1
- ✅ Uptime > 99.9%
- ✅ Error rate < 1%
- ✅ P95 latency < 500ms
- ✅ Cost within budget

---

## 🆘 Getting Help

**Cloudflare Resources:**
- Workers Docs: https://developers.cloudflare.com/workers/
- Community: https://community.cloudflare.com/
- Discord: https://discord.gg/cloudflaredev

**Monitoring Issues:**
- Check Cloudflare status: https://www.cloudflarestatus.com/
- Review logs: `npm run tail:production`
- Check analytics dashboard

**Emergency Rollback:**
```bash
npx wrangler deployments list --env production
npx wrangler rollback <version-id> --env production
```

---

## 🚦 Next Steps

**Immediate (Today):**
1. [ ] Review all documentation
2. [ ] Add GitHub secrets
3. [ ] Run staging setup script
4. [ ] Deploy to staging

**This Week:**
1. [ ] Test thoroughly on staging
2. [ ] Set up monitoring
3. [ ] Configure alerts
4. [ ] Prepare for production

**Next Week:**
1. [ ] Production deployment
2. [ ] Monitor closely
3. [ ] Gather feedback
4. [ ] Iterate based on learnings

---

## 📝 Notes

Good luck with your production deployment! 🚀

Remember:
- **Start small** - Don't over-engineer
- **Monitor closely** - Especially first week
- **Iterate quickly** - Fix issues as they come
- **Document everything** - Future you will thank you
