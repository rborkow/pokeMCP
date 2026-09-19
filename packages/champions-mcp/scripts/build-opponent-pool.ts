/**
 * Build the Reg M-C opponent pool for `evaluate_team`:
 * top-cut teams from the cached tournament events, with Stat Points and
 * natures imputed from the latest ladder usage (Reg M-C first, then M-B),
 * falling back to a neutral defensive spread when no data exists.
 *
 * Output: data/opponents/regmc.json — [{ source, sets: PokemonSet[] }]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { championsDex } from "../src/showdown.js";
import type { PokemonSet } from "../src/team.js";
import { loadEvents } from "../src/tournaments.js";
import { latestUsage, loadUsageFromDir, topSpreads } from "../src/usage.js";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "data", "opponents", "regmc.json");
const STAT_KEYS = ["hp", "atk", "def", "spa", "spd", "spe"] as const;

/** Limitless team-sheet display names that differ from the Showdown dex name. */
const SPECIES_ALIASES: Record<string, string> = {
    "Eternal Flower Floette": "Floette-Eternal",
};

interface Spread {
    nature: string;
    evs: Record<(typeof STAT_KEYS)[number], number>;
}

/** Parse a ladder spread string ('Adamant:32/32/0/0/2/0') into nature + Stat Points. */
function parseSpread(spread: string): Spread | undefined {
    const m = /^([A-Za-z]+):(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/.exec(spread);
    if (!m) return undefined;
    const evs = Object.fromEntries(STAT_KEYS.map((k, i) => [k, Number(m[i + 2])]));
    return { nature: m[1], evs: evs as Spread["evs"] };
}

/** Ladder spread for a species from the newest blob of each format, M-C before M-B. */
function ladderSpread(species: string): Spread | undefined {
    const blobs = loadUsageFromDir();
    for (const format of ["gen9championsvgc2026regmc", "gen9championsvgc2026regmb"]) {
        const blob = latestUsage(blobs, format);
        if (!blob) continue;
        const top = topSpreads(blob, species, 1)[0];
        if (!top) continue;
        const parsed = parseSpread(top.spread);
        if (parsed) return parsed;
    }
    return undefined;
}

/** Neutral fallback: bulky, offensive stat higher, a point in Speed. */
function neutralSpread(species: string): Spread {
    const base = championsDex.species.get(species)?.baseStats ?? { atk: 80, spa: 80 };
    return {
        nature: "Serious",
        evs: {
            hp: 32,
            atk: base.atk >= base.spa ? 32 : 0,
            def: 0,
            spa: base.atk >= base.spa ? 0 : 32,
            spd: 0,
            spe: 2,
        },
    };
}

function buildSets(
    event: ReturnType<typeof loadEvents>[number],
    placingIndex: number,
): PokemonSet[] {
    const slotTeam = event.topCut[placingIndex]?.team ?? [];
    const sets: PokemonSet[] = [];
    for (const slot of slotTeam) {
        if (!slot?.name) continue;
        const species = SPECIES_ALIASES[slot.name] ?? slot.name;
        const ladder = ladderSpread(species) ?? ladderSpread(slot.name);
        const spread = ladder ?? neutralSpread(species);
        sets.push({
            species,
            item: slot.item ?? undefined,
            ability: slot.ability ?? undefined,
            moves: slot.moves ?? [],
            nature: slot.nature ?? spread.nature,
            evs: spread.evs,
            level: 50,
        });
    }
    return sets;
}

const events = loadEvents("champions-regmc");
const teams: { source: string; sets: PokemonSet[] }[] = [];
for (const event of events) {
    const date = event.date.slice(0, 10);
    for (const [i, p] of event.topCut.slice(0, 8).entries()) {
        const sets = buildSets(event, i);
        if (!sets.length) continue;
        teams.push({ source: `${event.name} #${p.placing} ${p.player} (${date})`, sets });
    }
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(teams, null, 1));
console.log(`wrote ${OUT}: ${teams.length} teams`);
