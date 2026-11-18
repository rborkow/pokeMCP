# MCP Apps views

Interactive HTML that MCP Apps hosts (Claude, ChatGPT, VS Code and others) render beside a
connector tool's result. The Worker serves each view as a `ui://` resource; this package only
builds them. The design and the phase plan are in the "MCP Apps phase: design and scope" doc.

```
src/shared/          useMcpApp (connect to the host, receive the tool result, apply host theme),
                     base.css (host CSS variables with light/dark fallbacks)
src/views/<name>/    one view: index.html + main.tsx (host wiring) + a pure component + its CSS,
                     a fixture (a real tool result) and tests
src/preview/         renders components with fixtures, no host: `bun run preview`, then
                     http://localhost:5180/preview.html?view=type-chart&theme=dark
build.ts             builds every view to one HTML file and writes src/connector/views/view-html.ts
```

- `bun run build` (or `bun run build:views` from the repo root) typechecks, builds and rewrites
  the generated module. Commit it with the view change; CI fails when it is stale.
- Preact, not React: the same API at a fraction of the size. About 65 KB gzipped of every view is
  the MCP Apps SDK runtime; `build.ts` fails a view over 100 KB gzipped.
- A view renders from its tool's `structuredContent` only and never fetches data on load. The
  tool's output schema in `src/connector/tools.ts` is the view's contract.
- Render text through Preact only. No `innerHTML`, `dangerouslySetInnerHTML`, `insertAdjacentHTML`
  or `document.write`: results echo user-typed names. Every view has a test that feeds it markup.
- Load nothing from another origin. Scripts and styles are inlined by `vite-plugin-singlefile`,
  and the resource's CSP lists are empty.
- Style with the host's CSS variables (`--color-text-primary`, `--color-background-danger`, ...).
  Every state reads in words as well as colour (DESIGN.md).
- Check both themes at a chat-column width (about 700 px) before committing: the preview page plus
  a Playwright screenshot is enough.

## Adding a view

1. Add `src/views/<name>/` (copy `type-chart/`), a fixture from a real tool result, and tests.
2. Add its title and description to `VIEW_INFO` in `src/connector/views/index.ts`, and set
   `view: "<name>"` on the tool in `src/connector/tools.ts`.
3. `bun run build`, then `bun run test` at the repo root (`mcp-http.test.ts` covers the wiring).
4. Try it in a real host against staging, where `MCP_APPS` is "on".
