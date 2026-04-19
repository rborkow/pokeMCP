# PokeMCP Design Direction

*Working design brief · April 18, 2026*

## Thesis

PokeMCP's differentiator is not that it's a team builder with an AI helper — it's that AI is present at every moment of the build loop, from conception through match prep. The current product buries this in a bottom-right chat panel while six empty "Add Pokemon · Click to browse" cards dominate the screen. The paradigm needs to invert: **chat is the surface, the team is the artifact**, same mental model as Cursor (chat + code), Claude Artifacts (chat + artifact), or v0 (chat + UI). This document captures the direction for the landing page, the onboarding flow, and the app refactor that follows from that inversion.

## Competitive landscape

Four reference points defined the category read:

**NCP (Nimbasa City Post)** is the long-running community reference calc maintained by Alex Collins, descended from the squirrelboy/Tapin/Firestorm lineage. No landing page, dense old-school UI, but carries enormous credibility through provenance. Its moat is trust in the math, not UX polish.

**Porygon Labs** is the sophisticated modern calc. No landing page either — drops straight into a three-panel power tool (My Team | Damage Calc | Opponent Team) with regulation switcher, weather/terrain/screens field state, Stat Explorer, Damage Explorer, Move Explorer. Active development signaled loudly via visible version badge (v1.2.13) and full changelog. Its moat is depth + trust.

**ChampTeams.gg** is the only competitor with a real landing page, and it's well-executed. Hero with specific job-to-be-done framing ("all-in-one VGC team hub"), four feature sections each with screenshot carousels, a "second screen while you play" use-case framing that gives the tool a concrete job, and explicit credibility credits (built on `@smogon/calc`). Its moat is the all-in-one positioning and community/creator teams.

**Pikalytics** owns usage data and the meta dashboard. Calc is secondary; the value is knowing what's being played.

None of these have an AI angle. That's the space.

## Current state and gap

The current PokeMCP app lands users into an empty grid with six "Add Pokemon · Click to browse" slots. The Professor Kukui chat lives in the bottom-right corner with roughly 15% of screen real estate. Analysis tabs (Coverage/Threats/Speed/History) compete with the chat for the bottom strip. There is no landing page — the URL drops users directly into the tool.

The product is telling users the grid is primary and the AI is a helper. The actual strategic positioning is the opposite. Everything flows from closing that gap.

## Strategic decisions

- **Retire the Professor Kukui persona.** The branded-mentor framing borrows equity from another IP and lightly undermines the precision signal needed to compete with Porygon Labs and NCP. Replace with neutral "Coach" language.
- **Position around "AI throughout the build loop,"** not "AI for cold start." Cold start is a hurdle, but the differentiator is that the coach is present during refinement and match prep as well.
- **Chat-first paradigm.** Chat becomes the primary surface. The team grid becomes a state panel that reflects what conversation has produced.
- **Keep a Grid mode for power users.** Mode toggle in the header: Chat (default) / Grid. Acknowledges and serves users who know exactly what they want and don't need conversation.
- **LLM-driven interview for onboarding,** with hybrid architecture (see Onboarding section).
- **Lean into the MCP architecture story** in developer-facing copy. It's a genuine technical moat and matches the protocol's design intent.

## Landing page direction

### Positioning

Headline: *"A coach for the whole build — not just the first click."*

Subhead: *"Interview to start. Iterate in natural language. Walk into the match with a plan. The AI shows up at every step of the build loop, not just the blank canvas."*

This headline deliberately picks a fight. It calls out the category's assumption that AI tools are just team generators and asserts PokeMCP's claim to the broader territory. If the positioning ever softens to something like "AI-assisted team building for Champions," the punch is lost and PokeMCP becomes indistinguishable from a potential ChampTeams feature release.

### Structure (top to bottom)

1. **Status bar** (monospace). `LIVE / REG M-A + GEN 9 OU / AI-NATIVE / v0.x · updated [date]`. Borrow the ChampTeams pattern but use the version/date slot as a live-maintenance signal, which Porygon Labs does well and no other competitor does.
2. **Hero headline + subhead + three CTAs.** Primary: "Start the interview." Secondary: "Import from Showdown." Tertiary: "Open empty builder." These three options must mirror the in-app empty state exactly.
3. **Interview demo block.** Shows the interview mid-flow (step 2 of 4) with progress indicator, previous answer chip, current question, and mixed input types (choice cards + free-text). The demo itself is the pitch — describing "guided onboarding" is much weaker than showing it.
4. **Three-moment feature sequence.** Labeled 01 Conception / 02 Refinement / 03 Match Prep. The numbering reinforces "throughout the loop" visually. Each card eventually expands into its own page as content grows.
5. **Trust-chip row.** Live meta data, Showdown native paste, threat matrix + speed tiers. These are table stakes — they live as small signals, not as competing feature sections.
6. **Developer footer band.** "Built on Model Context Protocol. Point your own agent at the data." With docs/api/github links. Small, quiet, but present.

### What's deliberately excluded

- **Battle companion / second-screen framing.** ChampTeams owns this. Competing on it splits the PokeMCP message.
- **Content creator teams section.** Strong cold-start tool for ChampTeams but dilutes the AI-first story here.
- **Pricing/plan language.** If free forever, a single line somewhere. Otherwise defer.

## Onboarding: LLM-driven interview

The interview replaces the current blank-team modal entirely. Four questions, adaptive, ~30 seconds, skip anytime. The interview is also the onboarding *to the AI itself* — it teaches the value prop by demonstration rather than description.

### Design principles

- **Fixed horizon.** "4 questions · ~30 seconds · skip anytime" as visible microcopy. Interviews fail when users fear open-ended commitment. Always show the end.
- **Progress bar with concrete steps.** Step 2 of 4, with a horizontal pill row showing which are done.
- **Previous answers persist as collapsed chips.** Trains users that answers stick and enables edit-in-place without a separate "back" button.
- **Adaptive routing promised in copy.** "I'll adapt the next question based on your answer." Users need to believe this is why the interview beats a form.
- **Mixed input types in the same step.** Choice cards plus free-text box. Structured where structure helps, open where it doesn't. Pure-chat feels slow; pure-form feels like TurboTax.
- **Visible escape hatch.** `esc to exit` in monospace. Reduces commitment anxiety for power users.

### Recommended architecture (hybrid)

- **Hand-authored outer loop.** Four fixed question topics: format, starting point, playstyle/constraints, preferences. Guaranteed completion, guaranteed data collection, never stalls.
- **LLM inside each question.** Free-text handled conversationally, intelligent interpretation of ambiguous answers, adaptive follow-ups within the topic.
- **LLM for the output synthesis.** Team + reasoning + what was considered and skipped. This is where the "model intelligence" shows up visibly.

This gets the magic of conversational UX without the "interview wandered off-topic" failure mode. The LLM's job is understanding and generating, not steering.

### Open question

Whether the interview can also be entered *later* as a "re-brief" when scrapping a team mid-build. ("I want to try something different — re-do the interview but keep Ursaluna.") Worth prototyping once the linear flow is working.

## App refactor: chat-first architecture

### Layout

Roughly 60/40 split: chat panel on the left as the primary surface, team state panel on the right as the artifact view.

- **Left (chat, ~60%).** Scrolling conversation with coach messages that include inline data cards (matchup summaries, benchmark tables, stat spreads), team diffs, and reasoning. Input at bottom with quick-action chips above it that change based on team state.
- **Right (team state, ~40%).** Six compact cards in 2×3 or 3×2, each showing Pokemon name + primary role/item. Full details expand on hover/click. Below the cards: a compact analysis strip (type coverage, speed shape, open threats) that always reflects current team state.
- **Top bar.** Format selector, import/export, and the Chat/Grid mode toggle.

### Key patterns

**Visible team diffs on chat-driven changes.** When the coach swaps Rillaboom for Scizor, the corresponding team slot must show a `NEW` flag and animate in. This is the load-bearing feedback loop for the whole paradigm. Cursor, v0, and Claude Artifacts all live or die on this loop. Without it, users can't trust that conversation is actually doing anything.

**Two-way editing.** Manual edits flow *into* the conversation. Click a team slot → edit it manually → the coach logs "You changed Kingambit's item to Black Glasses" as a message, and can comment ("want me to re-check the Ting-Lu matchup with the BP boost?"). This keeps the conversation as the single source of truth about what happened and why, and prevents users from feeling like they're working in two separate places.

**Quick-action chips change with team state.** 
- Empty team: "Generate a team", "Import from Showdown", "Ask me anything"
- Full team: "Check vs meta", "Tune spreads", "Match prep"
- Mid-swap: "Continue swap", "Show the matchup", "Revert"

Everything is a message, nothing is a distinct feature — the surface stays small and contextual.

**Response taxonomy.** The coach has several response types, and the app should treat them as distinct components:
- Plain message (no additional UI)
- With data card (structured facts: win rate, benchmark, spread)
- With team diff (slot added, swapped, removed)
- With matchup view (richer inline component for vs-opponent analysis)
- With analysis highlight (triggers the right-panel analysis strip to expand)

Designing these as a fixed taxonomy makes the coach's output predictable, implementable, and visually varied.

### Empty state

No six empty slots. When there's no team, the chat panel takes the full canvas and the interview runs there with room to breathe. As answers land and Pokémon start arriving, the team panel slides in from the right. That transition — full-screen chat → split-pane with team — is the moment users understand how the tool works. It's worth investing in.

### Mode toggle

Chat (default) vs. Grid (classic builder). Don't kill Grid mode — power users, tournament-prep rituals, and "I know exactly what I want" flows will always exist. But default new users to Chat. If the coach is good enough, most sessions stay in Chat; the 20% of users who'd bounce from a forced-chat experience get served anyway.

## Architecture: MCP end-to-end

The chat becomes the orchestration layer. Team state lives in a single store. The coach reads and writes via tool calls. Analysis panels subscribe to state.

This aligns the product architecture with the protocol underneath it. The story becomes: *"PokeMCP uses MCP end-to-end — the coach you talk to is the same one you can call from your own agent."* That's a much stronger developer narrative than "we have an API."

Concrete implications:
- Tool calls already work in the current implementation; the UX just obscures them.
- The refactor surfaces what the architecture already supports.
- Feature parity between "use the hosted coach" and "wire your own agent to the MCP server" becomes the long-term positioning.

## Retired

**Professor Kukui** is out. Replaced with neutral "Coach" language throughout. Decision can be revisited after testing, but the default for the refactor is to remove the persona.

## Open questions

1. **Interview depth.** Four questions is a good floor. Serious players may want 8–10 (tera types, tempo preference, legendary restrictions, spread philosophy). Consider "quick/thorough" toggle or "keep going or build now?" exit ramp after question 4.
2. **Interview as viral surface.** If the interview produces a shareable Showdown paste, there's a natural loop — "I asked PokeMCP for a TR team and got this, what do you think?" becomes content. Gets you community-teams value without needing to build a community tab.
3. **Match prep as separate entry point.** Once built, a `/prep` route for "paste an opposing team, get a game plan" could have its own hero treatment. Someone scouting a round-robin opponent doesn't want to sit through the interview.
4. **Transition animations.** Empty → split-pane, slot-swap, coach typing — all need motion design to sell the chat-first paradigm. Ownerless right now.
5. **Consumer vs. developer product split.** The dev/MCP band may eventually deserve its own landing at `pokemcp.com/developers`. Worth deciding when the consumer landing is live.
6. **Re-brief mid-build.** Whether interview can be re-entered later to pivot teams while preserving decisions.

## Next steps

In priority order based on current state:

1. **Build the landing page.** Everything else is architectural; this is the immediate acquisition surface and forces positioning clarity.
2. **Refactor the app to chat-first.** Reorganize existing components (builder, chat, analysis) around the new layout. Keep Grid mode intact as escape hatch.
3. **Build the LLM-driven interview.** Hand-authored outer loop, LLM inside each question, LLM for synthesis. Start with 4 fixed topics.
4. **Implement two-way editing.** Manual changes become chat messages. Prevents the "two separate tools" feeling.
5. **Design the coach response taxonomy.** Build it as a fixed component set so the coach's output is predictable and visually structured.
6. **Add version/changelog visibility.** Small lift, large credibility return. Copy the Porygon Labs pattern.
7. **Prototype match prep as a first-class feature.** This is the unclaimed territory in the category. Paste opponent team → game plan. No one else is building this.

## Reference artifacts

Three mocks produced during this discussion, exported as standalone HTML files alongside this brief. Each is self-contained and renders in any browser; all three support light and dark mode via `prefers-color-scheme`.

1. `pokemcp-landing-v1.html` — initial positioning exploration ("The VGC team builder that actually builds the team"). Chat-prompt demo block with a six-Pokemon TR team output. Kept for historical context; superseded by v2.
2. `pokemcp-landing-v2.html` — revised positioning ("A coach for the whole build"), interview demo replacing the chat-prompt demo, three-moment feature sequence (01 Conception → 02 Refinement → 03 Match Prep), trust-chip row. This is the current landing direction.
3. `pokemcp-app-refactor.html` — chat-first app view with left-side chat (~60%), right-side team state (~40%), inline team-diff indicator ("NEW · slot 4") when the coach makes changes, Chat/Grid mode toggle in the header, and a compact analysis strip below the team cards. This is the target app refactor.

Visual direction: flat, neutral palette, monospace for dev/technical signals, sentence case, no gradients or decorative effects. Borrow the professional vibe from Porygon Labs rather than the consumer-game aesthetic.
