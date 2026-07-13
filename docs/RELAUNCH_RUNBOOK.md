# PokeMCP Prep Cloudflare relaunch runbook

This runbook is intentionally split into reversible phases. Do not apply a D1 migration or switch traffic without a current, validated SQL export and Time Travel bookmark for every existing production database.

## Current production resources

- Internal analysis Worker: `pokemon-mcp-production`
- Web Worker: `pokemcp-teambuilder`
- Tournament/meta D1: `pokemcp-meta-history`
- Product/account D1: `pokemcp-prep`
- Internal service binding: `PREP_ANALYSIS` → `pokemon-mcp-production#PrepAnalysisService`
- Historical Durable Object migration `v2` and the `IngestionCoordinator` export
  must remain present; the class has no public binding in the relaunched product.

Cloudflare automatically maintains D1 Time Travel history. The release process also takes portable SQL exports because Worker rollback does not roll back D1 schema or data.

## Preparation status — 2026-07-13 UTC

- `pokemcp-prep` provisioned in ENAM and pinned in `wrangler.toml`.
- `META_DB` migrations `0001` and `0002` applied; no migrations pending.
- `PREP_DB` migration `0001` applied; no migrations pending and no foreign-key violations.
- Pre-migration backup: `.backups/cloudflare/20260713T013247Z-pre-migration/`.
- Post-migration backup and release-state inventory: `.backups/cloudflare/20260713T013725Z-post-migration/`.
- `BETTER_AUTH_SECRET` installed on `pokemcp-teambuilder` without storing its value locally.
- Discord and Google OAuth secrets installed; both production authorization
  initiations resolve to the expected provider endpoints.
- Final pre-deploy backup: `.backups/cloudflare/20260713T021556Z/`.
- Internal Worker deployed as version `0b46107c-059d-4400-9888-7f9af153c12c`.
- Web Worker deployed as version `e8fed99d-261f-46a6-b850-0bb869f086c2`.
- Post-deploy inventory: `.backups/cloudflare/20260713T023232Z-post-deploy/`.
- Pending: copy the final backup to encrypted off-machine storage and complete
  one human sign-in with each OAuth provider before broad launch promotion.

## OAuth production checklist

- Keep only `https://www.pokemcp.com` in Better Auth's production trusted
  origins. Localhost is for a separate local configuration only.
- Publish the Google app as an external production app, verify ownership of
  `pokemcp.com`, and use `https://www.pokemcp.com/privacy` for the public privacy
  policy. Request only the basic `openid`, `email`, and `profile` scopes.
- Keep the Discord installation limited to sign-in scopes; no bot or guild
  permissions are required. Retain only the exact production callback above.
- Keep provider credentials and auth signing keys as Worker secrets. Rotate a
  provider secret immediately if it is exposed. Use Better Auth's versioned
  secret support for a planned signing-key rotation so existing sessions and
  encrypted OAuth tokens remain readable during rollover.
- Re-run a real sign-in, sync, sign-out, and deletion with each provider after
  any callback, secret, domain, or consent-screen change.

## 1. Pre-migration backup

Run during a low-traffic window because a D1 export temporarily blocks other database requests.

```bash
bun run cloudflare:backup pokemcp-meta-history pokemcp-prep
```

Each database receives a full SQL export, its current Time Travel bookmark, a SHA-256 checksum, and an import into temporary SQLite followed by `PRAGMA integrity_check`. The backup also records both Workers' deployment IDs, secret names, D1 inventory, Wrangler configs, and current Git commit.

Backups are written beneath `.backups/cloudflare/`, permissioned to the current user, and ignored by Git. Copy the completed backup directory to an encrypted off-machine location before cutover.

## 2. Provision and migrate D1

Create the product database once, then commit its UUID to `apps/teambuilder/wrangler.toml`:

```bash
bunx wrangler d1 create pokemcp-prep --location enam
```

Apply migrations explicitly to remote production databases:

```bash
bunx wrangler d1 migrations apply META_DB --remote --env production
cd apps/teambuilder
bunx wrangler d1 migrations apply PREP_DB --remote --config wrangler.toml
```

After each apply, list the remote schema and migration ledger. Then take another validated backup so both pre-migration and post-migration states are retained.

## 3. Configure production secrets

Never pass secret values as command arguments or commit them. Use `wrangler secret put` interactively.

Internal Worker requirements:

- `CF_AIG_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_URL`

Web Worker requirements:

- `ANTHROPIC_API_KEY`
- `CF_AIG_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_URL`
- `BETTER_AUTH_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

The production Better Auth base URL is version-controlled as `https://www.pokemcp.com`. Register these exact production redirects with the providers:

- Discord: `https://www.pokemcp.com/api/auth/callback/discord`
- Google: `https://www.pokemcp.com/api/auth/callback/google`

## 4. Seed and verify tournament data

Deploy the internal Worker first because the web Worker depends on its named service entrypoint. Apply the `META_DB` migration before invoking ingestion.

Verify that tournament and job tables exist, manual ingestion succeeds, the newest event has a source URL and fetch timestamp, a failed rerun leaves prior successful rows intact, and the 06:00 UTC cron is visible. Take a post-seed backup of `pokemcp-meta-history`.

## 5. Deployment order

1. Record current deployment/version IDs for both Workers.
2. Deploy `pokemon-mcp-production` and verify `PrepAnalysisService` without switching the web experience.
3. Build and dry-run the OpenNext Worker.
4. Deploy `pokemcp-teambuilder`.
5. Verify OAuth callbacks, D1 bindings, the service binding, and the rate limiter.
6. Switch traffic only after the smoke tests pass.

## 6. Smoke tests

- Newsroom renders the latest successful snapshot and visible freshness date.
- Anonymous indexed-team prep reaches a saved Match Desk.
- Paste and manual opponent modes work.
- Markdown copy and print/PDF work.
- Discord and Google sign-in claim an anonymous workspace.
- A protected sync request without a valid session returns `401`.
- `/mcp`, `/sse`, `/sse/message`, `/api/tools`, and stored-team creation return `410`.
- Existing `/t/[id]` links remain readable.
- Primary flows work at 320 px and by keyboard.

Run the automated inventory before cutover:

```bash
bun run cloudflare:preflight
```

The Cloudflare backup, state-capture, and preflight scripts are also forwarded from `apps/teambuilder`, so the same commands work after running the OAuth secret commands from that directory.

## 7. Rollback

Code rollback and data recovery are separate operations.

- Worker code: use the deployment IDs recorded before cutover and `wrangler rollback`.
- D1 data/schema: use the saved SQL export for reconstruction or the recorded Time Travel bookmark for an in-place restore.

Time Travel restore overwrites the live database and cancels in-flight queries. Treat it as a destructive incident action: confirm the target database/bookmark and take a new export of the current state before restoring.

## 8. CI/CD ownership

GitHub Actions now runs the Worker tests, teambuilder tests, typechecks,
production OpenNext build, generated-binding checks, and empty/populated D1
migration tests on pull requests and pushes to `main`. After all three build
jobs pass on a push to `main`, that workflow calls the reusable production
deploy workflow. Deployment refuses to run from a non-main ref or while either
database has pending migrations, and deploys the internal analysis Worker
before the web Worker. The same workflow remains manually runnable for a
deliberate retry or partial deployment. GitHub's `Production` environment keeps
the existing required-reviewer approval in front of the coordinated release.

GitHub Actions is the sole automatic production deploy owner. Keep the Git build
connections disabled for both `pokemon-mcp-production` and
`pokemcp-teambuilder`; otherwise a push to `main` will create duplicate,
unordered deployments alongside the sequential GitHub release.

If Workers Builds is intentionally restored later, first disable the automatic
GitHub production call and consolidate the release under one build trigger so
the service binding cannot race its provider:

- Root directory: repository root
- Build command: `bun run ci:release`
- Deploy command: `bun run deploy:all`
- Production branch: `main`

Never enable both automatic paths at once. The documentation Pages integration
can remain separate.
