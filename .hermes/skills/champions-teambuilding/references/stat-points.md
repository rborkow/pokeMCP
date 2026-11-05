# Stat Points in Pokémon Champions

Champions has no EVs and no IVs. Each Pokémon gets **Stat Points**: 0–32 per stat, **66 total**,
at level 50. Hidden IVs are fixed at 31, so Showdown/@smogon/calc encode Stat Points in the EV
slot — a paste line `EVs: 32 HP / 32 Atk / 2 Def` means 32/32/2 Stat Points.

## Formulas (level 50)

- HP = base + SP + 75
- Other stats = base + SP + 20, then multiplied by the nature (0.9 / 1.0 / 1.1), floored

`calc_stats` (and `validate_team`'s 66/32 rule check) implement exactly this — it is ground truth;
don't compute stat lines by hand.

## Spread notation

Tool output uses `Nature:HP/Atk/Def/SpA/SpD/Spe` for Stat Point spreads, e.g.
`Adamant:32/32/2/0/0/0`. The structured `statPoints` arg takes `{hp, atk, def, spa, spd, spe}`
(integers 0–32, sum ≤ 66).

## Common shapes

- **32/32/2** — two maxed stats + 2 leftover (typical attacker: 32 Atk / 32 Spe / 2 HP).
- **32/32 bulk** — 32 HP / 32 Def (or SpD) + remainder to a third stat.
- Leftover points go wherever the marginal point matters (often HP for odd-number bulk, or Speed
  to hit a tier).
