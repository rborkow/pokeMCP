# Production Deployment Checklist

Use this checklist before deploying to production.

---

## Pre-Deployment

### Code Quality
- [ ] All TypeScript type checks pass (`npm run type-check`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] No TODO/FIXME in critical paths
- [ ] Version bumped in package.json and index.ts

### Testing
- [ ] Unit tests pass (when implemented)
- [ ] Manual testing on staging completed
- [ ] Test ingestion works on staging
- [ ] RAG queries return relevant results
- [ ] All MCP tools tested via Claude Desktop
- [ ] Load tested (if expecting high traffic)

### Infrastructure
- [ ] Production KV namespaces created
- [ ] Production Vectorize index created
- [ ] Metadata indexes created (pokemon, format, section_type)
- [ ] Cron schedule configured
- [ ] Environment variables set in `wrangler.jsonc`
- [ ] GitHub secrets configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)

### Security
- [ ] No secrets in code or git history
- [ ] API rate limiting configured
- [ ] Input validation in place (Zod schemas)
- [ ] CORS headers configured correctly
- [ ] Error messages don't leak sensitive info

### Monitoring
- [ ] Cloudflare Workers analytics enabled
- [ ] Error tracking configured (Sentry recommended)
- [ ] Alerting rules set up
- [ ] Logging strategy defined
- [ ] Health check endpoint working

---

## Deployment

### Pre-Flight
- [ ] Create a deployment issue/ticket
- [ ] Notify team of deployment window
- [ ] Take backup of current KV data (if applicable)
- [ ] Note current deployment version for rollback

### Deploy
- [ ] Deploy to staging first
- [ ] Verify staging deployment successful
- [ ] Run smoke tests on staging
- [ ] Get approval for production deployment
- [ ] Deploy to production via GitHub Actions
- [ ] Monitor deployment in real-time (`npm run tail:production`)

### Post-Deployment
- [ ] Verify server info endpoint works
- [ ] Test RAG query endpoint
- [ ] Check Vectorize has data
- [ ] Run test ingestion (small subset)
- [ ] Monitor error rates for 15 minutes
- [ ] Check latency metrics
- [ ] Test MCP tools in Claude Desktop

---

## Post-Deployment

### Immediate (First Hour)
- [ ] Monitor logs for errors
- [ ] Check request rate and latency
- [ ] Verify cron job scheduled correctly
- [ ] Update deployment documentation
- [ ] Close deployment ticket

### Short-Term (First Day)
- [ ] Monitor error rates
- [ ] Check ingestion runs successfully
- [ ] Review cost metrics
- [ ] Collect user feedback
- [ ] Address any issues

### Long-Term (First Week)
- [ ] Review performance metrics
- [ ] Analyze usage patterns
- [ ] Identify optimization opportunities
- [ ] Plan next iteration
- [ ] Document lessons learned

---

## Rollback Plan

If issues are detected:

### Automatic Rollback Triggers
- Error rate > 10%
- P95 latency > 5s
- Complete service unavailability

### Rollback Steps
1. [ ] Identify issue and decide to rollback
2. [ ] Notify team
3. [ ] Execute rollback via Cloudflare dashboard or CLI
4. [ ] Verify rollback successful
5. [ ] Monitor for stability
6. [ ] Document issue for post-mortem

---

## Emergency Contacts

**Cloudflare Support:**
- Dashboard: https://dash.cloudflare.com
- Support: https://support.cloudflare.com

**On-Call:**
- Primary: [Your contact]
- Secondary: [Backup contact]

**Incident Communication:**
- Slack channel: #incidents (if applicable)
- Status page: [Your status page]

---

## Success Criteria

Deployment is successful when:
- ✅ All health checks pass
- ✅ Error rate < 1%
- ✅ P95 latency < 500ms
- ✅ RAG queries return results
- ✅ MCP tools work in Claude Desktop
- ✅ No critical issues reported

---

## Notes

Add deployment-specific notes here:

**Deployment Date:** _______
**Deployed By:** _______
**Version:** _______
**Issues Encountered:** _______
**Resolved:** _______
