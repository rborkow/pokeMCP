# Champions memory work

## Done
- CM-MEM-01 — durable simulation recording, replay/comparison tools, evidence-linked findings, workflow documentation.
- CM-MEM-02 — independent review plus orchestrator corrections: required fingerprints, compiled data/lib and glue identity, valid-checksum semantic regression tests, seed/count consistency, regulation enforcement and working finding revisions, isolated test storage, legality-checked two-process stdio smoke.

## Verification
- Package suite: 75 passing, 0 failing.
- Public MCP smoke: legal six-Pokémon fixture, matchup and evaluation recorded in process A, both replayed with full deterministic result comparison in process B, finding readback. Passed.
- Full package TypeScript check now passes; the unrelated probe scripts are no longer present.
- Release verification also passed the two-process MCP smoke using Hermes's configured Bun executable. Hermes `mcp test champions` connects and discovers all 19 tools.

## Limits
- Deployment is local stdio MCP, not the Cloudflare website. Hermes configuration explicitly pins the existing package memory directory and a 600-second tool timeout. No unrelated cloud services changed.
- Historical runtimes are not automatically restored; drift blocks verified replay.
- Tests cover pool-identity independence, not replacement of the user's live pool file.
- Findings are manually authored hypotheses/evidence, not automatic strategic conclusions. Raw runs are gitignored; back up `packages/champions-mcp/data/experiment-memory`.
- Replay/evidence format is schema 2; provisional schema-1 artifacts produce explicit warnings, not silent migration.
- Unit simulations use the legacy non-legality fixture; public smoke replaces Incineroar Knock Off with validated Darkest Lariat.

Existing unrelated scripts/plans preserved. Worker handoffs are historical; this board records the orchestrator-verified scope.
