# Review guide

One checklist for every reviewer of this repo: you, Claude (`/code-review`, `/security-review`),
Codex (`/codex:review`, `/codex:adversarial-review`) and the Claude security review that runs in
CI. If a review keeps flagging the same thing, or keeps missing it, change this file.

The CI security review reads its own copies of the security rules, in
[`.github/security-review/`](.github/security-review/). Keep them in sync with the
"Security rules" and "Not findings" sections below.

## How changes get checked

| Layer | What runs | Where |
| --- | --- | --- |
| Claude Code edit hook | Biome safe fixes (format, import order) on each file Claude edits | `.claude/settings.json` |
| Pre-commit | Biome on staged files, Worker type-check, site ESLint on staged files | `.githooks/pre-commit` (installed by `bun install`) |
| PR checks (required on `main` once the ruleset is applied) | Biome, type-check, tests, migrations, builds, dry-run deploy | `.github/workflows/build.yml` |
| Claude security review | Diff-aware security review, posted as PR comments. Advisory, not required | `.github/workflows/security-review.yml` |
| Cross-model review | Codex review of sensitive paths before merge | manual, see below |

`git commit --no-verify` skips the pre-commit hook. CI still runs the same checks.

## Which review, when

- **Routine change** (copy, UI, docs, a bug fix away from the sensitive paths): one pass of
  `/code-review` or `/codex:review --base main`.
- **Touches a sensitive path** (list below): run `/security-review` locally and
  `/codex:adversarial-review --base main` before merging. The CI security review also comments.
  A second model is the point: Claude and Codex miss different things.
- **Monthly report PR**: a person reads the whole diff, using "Generated content" below.

Sensitive paths:

- `src/admin.ts` and `apps/teambuilder/src/app/api/admin/**`: the only gate on `/admin` is the
  Worker's own check of the Cloudflare Access token
- `src/index.ts` (routing), `src/connector/**` (the public, authless `/mcp` surface)
- `src/share.ts`, `src/meta-history.ts`, `src/tournaments/**`: KV and D1 access
- `scripts/generate-reports.ts`, `scripts/fetch-tournaments.ts`, `scripts/lib/**`: third-party
  and LLM text that ends up in published pages
- `.github/workflows/**`, `wrangler.jsonc`, `apps/teambuilder/wrangler.toml`: secrets and deploys

## Correctness rules

- **Connector tools** (`src/connector/`): one operation per tool, no `type` switches. Return
  `ok(data, text)` or `fail(message)`. The output schema in `CONNECTOR_TOOLS` matches what the
  tool returns. Every tool is covered in `src/__tests__/connector.test.ts`. Run
  `bun run generate-tool-docs` after changing a tool.
- **Names and formats**: look up Pokémon, moves and items through `toID()`. Resolve
  a tool's `format` argument through `resolveRegulation` (`src/connector/formats.ts`) and read
  stats under the regulation's `showdownFormatId`. Never hard-code a regulation id where the
  registry default applies.
- **Stats in KV**: the Worker reads only the sharded keys that `bun run upload-stats` writes
  (`{format}:_index` and `{format}:{pokemonid}`). A whole stats JSON under a bare format key is
  never read.
- **Generated files are not edited by hand**: `src/data/` (Showdown dex), `src/cached-tournaments/`,
  `src/discovered-formats.json`, and report files whose manifest entry has `generated: true`.
  Fix the generator instead.
- **Scripts that publish** (reports, KV and D1 uploads): fail loudly. A swallowed error that
  ships an empty or partial report or snapshot is a bug.
- **Tests**: a behaviour change comes with a test that fails without it.

## Security rules

- **Third-party and LLM text in MDX.** Strings from Limitless (event names, player names,
  decklist names), Smogon or the Claude API that `scripts/` writes into `.mdx` must be escaped
  for MDX: `{`, `}`, `<`, `>`, and `|` inside table cells. MDX compiles `{…}` to JavaScript that
  runs during `next build`, and the production build runs with deploy credentials. Prefer
  rendering third-party data from JSON through React.
- **Admin auth.** `/admin/*` must go through `handleAdminRequest` in `src/admin.ts`. Keep the
  signature check against the team's keys with the algorithm pinned, and the `exp` check. Don't
  widen the non-production bypass.
- **The connector stays read-only.** No `/mcp` tool path writes to KV, D1 or R2, or calls a host
  that tool arguments control.
- **Tool errors stay generic.** `fail()` messages are actionable for the user and carry no
  stack traces, binding names, SQL or upstream response bodies.
- **Queries and keys.** D1 queries use `.prepare(...).bind(...)`. KV keys built from user input go
  through the regulation registry or `toID()`. Never interpolate either.
- **Raw HTML.** `dangerouslySetInnerHTML` only for JSON-LD, with `<` escaped
  (`.replace(/</g, "\\u003c")`).
- **Workflows.** No `pull_request_target` or `workflow_run` that checks out PR code. Untrusted
  `${{ github.event.* }}` values go through `env:`, never straight into `run:`. Don't add steps
  that expose `CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY` or `LIMITLESS_API_KEY` to code built
  from PR branches or third-party data.
- **Shared production data.** Every environment binds the production KV, D1 and R2. Code that
  writes or deletes data from a staging, dev or script path needs an explicit opt-in flag.

## Generated content (the monthly report PR)

The `chore/meta-reports` PR is opened by `update-stats.yml`. Review all of it:

- The narrative is LLM-written. Check its claims and numbers against the tables.
- Tables, headings, event names and player names are third-party text. Search the diff for
  `{`, `}`, `<` and `>` outside code spans, both in the `.mdx` files and in
  `src/cached-tournaments/`.
- Spot-check one Pokémon's trend JSON against the Smogon numbers.

## Not findings

These are intentional. Don't report them unless a change makes them worse:

- `/mcp` has no auth and uses wildcard CORS without credentials. It is a public, read-only
  connector.
- Retired endpoints return `410 Gone`: `/sse`, `/api/tools`, share creation, the site's old MCP
  routes.
- Usage statistics, Pokémon data and tournament results are public data.
- Connector analytics store only the client name and version and the user-agent product token,
  never tool arguments or results. That is operational metadata, not PII.
- `src/data/` and `src/cached-tournaments/` are data, not code.

## How to report

- Give the location as `file:line`, a one-sentence defect, and a concrete failing input or
  exploit path.
- Label each finding **Blocker**, **Should fix** or **Nit**. Lead with correctness and security;
  leave formatting to Biome.
- For security findings, report only what you are at least 80% sure is exploitable, with a
  1–10 confidence. Say what you checked and found sound, so an empty report means something.
