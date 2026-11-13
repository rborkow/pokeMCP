# VGC Teambuilder beyond Claude and ChatGPT — scope

Researched 2026-11-12. Phase 1 (partial) and the docs and registry parts of phase 2 were started on 2026-11-13; see the progress section below.

## Progress, 2026-11-13

**Production build:** the PR #139 build. A `server/discover` request still gets 400 `-32000`, and PR #141 is still open. Production lists 15 tools.

**C1, run here.** Each client went through a logging proxy to production, ran `list_formats`, `get_top_usage` and `validate_team` (or a subset), and the wire traffic was recorded:

| Client | Result | Protocol behaviour seen |
|---|---|---|
| Claude Code 2.1.323 | Pass | **Dual-era.** Sends `server/discover` (2026-07-28) first, gets our 400, falls back to `initialize` 2025-11-25. Tries a GET stream (405) and carries on |
| Codex CLI 0.167.2 | Pass | `initialize` 2025-06-18 only. Accept is `text/event-stream, application/json` |
| TypeScript SDK v1 (`@modelcontextprotocol/sdk`) | Pass | `initialize` 2025-11-25. GET 405, then carries on |
| Python SDK 2.3.0 (`mcp.Client`, default `auto`) | Pass | Dual-era: `server/discover`, then falls back to `initialize` |
| Python SDK 1.30.0 | Pass | `initialize` 2025-11-25 |

Every client sent both Accept types, so no evidence for C3 so far. Claude Code and Python SDK 2.x are the first confirmed dual-era clients in the wild, and both fall back cleanly against the #139 build.

**Not run here:**
- Gemini CLI: running it with `npx` was blocked in this session pending approval. OpenClaw, opencode and Goose were not attempted, since they would need the same kind of install.
- Hermes: the local install is broken (`~/.local/bin/hermes` points at a missing binary). Hermes uses the Python MCP SDK, which passed.
- Account-bound clients (Grok app, Grok Bot, Gemini app, Perplexity, Le Chat, Cursor, VS Code) still need the user.

**Docs:** written on the `docs/other-assistants` branch. There are new pages `coding-agents`, `assistants`, `agents` and `troubleshooting`, and the existing `/getting-started` URL is unchanged. Each section is marked "Tested" or "Not yet tested". Every snippet was re-checked against the vendor's current docs on 2026-11-13. Corrections to section 3 below:
- OpenClaw defaults to SSE when the transport is omitted.
- opencode V2 nests servers under `mcp.servers`.
- VS Code's `.vscode/mcp.json` is deprecated, with removal in February 2027; the native files are `~/.copilot/mcp-config.json` and `.mcp.json`.
- Le Chat is being renamed Mistral Vibe.
- Kiro's add link takes URL-encoded JSON, not base64.
- The 400 "session required" troubleshooting entry no longer applies.

**L1:** `server.json` is written at the repo root (`com.pokemcp/vgc-teambuilder`, version 1.0.0, generic copy). It validates against the 2025-12-11 schema. Publishing still needs the DNS TXT record and `mcp-publisher`.

**Evidence grades** used throughout:

- **M**: measured against `https://api.pokemcp.com/mcp` today.
- **P**: read in the vendor's own docs or source code today.
- **S**: secondary source only, such as a blog post or third-party guide.
- **U**: unconfirmed.

No real client has been tested against the server yet. Every "will break" note below is inferred from docs, which is why phase 1 is a test matrix.

## Update after PR #139 (stateless MCP), re-probed 2026-11-12

PR #139 serves `/mcp` from the Worker itself: a fresh server and transport for every POST, plain JSON replies, and no session or Durable Object. I re-probed production after the deploy:

| Behaviour | Before #139 | Now |
|---|---|---|
| `initialize` | SSE reply plus `Mcp-Session-Id`, about 1–1.8 s | JSON reply, no session id, mostly 0.13–0.22 s (one sample of 1.5 s) |
| Call without a session id | 400 | Answered |
| Old or unknown session id | 404 | Ignored and answered |
| Response framing | Always SSE | Always `application/json` |
| GET / DELETE | 400 | 405 with `Allow: POST, OPTIONS` |
| Error bodies | JSON labelled `text/plain` | `application/json` |
| Accept missing `text/event-stream` | 406 | **406, unchanged** |
| Request in the 2026-07-28 style | 400 "Mcp-Session-Id required" | 400 `-32000` "Unsupported protocol version: 2026-07-28 (supported: 2025-11-25 …)" |
| `server/discover` | 400 | `-32601` Method not found |

**What that changes in this scope:**

- **C4 (session-optional calls) is done**, and so is **C5** (error content type). Clients that drop the session id, and stateless proxies such as API-side MCP tools (xAI, Gemini API), no longer have a session to lose.
- **Clients that can't parse SSE are fine now**, because every reply is plain JSON. A client that only sends `Accept: application/json` still gets 406, so **C3 shrinks to a one-line Accept tolerance** (P: the 2026-07-28 binding still requires clients to send both types, so this remains tolerance rather than a fix).
- **Fallback from new-spec clients still works.** The modern error for a version mismatch is `UnsupportedProtocolVersion` **`-32022`**. Our 400 carries `-32000`, which the spec does not treat as a recognized modern error. So a dual-era client classes us as legacy and falls back to `initialize` (P: versioning spec and changelog item 12). Modern-only clients still fail. **C2 is still the open item**; section 2a below covers it.
- **The Codex 10-second startup concern goes away**, since `initialize` now takes about 0.2 s.
- **A dependency issue the PR leaves behind.** `src/connector/http.ts`, `register.ts`, `index.ts` and the tests import `@modelcontextprotocol/sdk`, but `package.json` doesn't list it. It arrives transitively through `agents` (1.26.0 in `bun.lock`), so an `agents` upgrade could silently change or drop it. Add it as a direct dependency, or do the migration in 2a.
- **Minor:** `initialize` still advertises `tools.listChanged: true`. A stateless server can never send that notification. It's harmless, but it would be more accurate as `false`.
- **Unchanged:** all the client research, listing paths and decisions D2–D5. D1 (the timing of `/mcp` changes) is partly overtaken, since the biggest change has already shipped during the Claude review. The test matrix (C1) matters more now: it checks #139 against real clients as well as the targets.

## 2a. What full 2026-07-28 compliance takes

> **Status:** implemented in PR #141 (SDK v2, zod 4, both eras, `agents` removed). It is open, not merged. The plan below is kept for reference.

The official TypeScript SDK v2 (`@modelcontextprotocol/server`, 2.0.0 released 2026-07-27, now 2.4.0) has `createMcpHandler(factory)`. It serves 2026-07-28 requests and, by default (`legacy: 'stateless'`), also serves 2025-era requests statelessly, which is exactly what #139 does by hand (P, [SDK migration guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/migration/support-2026-07-28.md); I confirmed `MODERN_PROTOCOL_VERSIONS` and `server/discover` in the 2.4.0 package). The v1 SDK we use (1.26.0, and 1.32.2 latest) tops out at 2025-11-25.

**Work, in order:**

1. **Move to SDK v2.**
   - Add `@modelcontextprotocol/server` as a direct dependency.
   - Replace the transport block in `http.ts` with `createMcpHandler(() => buildServer(env, hooks))`. Keep our own size, batch, CORS and usage hooks around it.
   - Port `register.ts` and both test files to the v2 imports. v2 has a separate client package for the tests.
2. **zod 3 → 4.**
   - SDK v2 needs `zod ^4.2`. We pin `^3.25.76`, and `tools.ts` has about 135 zod calls.
   - Most port unchanged; `z.record` and error customisation are the usual breaks.
   - zod 4 emits JSON Schema 2020-12, so the published input and output schemas may change shape. That makes it a contract change: regenerate the tool docs, and re-check that Claude and ChatGPT still render every tool.
3. **What the SDK should handle for us** (verify each in tests rather than assume):
   - `server/discover`.
   - The `Mcp-Method` / `Mcp-Name` header check with `-32020 HeaderMismatch`.
   - `-32022` for version mismatches.
   - `resultType: "complete"` on every result.
   - `serverInfo` in each result's `_meta`.
   - Dropping `ping` for modern requests.
   - Rejecting batches for modern requests, while legacy requests keep our 10-message limit.
4. **What we must decide or supply:**
   - **`ttlMs` and `cacheScope` on `tools/list`**, which are now required. Use `cacheScope: "public"`, and tie `ttlMs` to deploys (for example a day), since tools only change on deploy.
   - **Tool order:** `tools/list` order SHOULD be deterministic. It already is, from the `CONNECTOR_TOOLS` array.
   - **Don't opt in to `subscriptions/listen`.** We have nothing to notify, and should set `listChanged: false`.
   - **Error codes:** keep tool failures as `isError` results. The `-32000` to `-32019` range stays ours.
5. **Tests:** add 2026-07-28 cases (`server/discover`, a tool call with `_meta`, header mismatch, version mismatch) beside the existing 2025 cases. Then probe production with both a modern and a legacy client before and after.
6. **Out of scope or not applicable:** the auth changes (we have no auth), Tasks, MRTR / elicitation, Roots, Sampling, Logging and the `x-mcp-header` custom headers. We use none of them.

**Cost and risk.**
- **Effort:** about one focused PR. Most of the work is the zod port and re-verifying schemas, not the transport.
- **Risk:** low on the wire, because legacy traffic keeps the same stateless path. Medium on the tool contract, through zod 4's schema output.
- **Fallback:** if the zod port turns out heavy, keep v1 for 2025 traffic and front it with v2's `isLegacyRequest()` plus a modern-only handler (`legacy: 'reject'`). The SDK documents this split. It still needs v2, and zod 4 at least in that module, so check that before choosing it.
- **Timing:** the Claude and ChatGPT reviews will see the schema change, so land it either before you submit to ChatGPT or after both reviews settle. That's your call.

## Summary

- **Per their own docs, almost every target accepts our URL as is.** That covers OpenClaw, Hermes Agent, all three Grok products (the Grok app, Grok Bot and the Grok Build CLI), Gemini, Perplexity, Mistral, the major coding agents and the main self-hosted chat UIs. Each adds a remote Streamable HTTP server by URL with no auth. **None has been tested against our server yet (C1).** If they pass, the work is documentation plus a few listings.
- **Grok Bot's app catalog is the Cursor Marketplace.** So one Cursor plugin would reach both Cursor and Grok Bot users.
- **Publishing to the official MCP Registry** as `com.pokemcp/vgc-teambuilder` is the first listing step. PulseMCP and Glama ingest from it, and GitHub's curated registry requires it. It needs a DNS TXT record that only you can add.
- **Our server is spec-correct but strict.** Three behaviours are worth hardening, in priority order. None is urgent, and each changes `/mcp` while the Claude listing is under review, so the timing is yours to decide.
  1. It speaks only the older, initialize-based MCP revisions. The current spec (2026-07-28) is sessionless. Clients that support both eras fall back to our older handshake; clients that support only the new era will fail.
  2. It returns 406 to any caller that doesn't accept both `application/json` and `text/event-stream`.
  3. It requires `Mcp-Session-Id` on every call after `initialize`.

## 1. Where the server stands (measured)

| Behaviour | Result | Grade |
|---|---|---|
| Transport | Streamable HTTP only; `/sse` returns 410 | M |
| `initialize`, offering 2025-06-18, 2025-11-25 or 2026-07-28 | 200. Negotiates at most 2025-11-25 and returns `mcp-session-id`. About 1–1.8 s from LAX | M |
| POST without both Accept types | 406, from `agents` SDK code, not ours (`agents/dist/mcp/index.js`) | M |
| POST after `initialize` without a session id | 400, `-32000 "Mcp-Session-Id header is required"` | M |
| Sessionless request in the 2026-07-28 style (`Mcp-Method` header, `_meta.protocolVersion`) | Same 400 | M |
| Unknown session id | 404 `-32001`. Per 2025-11-25, clients re-initialize on this | M (via research agent) |
| Response framing | Every POST answers as `text/event-stream`, including single responses | M |
| 400/406 error bodies | JSON, but sent as `content-type: text/plain` | M |
| OAuth discovery (`/.well-known/oauth-*`) | 404. We never return 401, so clients that start OAuth only on a 401 are fine | M |
| CORS | `*`, exposes `mcp-session-id` | M |
| HEAD `/mcp` | 404, which Hermes's preflight check treats as "let the SDK decide" | M, P |

**How the 2026-07-28 fallback works** (P, [versioning spec](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning#backward-compatibility-with-initialization-based-versions)):

- A client that supports both eras sends a modern request first. If the reply is a 4xx "without a recognized modern error body", it falls back to `initialize`. Our 400 qualifies, so these clients work.
- The spec lists a modern-only client against a legacy server as "Fails".
- We don't know which shipping clients are modern-only today (U).
- mcporter (OpenClaw's MCP bridge) and Hermes both document negotiating both eras (P).

## 2. Compatibility work items

| # | Item | Why | Effort | Grade of the need |
|---|---|---|---|---|
| C1 | **Real-client test matrix.** Add the server in each target below and run three prompts: list formats, validate a team, top usage. Record pass, fail and the error. **I can script** the CLI agents (Claude Code, Codex, Gemini CLI, Grok Build, opencode, Goose, Hermes, OpenClaw) and the MCP SDK clients. **You need to run** the account-bound ones: Grok app and Grok Bot, Gemini app, Perplexity, Le Chat, Cursor, VS Code, and the xAI API, which needs an API key | Turns every U below into a fact before we write docs | Half a day | — |
| C2 | **Serve both protocol eras (investigate).** Check whether a newer `agents` SDK or MCP TypeScript SDK v2 can serve 2026-07-28 statelessly alongside `initialize` sessions. The `agents` dependency is pinned `^0.7.5` (0.7.9 installed); npm's latest is 0.33.0, and `@modelcontextprotocol/server` 2.4.0 exists. Whether either supports 2026-07-28 is U | Modern-only clients fail today. This is also the clean fix for C4 | Medium. Touches the `PokemonMCP` Durable Object, `trackSession` analytics and the rate limiter | P (spec), U (which clients) |
| C3 | **Lenient Accept (investigate).** A small wrapper before `PokemonMCP.serve()`: when Accept lacks either type, rewrite it, and if the caller can't take SSE, unwrap the single `data:` event into a plain JSON body. Rewriting the header alone doesn't help, because the SDK still answers in SSE | Custom scripts, gateways, and possibly Mistral (its own troubleshooting `curl` omits Accept). The spec allows the 406; this is tolerance, not a fix | Small | S/U. No named client is confirmed to send a narrow Accept |
| C4 | **Session-optional calls.** Let a call without a session id run statelessly. Every tool is read-only and needs no session state. The SDK already supports this: `createMcpHandler` with no `sessionIdGenerator` skips session validation (P, read in `agents` 0.7.9, the version `bun.lock` resolves). It still enforces the Accept check, so C3 stays separate | Stateless proxies and simple HTTP wrappers. Overlaps C2 | Medium. Moving off `McpAgent.serve` touches the `PokemonMCP` Durable Object, `trackSession` analytics and the rate limiter | U. No named client is known to drop the session |
| C5 | **Correct error content type.** Send 400/406 bodies as `application/json` | Strict clients may reject a JSON body labelled `text/plain` | Trivial, in the same wrapper as C3 | U |

C2–C5 change `/mcp` behaviour while the Claude directory review is open and the ChatGPT submission is being prepared in the other thread. **Recommendation:** run C1 first. Do C3 and C5 only if a real client fails. Do C2 once the Claude review is settled, because it is the change that matters long-term.

## 3. Targets

### OpenClaw: native support, document it now

- **Add:** native Streamable HTTP client (P, [docs.openclaw.ai/tools/mcp](https://docs.openclaw.ai/tools/mcp)).
  ```bash
  openclaw mcp add vgc-teambuilder --url https://api.pokemcp.com/mcp --transport streamable-http
  openclaw mcp doctor vgc-teambuilder --probe
  ```
  Config form: `mcp.servers.vgc-teambuilder = { url, transport: "streamable-http", enabled: true }`. Users can also add it from the Control UI under Settings → MCP.
- **Sessions:** documented. It sends a session DELETE on close and tolerates a server that doesn't confirm it (P).
- **Protocol versions:** mcporter negotiates 2026-07-28 or a legacy revision per server (P). OpenClaw's own native client doesn't state this (U).
- **Listing: ClawHub (skills and plugins).**
  - Publish with `clawhub skill publish`.
  - A skill is a `SKILL.md` with `name`, `description` and `version` frontmatter. It is licensed MIT-0. Publishing needs a GitHub account old enough to pass an upload gate (P).
  - Review is automated: VirusTotal plus metadata-versus-behaviour checks, and reports after publication. No human approves a skill (P).
  - ClawHub had a malware wave in early 2026: Snyk found 76 confirmed malicious payloads in 3,984 skills (P, Snyk/VirusTotal).
  - A skill doesn't register an MCP server by itself. It would be instructions, for example "how to build a VGC team with these tools, and how to add the server".
- **Verdict:**
  - Ready to document once C1 passes.
  - Hold the ClawHub skill until C1 passes and you decide (D3) whether a listing there is worth the association.
  - A useful skill would be a team-building workflow guide that is safe to scan: no binaries, no environment variables.

### Hermes Agent (Nous Research): native support, document it now

- **Add:** `~/.hermes/config.yaml` (P, [MCP config reference](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference)).
  ```yaml
  mcp_servers:
    vgc_teambuilder:
      url: "https://api.pokemcp.com/mcp"
  ```
  The `hermes mcp` CLI, the dashboard and `/reload-mcp` all edit or reload the same block.
- **Transport:** the docs only say "HTTP and SSE". The source code points the same way (P/inferred, [`tools/mcp_tool_transport.py`](https://github.com/NousResearch/hermes-agent/blob/main/tools/mcp_tool_transport.py)):
  - Its module docstring and helper names indicate Streamable HTTP with an SSE fallback, and detection of modern versus legacy servers (`_handshake_rejected_as_modern`). I read the names, not the function bodies.
  - The preflight check, which I did read, sends the correct dual Accept header, and it passes our 404 HEAD response through to the SDK.
- **Auth:** OAuth runs only when `auth: oauth` is set. Leave it unset.
- **Listing:** there is no central hub to submit to. Hermes installs skills from GitHub taps, skills.sh, ClawHub, LobeHub, or any site serving `/.well-known/skills/index.json` (P). Hermes skills follow the agentskills.io format, so the skill we'd write for ClawHub could be the same file.
- **Verdict:** ready to document once C1 passes. Serving a well-known skills index from pokemcp.com is cheap if we write the skill anyway.

### Coding agents: snippets plus install buttons, no server work

All of these take a bare remote URL with no auth (P unless marked). These snippets are the docs content:

| Agent | One-step add | Watch out for |
|---|---|---|
| Claude Code | `claude mcp add --transport http vgc-teambuilder https://api.pokemcp.com/mcp` | In `.mcp.json`, `"type": "http"` is required. Without it, the entry is read as stdio and skipped |
| Codex (CLI, IDE, app) | `codex mcp add vgc-teambuilder --url https://api.pokemcp.com/mcp`, or `[mcp_servers.vgc-teambuilder] url = "…"` in `~/.codex/config.toml` | Default `startup_timeout_sec` is 10 s. Our `initialize` takes about 1–2 s warm; a cold start is U |
| Cursor | `~/.cursor/mcp.json` → `{"mcpServers":{"vgc-teambuilder":{"url":"…"}}}`. Install link: `cursor://anysphere.cursor-deeplink/mcp/install?name=vgc-teambuilder&config=eyJ1cmwiOiJodHRwczovL2FwaS5wb2tlbWNwLmNvbS9tY3AifQ%3D%3D` | Forum reports of the install link breaking. Test it |
| VS Code / GitHub Copilot | `.mcp.json` or `~/.copilot/mcp-config.json` → `{"mcpServers":{"vgc-teambuilder":{"type":"http","url":"…"}}}`. Install link: `vscode:mcp/install?{urlencoded json}` | `.vscode/mcp.json` with `servers` is now deprecated (P, verified). The HTTP payload for the install link is inferred from a stdio example (U) |
| Copilot CLI | `copilot mcp add --transport http vgc-teambuilder https://api.pokemcp.com/mcp` | `/mcp search` reads GitHub's MCP registry |
| Gemini CLI | `gemini mcp add --transport http vgc-teambuilder https://api.pokemcp.com/mcp`, or `{"httpUrl": "…"}` | In Gemini CLI's config, `url` means legacy SSE and fails against us (410). Use `httpUrl` |
| Grok Build | `grok mcp add --transport http vgc-teambuilder https://api.pokemcp.com/mcp` | Also picks up Claude Code and Cursor configs automatically |
| Cline | `{"type":"streamableHttp","url":"…"}` | If `type` is omitted it defaults to SSE and fails |
| Kiro | Link: `https://kiro.dev/launch/mcp/add?name=vgc-teambuilder&config=…`, with Kiro's own badge | — |
| Zed, JetBrains AI/Junie, Amp, opencode, Devin Desktop (formerly Windsurf) | Bare `url` entry. For opencode use `"type":"remote","oauth":false` | opencode turns on OAuth by default. Amp's only example is an SSE URL (U). The key names for Devin Desktop are U |
| Roo Code | — | Shut down 2026-05-15. Leave it out |

- **Packaging (later):**
  - **Claude Code plugin marketplace:** a repo containing `.claude-plugin/marketplace.json` and a plugin whose `.mcp.json` has the entry above.
  - **Gemini CLI extensions gallery:** a public repo with `gemini-extension.json` and the GitHub topic `gemini-cli-extension`. It is auto-indexed daily.
  - **Cursor Marketplace:** plugins, submitted at cursor.com/marketplace/publish.
  - Each is a small repo. Treat them as phase 3. Snippets already cover the install path.

### Grok (xAI): three products, all take a URL

xAI has three products that can use our server. "grok bit" in the request most likely means **Grok Bot**, so all three are covered.

**Grok Bot**: xAI's desktop and mobile agent, which runs on Cursor accounts.
- **Add:** in the desktop app, Connect apps → **Add a custom connector** → Type **Remote HTTPS** → Server URL → **Add plugin**. Users can also ask the Bot "add this MCP server: https://api.pokemcp.com/mcp" (P, [docs.x.ai/grok-bot/computer-and-apps](https://docs.x.ai/grok-bot/computer-and-apps)).
- **Who:** paid Cursor plans, or a linked SuperGrok / SuperGrok Plus / Heavy / X Premium+ subscription, or a Grok Business seat (P, [get-started](https://docs.x.ai/grok-bot/get-started)). A team's Cursor MCP policy can block custom servers.
- **Listing:** Grok Bot's "Browse all apps" link points to **cursor.com/marketplace**, and its team controls are Cursor's Plugins & MCPs page (P). So a Cursor Marketplace plugin (section 4, L2b) should appear in Grok Bot's catalog. That last step is inferred, not confirmed.
- Bot templates on x.ai/bot/marketplace are shareable Bots, not tool listings. One option is to publish a "VGC team coach" Bot template that has our connector attached (U: whether a template carries custom connectors).

**Grok Build**: xAI's coding CLI.
- `grok mcp add --transport http vgc-teambuilder https://api.pokemcp.com/mcp`, or `[mcp_servers.vgc-teambuilder] url = "…"` in `~/.grok/config.toml` (P, [MCP servers](https://docs.x.ai/build/features/mcp-servers)).
- It also reads `~/.claude.json`, `.cursor/mcp.json` and `.mcp.json`, so users who already added us to Claude Code or Cursor get it for free (P).
- It supports plugins and marketplaces, which is a phase 3 option.

**Grok app** (grok.com, X, mobile):
- **Add:** grok.com/connectors → New Connector → Custom → server URL → "complete any required authentication" (P, [docs.x.ai/grok/connectors](https://docs.x.ai/grok/connectors)). Mobile has it under Settings → Connectors. Launched 2026-05-06 as "Bring Your Own MCP" (P). grok.com/connectors → New Connector → Custom → server URL → "complete any required authentication" (P, [docs.x.ai/grok/connectors](https://docs.x.ai/grok/connectors)). Mobile has it under Settings → Connectors. Launched 2026-05-06 as "Bring Your Own MCP" (P).
  - **Who can add one:** xAI's page doesn't say which plans. One third-party guide says paid plans only (S/U).
  - **Business and Enterprise:** an admin provisions connectors (S).
- **Directory:** the catalog holds OAuth connectors from large companies (Box, Notion, Linear…). There is no public submission process; one guide says to contact xAI (S). **Treat it as no listing path for now.**
- **xAI API:** a Responses API tool `{"type":"mcp","server_url":"https://api.pokemcp.com/mcp","server_label":"vgc_teambuilder"}` (P, [remote MCP docs](https://docs.x.ai/developers/tools/remote-mcp)). xAI's servers make the calls; whether they carry the session id and send the right Accept is undocumented (U). This is the call most likely to expose C3 and C4, so include it in C1.
- **Verdict:** write one "Grok" docs section covering the app, Grok Bot and Grok Build, once C1 passes on each. The Cursor plugin is the listing path for Grok Bot.

### Other consumer assistants

| Assistant | User-added server | Listing path | Grade | Verdict |
|---|---|---|---|---|
| Gemini app | Yes. US, 18+, personal accounts only, web app only. Settings → Connected Apps → Custom apps → URL | **Google Connected Apps Platform** preview: apply, test in Gemini Developer Mode, submit for review | P (app page verified). Authless support U | Document after C1. Apply to the preview: it is the only documented consumer directory outside Claude and ChatGPT |
| Perplexity | Yes. Add custom → Remote; Auth: None; Transport: Streamable HTTP. Org members need an admin toggle | None public | P (help centre) | Document |
| Mistral Le Chat | Yes, by the workspace admin (on personal plans, the account owner). Auth auto-detected | Curated; no public form (S) | P / S | Document. Include it in C1 because of the Accept question |
| Microsoft Copilot | Consumer: no evidence. Copilot Studio: makers only, Streamable HTTP, "None" auth | Enterprise only | P / U | Skip for now |
| Manus, Raycast | Yes, by URL | Raycast suggests popular servers; how a server gets listed is U | P | One line each in a table |
| Meta (Muse), DeepSeek, Siri | No documented MCP URL field | — | S / U | Skip |
| Alexa+ | Developer add-on toolkit with certification | Certification | P | Skip. A voice interface doesn't fit team-building |

### Self-hosted chat UIs and agent frameworks (one table in the docs)

| Client | Add | Note | Grade |
|---|---|---|---|
| Goose | `type: streamable_http`, `uri: …`. Deeplink `goose://extension?url=…&type=streamable_http&id=…&name=…` | Good candidate for an install button | P |
| Open WebUI | Admin → Integrations → External Tool Servers → "MCP (Streamable HTTP)", Auth None | Admin only. Picking the OpenAPI type instead causes a known UI bug | P |
| LibreChat | `librechat.yaml` → `type: streamable-http` | Restart required | P |
| LM Studio | `mcp.json` `{"url": …}`, plus an "Add to LM Studio" link generator | — | P |
| AnythingLLM | `type: "streamable"` | An open issue reports failures with Streamable HTTP servers. Include it in C1 | P / U |
| n8n | The MCP Client node takes an endpoint URL | The tool node's docs page shows SSE only. Include it in C1 | U |

## 4. Listings, in order

| # | Where | Reaches | What it takes | Who |
|---|---|---|---|---|
| L1 | **Official MCP Registry**, `com.pokemcp/vgc-teambuilder` | PulseMCP (auto-ingests; manual submissions are paused), Glama, and the prerequisite for L2. Whether VS Code's `vscode:mcp/by-name/…` gallery reads it directly is U | A `server.json` with `remotes: [{type: "streamable-http", url}]`. `mcp-publisher login dns`, which needs an Ed25519 TXT record on the apex `pokemcp.com`. HTTP auth won't work because the apex has no A record. Use `openssl@3` from Homebrew; macOS LibreSSL lacks Ed25519 | I write `server.json`; **you** add the TXT record and run `publish` |
| L2 | GitHub MCP Registry | Copilot CLI `/mcp search`, possibly VS Code | After L1, post a request in `github/github-mcp-server` discussion #1257. Curated by hand and slow | You (from your GitHub account) |
| L2b | **Cursor Marketplace plugin** | Cursor users, and Grok Bot's app catalog (which links to it, so inferred) | A small public repo with the Cursor plugin manifest and `.mcp.json` holding the URL; submit at cursor.com/marketplace/publish. Review process is U | I build the repo; **you** submit it |
| L3 | Glama connectors, "Hosted endpoint" tab | Glama directory, health checks, quality score | Name, description, URL. Glama runs initialize and lists tools but never calls them | You or me |
| L4 | Google Connected Apps preview | Gemini app directory | Apply at connected.google.com, then review. Whether an authless server is accepted is U | **You** |
| L5 | Docker MCP Catalog | Docker Desktop MCP Toolkit | A PR to `docker/mcp-registry` with a `server.yaml` of `type: remote` | I draft; you open the PR |
| L6 | mcp.so | Directory | Submit the URL | Either of us |
| — | ClawHub, Hermes well-known index, Claude/Gemini/Cursor plugin repos | The respective agents | One shared agentskills.io `SKILL.md`, plus thin plugin repos | Phase 3, after D3 |
| — | Smithery, PulseMCP direct, Grok, Mistral, Perplexity catalogs | — | No working public path today | Skip |

## 5. Documentation plan (apps/docs)

The docs site has one "Connect" page today (`getting-started.mdx`), and the other thread is working on it. Proposal:

- `connect/index`: the server URL, what "remote MCP, no sign-in" means, and a picker that links to the pages below.
- `connect/claude-chatgpt`: owned by the other thread.
- `connect/assistants`: Grok (the app and Grok Bot), Gemini, Perplexity, Le Chat. Short steps each, written in the vendor's own UI wording.
- `connect/coding-agents`: the table from section 3, with an install button wherever a deeplink exists (Cursor, VS Code, Kiro, Goose, LM Studio). Add a "transport gotchas" callout for Claude Code `type`, Gemini CLI `httpUrl`, Cline `type` and opencode `oauth:false`.
- `connect/agents`: OpenClaw, Hermes, then a self-hosted table (Goose, Open WebUI, LibreChat, LM Studio, AnythingLLM).
- `connect/developers`: a raw protocol summary (Streamable HTTP, sessions, Accept, versions), the xAI and Gemini API tool snippets, and the `server.json` registry entry.
- A **troubleshooting** block on every page, keyed to the actual errors: 406, 410 on `/sse`, 400 session required.
- Only publish a snippet once C1 has passed it. Mark the others "untested".

## 6. Phases

1. **Verify (no deploy).** C1 test matrix across OpenClaw, Hermes, Grok (app, Grok Bot, Grok Build, API), Gemini app, Perplexity, Le Chat, Claude Code, Codex, Cursor, VS Code, Gemini CLI, Cline, Goose and Open WebUI.
2. **List and document.**
   - L1 registry, then L2, L2b (Cursor plugin, which also covers Grok Bot) and L3.
   - Docs pages for whatever passed C1.
   - Apply to L4 in parallel.
3. **Harden and package.**
   - C2 (both protocol eras), once the Claude review is settled.
   - C3 and C5 only if C1 found a failure.
   - The shared skill and plugin repos, if D3 says go.

## 7. Decisions for you

- **D1. Timing of `/mcp` changes (C2–C5).** Hold them until the Claude review is settled, or go ahead? Recommendation: hold, and do C1 first.
- **D2. Registry namespace.** `com.pokemcp/vgc-teambuilder` with a DNS TXT record (recommended), or `io.github.<you>/…` with only a GitHub login.
- **D3. Skills and plugin listings** on ClawHub, the Hermes index and the Claude/Gemini/Cursor marketplaces. Each is small work, but adds a repo to maintain. ClawHub also carries a reputation risk.
- **D4. Google Connected Apps preview.** Applying is yours: it needs your Google identity. It is the one consumer directory with a documented process.
- **D5. Version tracking.** The registry `version` and the listing copy name a regulation and monthly figures, so they go stale. Decide whether `server.json` stays generic (recommended) or tracks the regulation.

## Sources

The main pages are linked inline above. Full research notes, with a URL per claim, came from three research passes on 2026-11-12. These were re-checked directly:

- Grok connectors page
- Gemini custom apps help page
- OpenClaw MCP docs
- Hermes transport source
- VS Code MCP configuration reference
- The MCP 2026-07-28 versioning spec
