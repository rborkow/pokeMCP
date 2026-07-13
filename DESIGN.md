---
name: PokeMCP Prep
description: A calm tournament newsroom that resolves into a practical coaching brief.
colors:
  canvas: "#11161f"
  panel: "#171e29"
  inset: "#1d2632"
  ink: "#f1eee8"
  muted-ink: "#b5bdc9"
  regulation-blue: "#7398bd"
  favorable-sage: "#8eae99"
  risk-rust: "#c4816f"
  evidence-ochre: "#cbb477"
  hairline: "#35404e"
typography:
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.15
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.regulation-blue}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
---

# Design System: PokeMCP Prep

## Overview

**Creative North Star: "The Match Desk"**

The interface feels like a softly lit analysis desk used before a tournament set: quiet enough for
concentration, dense enough to reward study, and clear about where every conclusion came from. The
newsroom introduces the field; completed preparation settles into a more focused coaching brief.

Key characteristics are editorial hierarchy, restrained containers, readable team sheets, local
evidence labels, and familiar product controls. It explicitly rejects RPG ornament, neon esports
graphics, and generic AI-chat framing.

## Colors

The dark blue-gray base reduces glare while warm ink and four named role colors keep evidence and
decisions legible.

- **Midnight canvas** (`#11161f`): application background.
- **Desk panel** (`#171e29`) and **inset slate** (`#1d2632`): structural layers.
- **Warm ink** (`#f1eee8`) and **muted ink** (`#b5bdc9`): primary and supporting text.
- **Regulation blue** (`#7398bd`): primary actions and active navigation only.
- **Favorable sage** (`#8eae99`): supported advantages and completion.
- **Risk rust** (`#c4816f`): danger points and destructive actions.
- **Evidence ochre** (`#cbb477`): source and beta-mechanics labels.

The role colors must always appear with text or an icon; color alone never communicates state.

## Typography

**Display Font:** Geist (system sans fallback)
**Body Font:** Geist (system sans fallback)
**Label/Mono Font:** Geist Mono (system monospace fallback)

One family keeps the tool calm and familiar. Headings use weight and spacing rather than a themed
display face. Body prose is capped near 70 characters; tables and team sheets may run denser.

- **Headline:** 650 weight, 2rem, 1.15 line-height.
- **Title:** 620 weight, 1.25rem, 1.25 line-height.
- **Body:** 400 weight, 1rem, 1.6 line-height.
- **Label:** 550 weight, 0.75rem, 0.02em tracking; sentence case by default.

## Elevation

The system is flat by default. Depth comes from tonal layering and hairline borders. Shadows appear
only for floating menus, dialogs, and clear hover elevation; content sections do not glow.

## Components

### Buttons

- Six-pixel corners, compact text labels, and a consistent 10px by 16px hit area.
- Primary actions use regulation blue with dark ink; secondary actions use a bordered desk panel.
- Hover changes tone, active compresses by one pixel, and focus uses a two-pixel blue outline.

### Chips

- Use chips only for regulation, evidence kind, beta mechanics, or a selected filter.
- Keep labels sentence case and pair semantic color with an icon or explicit wording.

### Cards / Containers

- Prefer open editorial sections separated by rules.
- Use bordered containers only when grouping a selectable team, an interactive plan, or saved data.
- Never nest decorative cards.

### Inputs / Fields

- Use inset slate, a one-pixel hairline, six-pixel corners, and persistent visible labels.
- Focus changes the border and adds a two-pixel outline; errors use rust text plus an explanation.

### Navigation

- A stable top bar contains the product name and text-labeled destinations.
- On narrow screens it wraps into a compact second row instead of hiding primary destinations
  behind unlabeled icon buttons.

## Do's and Don'ts

### Do:

- **Do** show source, date, evidence kind, and beta limitations beside the affected information.
- **Do** use whitespace and dividers to create hierarchy before adding containers.
- **Do** preserve a consistent button, field, table, and team-sheet vocabulary across routes.
- **Do** keep motion between 150–250ms and use it only to explain state changes.

### Don't:

- **Don't** resemble an RPG quest log, neon esports HUD, generic AI terminal, or fantasy battle
  screen.
- **Don't** use giant versus treatments, glowing containers, fake win probabilities, or unexplained
  model confidence.
- **Don't** use gradients on text, decorative glassmorphism, colored side stripes, or nested cards.
- **Don't** make sourced facts, deterministic calculations, and AI suggestions look equivalent.
