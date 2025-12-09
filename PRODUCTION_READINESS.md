# Production Readiness Plan

## Overview
This document outlines the steps needed to make the Pokémon MCP server production-ready with proper CI/CD, monitoring, and safety measures.

---

## 1. CI/CD Pipeline

### GitHub Actions Workflows

#### `.github/workflows/test.yml` - Run on every PR
```yaml
name: Test

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test  # Unit tests
```

#### `.github/workflows/deploy-staging.yml` - Deploy to staging on merge to main
```yaml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Deploy to Staging
        run: npx wrangler deploy --env staging
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

#### `.github/workflows/deploy-production.yml` - Manual production deployment
```yaml
name: Deploy Production

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Run tests
        run: npm test
      - name: Deploy to Production
        run: npx wrangler deploy --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - name: Create Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.event.inputs.version }}
```

---

## 2. Cloudflare Configuration

### A. Environment Setup

Create separate Cloudflare environments:

**Staging Environment:**
- Worker name: `pokemon-mcp-staging`
- Custom domain: `staging-mcp.yourdomain.com`
- KV namespaces with `-staging` suffix
- Vectorize index: `pokemon-strategy-index-staging`

**Production Environment:**
- Worker name: `pokemon-mcp-production`
- Custom domain: `mcp.yourdomain.com`
- Production KV namespaces
- Vectorize index: `pokemon-strategy-index`

### B. Rate Limiting & DDoS Protection

**Workers Rate Limiting:**
```typescript
// Add to src/middleware/rateLimit.ts
export async function rateLimit(request: Request, env: Env): Promise<Response | null> {
  const clientIP = request.headers.get('cf-connecting-ip');
  const rateLimitKey = `rate_limit:${clientIP}`;

  const requests = await env.RATE_LIMIT_KV.get(rateLimitKey);
  const count = requests ? parseInt(requests) : 0;

  if (count > 100) { // 100 requests per minute
    return new Response('Rate limit exceeded', { status: 429 });
  }

  await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), { expirationTtl: 60 });
  return null;
}
```

**Cloudflare WAF Rules:**
- Block requests with suspicious user agents
- Challenge requests from Tor exit nodes
- Rate limit by IP: 100 req/min per endpoint
- Block countries if needed (GDPR considerations)

### C. Monitoring & Alerts

**Workers Analytics:**
- Enable in Cloudflare dashboard
- Track request volume, errors, latency
- Set up alert thresholds:
  - Error rate > 5%
  - P95 latency > 2s
  - Request rate drops > 50%

**Logpush (Enterprise feature):**
- Send logs to S3/BigQuery for analysis
- Retain logs for 30 days minimum
- Set up anomaly detection

**Real User Monitoring (RUM):**
```typescript
// Add performance tracking
performance.mark('query-start');
const result = await queryStrategy(options, env);
performance.mark('query-end');
performance.measure('query-duration', 'query-start', 'query-end');
```

### D. Error Tracking

**Sentry Integration:**
```typescript
// src/monitoring/sentry.ts
import * as Sentry from '@sentry/cloudflare';

export function initSentry(request: Request, env: Env, ctx: ExecutionContext) {
  return Sentry.withScope(async (scope) => {
    scope.setContext('cloudflare', {
      worker: 'pokemon-mcp',
      colo: request.cf?.colo,
    });

    return await fetch(request, env, ctx);
  });
}
```

**Cloudflare Workers Trace Events:**
- Enable trace events for debugging
- Set sampling rate (10% in prod)

---

## 3. Data Management

### A. Backup Strategy

**KV Backup Script:**
```typescript
// scripts/backup-kv.ts
async function backupKV(namespace: KVNamespace, env: Env) {
  const list = await namespace.list();
  const backup: Record<string, any> = {};

  for (const key of list.keys) {
    backup[key.name] = await namespace.get(key.name, 'json');
  }

  // Upload to R2 or S3
  await env.R2_BACKUPS.put(
    `kv-backup-${Date.now()}.json`,
    JSON.stringify(backup)
  );
}
```

**Vectorize Backup:**
- No native backup - rely on re-ingestion
- Keep source data (Smogon API responses) cached
- Document re-ingestion process

### B. Ingestion Monitoring

**Add to orchestrator:**
```typescript
// Send metrics to analytics
await env.ANALYTICS.writeDataPoint({
  indexes: ['ingestion_metrics'],
  blobs: [
    stats.pokemonProcessed,
    stats.errors,
    Date.now() - startTime
  ],
  doubles: [stats.embeddingsGenerated]
});

// Alert on failures
if (stats.errors > 5) {
  await sendAlert(env, 'High error rate in ingestion');
}
```

### C. Data Retention

- **KV Documents**: 180 days (already set)
- **Usage Stats**: 90 days
- **Logs**: 30 days (via Logpush)
- **Backups**: 7 daily, 4 weekly, 12 monthly

---

## 4. Security

### A. Secrets Management

**Environment Variables (wrangler.jsonc):**
```jsonc
{
  "env": {
    "production": {
      "vars": {
        "ENVIRONMENT": "production",
        "SENTRY_DSN": "...",
        "ALERT_WEBHOOK": "..."
      }
    }
  }
}
```

**Secrets (via Wrangler CLI):**
```bash
# API keys, tokens
wrangler secret put SMOGON_API_KEY --env production
wrangler secret put ALERT_WEBHOOK_SECRET --env production
```

### B. Input Validation

Already using Zod, but add:
- Maximum query length (1000 chars)
- Sanitize user inputs
- Validate Pokémon names against allowlist

### C. CORS Configuration

```typescript
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', 'https://claude.ai');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { ...response, headers });
}
```

---

## 5. Testing Strategy

### A. Unit Tests

```typescript
// tests/rag/rerank.test.ts
import { describe, it, expect } from 'vitest';
import { rerankResults } from '../src/rag/rerank';

describe('rerankResults', () => {
  it('should boost format matches', () => {
    const results = [
      { metadata: { format: 'gen9ou' }, score: 0.7 },
      { metadata: { format: 'gen9ubers' }, score: 0.8 }
    ];

    const ranked = rerankResults(results, { format: 'gen9ou' });
    expect(ranked[0].metadata.format).toBe('gen9ou');
  });
});
```

### B. Integration Tests

```typescript
// tests/integration/mcp-tools.test.ts
import { unstable_dev } from 'wrangler';

describe('MCP Tools', () => {
  let worker;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    });
  });

  it('query_strategy returns results', async () => {
    const resp = await worker.fetch('/test-rag?q=counter+garchomp');
    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.results.length).toBeGreaterThan(0);
  });
});
```

### C. Load Testing

```bash
# Using k6
k6 run --vus 100 --duration 30s tests/load/mcp-load.js
```

---

## 6. Operational Readiness

### A. Runbook

Create `RUNBOOK.md` with:
- Deployment procedures
- Rollback steps
- Common issues and fixes
- On-call escalation

### B. Health Checks

```typescript
// Add /health endpoint
if (url.pathname === '/health') {
  const checks = await Promise.all([
    checkVectorize(env),
    checkKV(env),
    checkWorkersAI(env)
  ]);

  const healthy = checks.every(c => c.ok);
  return new Response(JSON.stringify({ healthy, checks }), {
    status: healthy ? 200 : 503
  });
}
```

### C. Graceful Degradation

```typescript
// Fallback if RAG fails
try {
  return await queryStrategy(options, env);
} catch (error) {
  console.error('RAG failed, falling back to stats API', error);
  return await getPopularSets({ pokemon: options.pokemon }, env);
}
```

---

## 7. Cost Management

### A. Budget Alerts

- Set up Cloudflare billing alerts
- Monitor Workers CPU time
- Track Vectorize query costs
- Set spending limits

### B. Optimization

- Cache frequent queries (5 min TTL)
- Batch ingestion efficiently
- Use Vectorize query filters to reduce costs
- Implement request coalescing for popular queries

---

## 8. Compliance

### A. Data Privacy

- Document data sources (Smogon public data)
- No PII collected
- GDPR: Right to explanation (show source URLs)
- Terms of service for API usage

### B. Rate Limiting Notice

Add to README:
```
Rate Limits:
- 100 requests/minute per IP
- 1000 requests/hour per IP
- Contact for higher limits
```

---

## Implementation Priority

**Phase 1 (Week 1):**
1. ✅ Set up GitHub Actions for staging deployment
2. ✅ Create staging environment in Cloudflare
3. ✅ Add basic rate limiting
4. ✅ Set up error tracking (Sentry)

**Phase 2 (Week 2):**
5. ✅ Add unit tests for critical functions
6. ✅ Create production environment
7. ✅ Set up monitoring and alerts
8. ✅ Document runbook

**Phase 3 (Week 3):**
9. ✅ Add health checks
10. ✅ Implement backup strategy
11. ✅ Load testing
12. ✅ Production deployment

---

## Success Metrics

- **Uptime**: >99.9%
- **Error Rate**: <1%
- **P95 Latency**: <500ms for queries
- **Deployment Frequency**: Daily to staging, weekly to prod
- **Mean Time to Recovery**: <15 minutes

---

## Next Steps

1. Review this plan with stakeholders
2. Set up GitHub Actions workflows
3. Create staging environment
4. Implement monitoring
5. Write tests
6. Deploy to production
