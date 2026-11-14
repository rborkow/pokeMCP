## What and why

<!-- What changes, and the problem it solves. Link the issue or finding if there is one. -->

## How it was verified

<!-- Commands run and their results, or what you checked by hand. -->

- [ ] `bun run test` (Worker), and `bun run test:run` in `apps/teambuilder` if the site changed
- [ ] Connector tool changed: `src/__tests__/connector.test.ts` covers it and `bun run generate-tool-docs` was re-run

## Review

See [REVIEW.md](https://github.com/rborkow/pokeMCP/blob/main/REVIEW.md) for the checklist and the list of sensitive paths.

- [ ] Touches a sensitive path: `/security-review` and `/codex:adversarial-review --base main` were run. Findings are fixed or noted below
- [ ] Third-party or LLM text written into MDX is escaped
- [ ] No workflow step exposes a secret to code built from a PR branch or third-party data
- [ ] Generated content (reports, tournament data) was reviewed in full, tables included

<!-- Findings left open, and why: -->
