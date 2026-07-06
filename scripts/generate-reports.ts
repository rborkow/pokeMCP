/**
 * Generate publishable meta-report MDX + per-Pokémon trend JSON for the
 * teambuilder, straight from Smogon's monthly "chaos" usage statistics.
 *
 * Runs in the monthly stats workflow after fetch-stats/append-history, and can
 * be run locally at any time. Pulls history directly from Smogon's archives
 * (same source the D1 backfill uses) so it works even when D1 is stale or a
 * format was never backfilled.
 *
 * Outputs (all inside apps/teambuilder/src/, consumed at build time):
 *   content/reports/{slug}/{month}.mdx   - report body (tables deterministic,
 *                                          narrative via Anthropic when
 *                                          ANTHROPIC_API_KEY is set)
 *   content/reports/manifest.json        - report metadata for routes/sitemap
 *   data/mons/{slug}/{pokemonId}.json    - per-Pokémon trend page data
 *   data/mons/index.json                 - per-format id index for
 *                                          generateStaticParams + sitemap
 *
 * Usage:
 *   bun run generate-reports                  # all targets
 *   TARGETS=champions bun run generate-reports
 *   MONTHS=6 bun run generate-reports         # history window (default 6)
 *   NARRATIVE=0 bun run generate-reports      # skip the Anthropic call
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Statistics } from "smogon";
import { Abilities } from "../src/data/abilities.js";
import { Items } from "../src/data/items.js";
import { Moves } from "../src/data/moves.js";
import { REGULATIONS } from "../src/regulations/registry.js";
import type { ChaosSnapshot } from "./lib/chaos-to-rows.js";
import {
    type GradedPrediction,
    gradePredictions,
    type Prediction,
} from "./lib/grade-predictions.js";
import { type CachedTournament, readCachedTournaments } from "./lib/tournaments.js";

// --- Config ---

interface Target {
    slug: string;
    /** "champions" resolves the format id from the regulations registry. */
    formatId: string | "champions";
    label: string;
    mode: "vgc" | "singles";
    /** Generate /pokemon/{id}/{slug} page data for this target. */
    monPages: boolean;
}

const ALL_TARGETS: Target[] = [
    { slug: "champions", formatId: "champions", label: "", mode: "vgc", monPages: true },
    {
        slug: "vgc",
        formatId: "gen9vgc2026regf",
        label: "VGC 2026 Regulation F",
        mode: "vgc",
        monPages: true,
    },
    { slug: "ou", formatId: "gen9ou", label: "Smogon Gen 9 OU", mode: "singles", monPages: false },
];

const MONTHS = Number(process.env.MONTHS || 6);
const NARRATIVE = process.env.NARRATIVE !== "0";
/** Only regenerate tournament/event artifacts (no Smogon fetches, reports, or narrative). */
const EVENTS_ONLY = process.env.EVENTS_ONLY === "1";
const EVENT_WINDOW_DAYS = Number(process.env.EVENT_WINDOW_DAYS || 35);
const EVENT_PAGE_MIN_PLAYERS = Number(process.env.EVENT_PAGE_MIN_PLAYERS || 96);
const REPORT_EVENTS_CAP = 3;
const FETCH_DELAY_MS = 1500;
const MON_PAGE_CUTOFF = 0.005; // 0.5% usage
const SHIFT_RELEVANCE = 0.02; // 2% usage to count as a meaningful entrant/dropout
const ANTHROPIC_MODEL = "claude-opus-4-8";

const ROOT = process.cwd(); // scripts run from the repo root via `bun run generate-reports`
const TEAMBUILDER_SRC = join(ROOT, "apps", "teambuilder", "src");
const CONTENT_DIR = join(TEAMBUILDER_SRC, "content", "reports");
const MONS_DIR = join(TEAMBUILDER_SRC, "data", "mons");
const EVENTS_DIR = join(TEAMBUILDER_SRC, "data", "events");
const CACHE_DIR = join(tmpdir(), "pokemcp-chaos-cache");

const SITE = "https://www.pokemcp.com";

// --- Small helpers ---

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toID(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function monthIndex(date: string): number {
    const [y, m] = date.split("-").map(Number);
    return y * 12 + (m - 1);
}

function indexToMonth(i: number): string {
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

function monthLong(month: string): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });
}

function monthShort(month: string): string {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
    });
}

const pct = (fraction: number): string => `${(fraction * 100).toFixed(2)}%`;
const signedPts = (deltaFraction: number): string => {
    const v = deltaFraction * 100;
    return `${v >= 0 ? "+" : ""}${v.toFixed(2)} pts`;
};

/** Top-N entries of a weighted-count map as [name, percentOfTotal] (mirrors src/stats.ts). */
function topNPercent(data: Record<string, number> | undefined, n: number): [string, number][] {
    if (!data) return [];
    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) return [];
    return Object.entries(data)
        .map(([key, value]) => [key, (value / total) * 100] as [string, number])
        .sort(([, a], [, b]) => b - a)
        .slice(0, n);
}

// Chaos data keys moves/items/abilities by Showdown id ("heavydutyboots") —
// map back to display names ("Heavy-Duty Boots") via the dex tables.
const displayMove = (id: string): string => (Moves as any)[id]?.name ?? id;
const displayItem = (id: string): string => (Items as any)[id]?.name ?? id;
const displayAbility = (id: string): string => (Abilities as any)[id]?.name ?? id;

/** topNPercent with keys mapped through a display-name function. */
function topNDisplay(
    data: Record<string, number> | undefined,
    n: number,
    display: (id: string) => string,
): [string, number][] {
    return topNPercent(data, n).map(([id, share]) => [display(id), share]);
}

/** Escape LLM-generated markdown so MDX cannot interpret it as JSX/expressions. */
function escapeMdx(text: string): string {
    return text.replace(/</g, "&lt;").replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

// --- Smogon fetching (tmpdir-cached, polite) ---

let lastNetworkFetch = 0;

async function fetchChaos(formatId: string, month: string): Promise<ChaosSnapshot | null> {
    mkdirSync(CACHE_DIR, { recursive: true });
    const cachePath = join(CACHE_DIR, `${month}-${formatId}.json`);
    try {
        return JSON.parse(readFileSync(cachePath, "utf-8"));
    } catch {
        // not cached yet
    }
    const missPath = `${cachePath}.404`;
    try {
        readFileSync(missPath, "utf-8");
        return null; // cached 404
    } catch {
        // not a cached miss either - hit the network
    }

    const wait = lastNetworkFetch + FETCH_DELAY_MS - Date.now();
    if (wait > 0) await delay(wait);
    lastNetworkFetch = Date.now();

    const url = Statistics.url(month, formatId, true, "chaos");
    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 404) {
            writeFileSync(missPath, "404");
            return null;
        }
        throw new Error(`Smogon fetch failed for ${formatId} ${month}: HTTP ${response.status}`);
    }
    const text = await response.text();
    writeFileSync(cachePath, text);
    return JSON.parse(text);
}

// --- Snapshot model ---

interface MonRow {
    id: string;
    name: string;
    usage: number;
    rank: number;
    raw: number | null;
}

interface MonthSnapshot {
    month: string;
    battles: number | null;
    rows: Map<string, MonRow>; // keyed by id
    chaos: ChaosSnapshot;
}

function toSnapshot(month: string, chaos: ChaosSnapshot): MonthSnapshot {
    const entries = Object.entries(chaos.data)
        .map(([name, d]: [string, any]) => ({
            id: toID(name),
            name,
            usage: typeof d.usage === "number" ? d.usage : 0,
            raw: typeof d["Raw count"] === "number" ? d["Raw count"] : null,
        }))
        .sort((a, b) => b.usage - a.usage);
    const rows = new Map<string, MonRow>();
    entries.forEach((entry, i) => {
        rows.set(entry.id, { ...entry, rank: i + 1 });
    });
    const battles = chaos.info?.["number of battles"];
    return { month, battles: typeof battles === "number" ? battles : null, rows, chaos };
}

/**
 * Fetch up to `window` months of history ending at the most recent month that
 * has data, starting the walk at the previous calendar month. Months missing
 * from Smogon (404) inside the window are simply skipped.
 */
async function fetchHistory(formatId: string, window: number): Promise<MonthSnapshot[]> {
    const now = new Date();
    const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const newestCandidate = monthIndex(currentMonth) - 1;
    const snapshots: MonthSnapshot[] = [];

    // Find the newest month with data (look back up to 3 months), then fill the window.
    let newest = -1;
    for (let i = newestCandidate; i > newestCandidate - 3; i--) {
        const chaos = await fetchChaos(formatId, indexToMonth(i));
        if (chaos) {
            newest = i;
            snapshots.push(toSnapshot(indexToMonth(i), chaos));
            break;
        }
    }
    if (newest === -1) return [];

    for (let i = newest - 1; i > newest - window; i--) {
        const chaos = await fetchChaos(formatId, indexToMonth(i));
        if (chaos) snapshots.push(toSnapshot(indexToMonth(i), chaos));
    }
    return snapshots.reverse(); // oldest -> newest
}

// --- Trend computation (deterministic) ---

interface Shift {
    id: string;
    name: string;
    fromUsage: number;
    toUsage: number;
    fromRank: number | null;
    toRank: number | null;
}

interface Trends {
    latest: MonthSnapshot;
    prev: MonthSnapshot | null;
    top20: MonRow[];
    risers: Shift[];
    fallers: Shift[];
    entrants: Shift[];
    dropouts: Shift[];
}

function computeTrends(snapshots: MonthSnapshot[]): Trends {
    const latest = snapshots[snapshots.length - 1];
    const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
    const top20 = [...latest.rows.values()].slice(0, 20);

    const shifts: Shift[] = [];
    if (prev) {
        const ids = new Set([...latest.rows.keys(), ...prev.rows.keys()]);
        for (const id of ids) {
            const before = prev.rows.get(id);
            const after = latest.rows.get(id);
            shifts.push({
                id,
                name: after?.name ?? before?.name ?? id,
                fromUsage: before?.usage ?? 0,
                toUsage: after?.usage ?? 0,
                fromRank: before?.rank ?? null,
                toRank: after?.rank ?? null,
            });
        }
    }
    const relevant = shifts.filter((s) => Math.max(s.fromUsage, s.toUsage) >= SHIFT_RELEVANCE);
    const byDelta = (a: Shift, b: Shift) =>
        Math.abs(b.toUsage - b.fromUsage) - Math.abs(a.toUsage - a.fromUsage);

    return {
        latest,
        prev,
        top20,
        risers: relevant
            .filter((s) => s.fromUsage >= SHIFT_RELEVANCE && s.toUsage - s.fromUsage >= 0.02)
            .sort(byDelta)
            .slice(0, 8),
        fallers: relevant
            .filter((s) => s.toUsage >= 0 && s.fromUsage - s.toUsage >= 0.02)
            .filter((s) => s.toUsage >= SHIFT_RELEVANCE || s.fromUsage >= SHIFT_RELEVANCE)
            .sort(byDelta)
            .slice(0, 8),
        entrants: relevant
            .filter((s) => s.toUsage >= SHIFT_RELEVANCE && s.fromUsage < SHIFT_RELEVANCE)
            .sort(byDelta)
            .slice(0, 8),
        dropouts: relevant
            .filter((s) => s.fromUsage >= SHIFT_RELEVANCE && s.toUsage < SHIFT_RELEVANCE)
            .sort(byDelta)
            .slice(0, 8),
    };
}

// --- Markdown rendering (deterministic; every number traces to the chaos data) ---

function monLink(name: string, id: string, target: Target, hasPage: boolean): string {
    return hasPage && target.monPages ? `[${name}](/pokemon/${id}/${target.slug})` : name;
}

function renderTables(trends: Trends, target: Target, monIds: Set<string>): string {
    const { latest, prev, top20 } = trends;
    const lines: string[] = [];

    lines.push(`## Usage at a glance — ${monthLong(latest.month)}`);
    lines.push("");
    const deltaHeader = prev ? ` Δ vs ${monthShort(prev.month)} |` : "";
    lines.push(`| # | Pokémon | Usage |${deltaHeader}`);
    lines.push(`|---|---------|-------|${prev ? "---|" : ""}`);
    for (const row of top20) {
        const name = monLink(row.name, row.id, target, monIds.has(row.id));
        if (prev) {
            const before = prev.rows.get(row.id);
            const delta = before ? signedPts(row.usage - before.usage) : "new";
            lines.push(`| ${row.rank} | ${name} | ${pct(row.usage)} | ${delta} |`);
        } else {
            lines.push(`| ${row.rank} | ${name} | ${pct(row.usage)} |`);
        }
    }
    lines.push("");

    if (prev) {
        lines.push(`## What changed since ${monthLong(prev.month)}`);
        lines.push("");
        const battleNote =
            latest.battles != null && prev.battles != null
                ? `Ladder volume went from ${prev.battles.toLocaleString()} battles in ${monthShort(prev.month)} to ${latest.battles.toLocaleString()} in ${monthShort(latest.month)}.`
                : "";
        if (battleNote) {
            lines.push(battleNote);
            lines.push("");
        }
        const shiftTable = (title: string, shifts: Shift[]) => {
            if (shifts.length === 0) return;
            lines.push(`### ${title}`);
            lines.push("");
            lines.push("| Pokémon | Then | Now | Change |");
            lines.push("|---------|------|-----|--------|");
            for (const s of shifts) {
                const name = monLink(s.name, s.id, target, monIds.has(s.id));
                lines.push(
                    `| ${name} | ${pct(s.fromUsage)} | ${pct(s.toUsage)} | ${signedPts(s.toUsage - s.fromUsage)} |`,
                );
            }
            lines.push("");
        };
        shiftTable("Risers", trends.risers);
        shiftTable("Fallers", trends.fallers);
        shiftTable("New to the meta (crossed 2% usage)", trends.entrants);
        shiftTable("Dropped out (fell below 2% usage)", trends.dropouts);
    }

    return lines.join("\n");
}

function renderLead(trends: Trends, label: string): string {
    const { latest, prev } = trends;
    const [first, second, third] = trends.top20;
    const battles =
        latest.battles != null ? ` across ${latest.battles.toLocaleString()} ladder battles` : "";
    const deltaNote = prev
        ? (() => {
              const before = prev.rows.get(first.id);
              return before
                  ? ` (${signedPts(first.usage - before.usage)} vs ${monthShort(prev.month)})`
                  : "";
          })()
        : "";
    return (
        `**${first.name}** led ${label} with ${pct(first.usage)} usage in ` +
        `${monthLong(latest.month)}${deltaNote}, ahead of ${second.name} (${pct(second.usage)}) ` +
        `and ${third.name} (${pct(third.usage)})${battles}. ` +
        `The tables below are generated directly from Smogon's weighted usage statistics; ` +
        "the analysis that follows is grounded in those numbers."
    );
}

/** Compact month-by-month series for the biggest movers, fed to the narrative model. */
function renderSeriesForLlm(snapshots: MonthSnapshot[], trends: Trends): string {
    const ids = new Set<string>();
    for (const list of [trends.risers, trends.fallers, trends.entrants, trends.dropouts]) {
        for (const s of list) ids.add(s.id);
    }
    for (const row of trends.top20.slice(0, 10)) ids.add(row.id);

    const lines: string[] = [`Months on record: ${snapshots.map((s) => s.month).join(", ")}`];
    for (const id of ids) {
        const newestWith = [...snapshots].reverse().find((s) => s.rows.has(id));
        const name = trends.latest.rows.get(id)?.name ?? newestWith?.rows.get(id)?.name ?? id;
        const series = snapshots
            .map((s) => {
                const row = s.rows.get(id);
                return `${monthShort(s.month)} ${row ? pct(row.usage) : "—"}`;
            })
            .join(", ");
        lines.push(`${name}: ${series}`);
    }
    return lines.join("\n");
}

// --- Set-shift evidence (month-over-month move/item share changes) ---

const SET_SHIFT_FLAG_PTS = 5; // share-of-own-usage swing worth flagging as a mechanism
const SET_SHIFT_MOVERS_CAP = 12;
const SET_CHANGES_TABLE_CAP = 8;

interface SetSwing {
    monId: string;
    mon: string;
    kind: "Move" | "Item";
    option: string;
    fromPct: number;
    toPct: number;
}

/** Share (percent of total weight) of a single option within one chaos field. */
function sharePct(data: Record<string, number> | undefined, key: string): number {
    if (!data) return 0;
    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    if (total === 0) return 0;
    return ((data[key] ?? 0) / total) * 100;
}

/**
 * For the biggest movers, compare move/item shares between the latest and prior
 * month. Produces (a) an evidence block for the narrative model — the "why"
 * behind a usage shift is usually a set change — and (b) flagged swings for the
 * deterministic "Notable set changes" report table.
 */
function renderSetShifts(trends: Trends): { llmBlock: string | null; swings: SetSwing[] } {
    const { latest, prev } = trends;
    if (!prev) return { llmBlock: null, swings: [] };

    const movers = [...trends.risers, ...trends.fallers, ...trends.entrants]
        .sort((a, b) => Math.abs(b.toUsage - b.fromUsage) - Math.abs(a.toUsage - a.fromUsage))
        .slice(0, SET_SHIFT_MOVERS_CAP);

    const lines: string[] = [];
    const swings: SetSwing[] = [];
    const fmtTop = (
        data: Record<string, number> | undefined,
        n: number,
        display: (id: string) => string,
    ) =>
        topNDisplay(data, n, display)
            .map(([key, share]) => `${key} ${share.toFixed(1)}%`)
            .join(", ");

    for (const mover of movers) {
        const latestName = latest.rows.get(mover.id)?.name;
        const prevName = prev.rows.get(mover.id)?.name;
        const dLatest = latestName ? latest.chaos.data[latestName] : undefined;
        const dPrev = prevName ? prev.chaos.data[prevName] : undefined;
        if (!dLatest) continue;

        if (!dPrev) {
            // New entrant: no shift to compute — describe the arriving set instead.
            lines.push(
                `${mover.name} (new entrant): moves ${fmtTop(dLatest.Moves, 3, displayMove)}; items ${fmtTop(dLatest.Items, 2, displayItem)}`,
            );
            continue;
        }

        const fields = [
            { kind: "Move" as const, field: "Moves", n: 3, display: displayMove },
            { kind: "Item" as const, field: "Items", n: 2, display: displayItem },
        ];
        for (const { kind, field, n, display } of fields) {
            lines.push(
                `${mover.name} ${kind.toLowerCase()}s: ${monthShort(prev.month)} (${fmtTop(dPrev[field], n, display)}) → ${monthShort(latest.month)} (${fmtTop(dLatest[field], n, display)})`,
            );
            const options = new Set(
                [...topNPercent(dPrev[field], n), ...topNPercent(dLatest[field], n)].map(
                    ([key]) => key,
                ),
            );
            for (const option of options) {
                const fromPct = sharePct(dPrev[field], option);
                const toPct = sharePct(dLatest[field], option);
                if (Math.abs(toPct - fromPct) >= SET_SHIFT_FLAG_PTS) {
                    swings.push({
                        monId: mover.id,
                        mon: mover.name,
                        kind,
                        option: display(option),
                        fromPct,
                        toPct,
                    });
                }
            }
        }
    }

    swings.sort((a, b) => Math.abs(b.toPct - b.fromPct) - Math.abs(a.toPct - a.fromPct));
    return {
        llmBlock: lines.length ? lines.join("\n") : null,
        swings: swings.slice(0, SET_CHANGES_TABLE_CAP),
    };
}

/** Deterministic "Notable set changes" table for the report MDX. */
function renderSetChangesTable(
    swings: SetSwing[],
    trends: Trends,
    target: Target,
    monIds: Set<string>,
): string {
    if (swings.length === 0 || !trends.prev) return "";
    const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} pts`;
    const lines: string[] = [
        "## Notable set changes",
        "",
        "How the builds themselves moved — each option's share of that Pokémon's own usage:",
        "",
        `| Pokémon | Option | ${monthShort(trends.prev.month)} | ${monthShort(trends.latest.month)} | Change |`,
        "|---------|--------|------|------|--------|",
    ];
    for (const s of swings) {
        const name = monLink(s.mon, s.monId, target, monIds.has(s.monId));
        lines.push(
            `| ${name} | ${s.kind}: ${s.option} | ${s.fromPct.toFixed(1)}% | ${s.toPct.toFixed(1)}% | ${signed(s.toPct - s.fromPct)} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

// --- Tournament results (Limitless cache -> report section, evidence, event pages) ---

interface SelectedEvents {
    /** Largest events of the recent window — rendered into the monthly report. */
    forReport: CachedTournament[];
    /** Events that merit standalone recap pages (size bar OR window top-3). */
    forPages: CachedTournament[];
}

function selectEvents(regulationId: string): SelectedEvents {
    const all = readCachedTournaments(regulationId);
    const cutoff = new Date(Date.now() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const inWindow = all
        .filter((event) => event.date >= cutoff)
        .sort((a, b) => b.players - a.players);
    const forReport = inWindow.slice(0, REPORT_EVENTS_CAP);

    const pageSet = new Map<string, CachedTournament>();
    for (const event of all) {
        if (event.players >= EVENT_PAGE_MIN_PLAYERS) pageSet.set(event.slug, event);
    }
    for (const event of forReport) pageSet.set(event.slug, event);
    return {
        forReport,
        forPages: [...pageSet.values()].sort((a, b) => b.date.localeCompare(a.date)),
    };
}

const fmtRecord = (record: { wins: number; losses: number; ties: number } | null): string =>
    record ? `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ""}` : "—";

const fmtEventDate = (date: string): string =>
    new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });

/** Deterministic "Tournament results" section for the report MDX. */
function renderTournamentSection(
    events: CachedTournament[],
    target: Target,
    monIds: Set<string>,
    latest: MonthSnapshot,
): string {
    if (events.length === 0) return "";
    const lines: string[] = [
        "## Tournament results",
        "",
        `The largest ${events[0].format} events of the report window, via [Limitless](https://play.limitlesstcg.com).`,
        "",
    ];

    for (const event of events) {
        lines.push(`### ${event.name} — ${fmtEventDate(event.date)}, ${event.players} players`);
        lines.push("");
        lines.push("| Place | Player | Record | Team |");
        lines.push("|-------|--------|--------|------|");
        for (const placing of event.topCut.slice(0, 4)) {
            const team = placing.team
                .map((slot) => monLink(slot.name, slot.id, target, monIds.has(slot.id)))
                .join(", ");
            lines.push(
                `| ${placing.placing} | ${placing.player} | ${fmtRecord(placing.record)} | ${team} |`,
            );
        }
        lines.push("");
        lines.push(
            `[Full top ${event.topCut.length} with builds →](/reports/${target.slug}/events/${event.slug})`,
        );
        lines.push("");
    }

    // Top-cut vs ladder comparison for the single largest event — the
    // "what trickled down" view that pure usage stats can't give.
    const biggest = events[0];
    lines.push(
        `### Top-cut usage at ${biggest.name.length > 40 ? `the ${biggest.players}-player event` : biggest.name} vs the ladder`,
    );
    lines.push("");
    lines.push("| Pokémon | Top cut | Ladder |");
    lines.push("|---------|---------|--------|");
    for (const row of biggest.topCutUsage.slice(0, 8)) {
        const ladder = latest.rows.get(row.id);
        const ladderPct = ladder ? pct(ladder.usage) : "&lt;0.5%";
        const name = monLink(row.name, row.id, target, monIds.has(row.id));
        lines.push(
            `| ${name} | ${row.count}/${biggest.topCut.length} teams (${row.pct.toFixed(0)}%) | ${ladderPct} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

/** Tournament evidence block for the narrative model. */
function renderTournamentEvidenceForLlm(events: CachedTournament[], trends: Trends): string | null {
    if (events.length === 0) return null;
    const lines: string[] = [];

    for (const event of events) {
        const winner = event.topCut.find((p) => p.placing === 1);
        lines.push(
            `${event.name} (${fmtEventDate(event.date)}, ${event.players} players, top ${event.topCut.length} listed):`,
        );
        if (winner) {
            const team = winner.team.map((slot) => `${slot.name} (${slot.item ?? "?"})`).join(", ");
            lines.push(`- Winner ${winner.player} (${fmtRecord(winner.record)}): ${team}`);
        }
        const usageLine = event.topCutUsage
            .slice(0, 6)
            .map((row) => `${row.name} ${row.count}/${event.topCut.length}`)
            .join(", ");
        lines.push(`- Top-cut bring rates: ${usageLine}`);
    }

    // Per-mover cross-event appearances.
    const moverIds = new Set(
        [...trends.risers, ...trends.fallers, ...trends.entrants].map((s) => s.id),
    );
    for (const id of moverIds) {
        const appearances: string[] = [];
        for (const event of events) {
            const row = event.topCutUsage.find((u) => u.id === id);
            if (row) appearances.push(`${row.count}/${event.topCut.length} at ${event.name}`);
        }
        if (appearances.length > 0) {
            const name =
                trends.latest.rows.get(id)?.name ??
                events.flatMap((e) => e.topCutUsage).find((u) => u.id === id)?.name ??
                id;
            lines.push(`${name} top-cut appearances: ${appearances.join("; ")}`);
        }
    }
    return lines.join("\n");
}

// --- Common tournament builds (joint sets from Limitless decklists) ---

interface MonBuild {
    item: string | null;
    ability: string | null;
    moves: string[];
    /**
     * Most common nature observed for this build. Nature is NOT part of the
     * cluster identity — most Limitless Champions events don't publish it, and
     * keying on it splits otherwise-identical builds.
     */
    nature: string | null;
    /** Top-cut teams running this exact build across the window's events. */
    count: number;
    bestPlacing: number;
    bestPlayer: string;
    eventName: string;
    eventSlug: string;
    sourceUrl: string;
}

interface BuildAccumulator extends Omit<MonBuild, "nature"> {
    natureCounts: Map<string, number>;
}

const BUILDS_PER_MON = 3;

/**
 * Cluster identical builds (item + ability + move set + nature) per Pokémon
 * across all cached events in the window. Unlike the ladder stats — which are
 * marginal distributions — these are real joint sets with provenance.
 */
function clusterBuilds(regulationId: string): Map<string, MonBuild[]> {
    const cutoff = new Date(Date.now() - EVENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const events = readCachedTournaments(regulationId).filter((event) => event.date >= cutoff);

    const byMon = new Map<string, Map<string, BuildAccumulator>>();
    for (const event of events) {
        for (const placing of event.topCut) {
            for (const slot of placing.team) {
                const key = [
                    slot.item ?? "",
                    slot.ability ?? "",
                    [...slot.moves].sort().join(","),
                ].join("|");
                let builds = byMon.get(slot.id);
                if (!builds) {
                    builds = new Map();
                    byMon.set(slot.id, builds);
                }
                let entry = builds.get(key);
                if (!entry) {
                    entry = {
                        item: slot.item,
                        ability: slot.ability,
                        moves: slot.moves,
                        natureCounts: new Map(),
                        count: 0,
                        bestPlacing: Number.POSITIVE_INFINITY,
                        bestPlayer: "",
                        eventName: "",
                        eventSlug: "",
                        sourceUrl: "",
                    };
                    builds.set(key, entry);
                }
                entry.count += 1;
                if (slot.nature) {
                    entry.natureCounts.set(
                        slot.nature,
                        (entry.natureCounts.get(slot.nature) ?? 0) + 1,
                    );
                }
                if (placing.placing < entry.bestPlacing) {
                    entry.bestPlacing = placing.placing;
                    entry.bestPlayer = placing.player;
                    entry.eventName = event.name;
                    entry.eventSlug = event.slug;
                    entry.sourceUrl = event.sourceUrl;
                }
            }
        }
    }

    const result = new Map<string, MonBuild[]>();
    for (const [monId, builds] of byMon) {
        result.set(
            monId,
            [...builds.values()]
                .sort((a, b) => b.count - a.count || a.bestPlacing - b.bestPlacing)
                .slice(0, BUILDS_PER_MON)
                .map(({ natureCounts, ...build }) => ({
                    ...build,
                    nature: [...natureCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
                })),
        );
    }
    return result;
}

/** Ladder usage (fraction) for a mon, from the committed per-mon JSON when no snapshot is loaded. */
function ladderUsageFromMonData(slug: string, id: string): number | null {
    try {
        const data = JSON.parse(readFileSync(join(MONS_DIR, slug, `${id}.json`), "utf-8"));
        const last = data.history?.[data.history.length - 1];
        return typeof last?.usage === "number" ? last.usage : null;
    } catch {
        return null;
    }
}

/** Write per-event JSON + index for the teambuilder event recap pages. */
function writeEventPages(
    target: Target,
    regulationLabel: string,
    events: CachedTournament[],
    ladderUsage: (id: string) => number | null,
): void {
    const dir = join(EVENTS_DIR, target.slug);
    mkdirSync(dir, { recursive: true });

    for (const event of events) {
        const usageComparison = event.topCutUsage.map((row) => ({
            ...row,
            ladderUsage: ladderUsage(row.id),
        }));
        writeFileSync(
            join(dir, `${event.slug}.json`),
            `${JSON.stringify({ ...event, regulationLabel, usageComparison }, null, 1)}\n`,
        );
    }

    const indexPath = join(EVENTS_DIR, "index.json");
    let index: Record<string, unknown> = {};
    try {
        index = JSON.parse(readFileSync(indexPath, "utf-8"));
    } catch {
        // first run
    }
    index[target.slug] = events.map((event) => ({
        slug: event.slug,
        name: event.name,
        date: event.date,
        players: event.players,
        format: event.format,
        regulationLabel,
    }));
    writeFileSync(indexPath, `${JSON.stringify(index, null, 4)}\n`);
    console.log(`  wrote ${events.length} event page(s) for ${target.slug}`);
}

// --- Predictions ledger (proposed by the model, graded deterministically) ---

const PREDICTIONS_PATH = () => join(CONTENT_DIR, "predictions.json");
const MAX_PREDICTIONS = 5;

function loadPredictionLedger(): Prediction[] {
    try {
        return JSON.parse(readFileSync(PREDICTIONS_PATH(), "utf-8"));
    } catch {
        return [];
    }
}

function savePredictions(slug: string, month: string, predictions: Prediction[]): void {
    const others = loadPredictionLedger().filter((p) => !(p.slug === slug && p.month === month));
    const next = [...others, ...predictions].sort(
        (a, b) => a.slug.localeCompare(b.slug) || b.month.localeCompare(a.month),
    );
    writeFileSync(PREDICTIONS_PATH(), `${JSON.stringify(next, null, 4)}\n`);
}

/**
 * Extract and validate the model's fenced ```json predictions block. Returns
 * the validated predictions and the narrative text with the block removed.
 * Invalid entries are dropped (subjects must exist in the latest data).
 */
function extractPredictions(
    rawNarrative: string,
    trends: Trends,
    slug: string,
    reportMonth: string,
): { predictions: Prediction[]; narrative: string } {
    const match = rawNarrative.match(/```json\s*([\s\S]*?)```/);
    if (!match) return { predictions: [], narrative: rawNarrative };
    const narrative = rawNarrative.replace(match[0], "").trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(match[1]);
    } catch {
        console.warn("  predictions block did not parse — skipping ledger update");
        return { predictions: [], narrative };
    }
    if (!Array.isArray(parsed)) return { predictions: [], narrative };

    const predictions: Prediction[] = [];
    for (const entry of parsed) {
        if (predictions.length >= MAX_PREDICTIONS) break;
        const name = typeof entry?.pokemonName === "string" ? entry.pokemonName : null;
        const id = name ? toID(name) : null;
        const row = id ? trends.latest.rows.get(id) : undefined;
        const direction = entry?.direction === "up" || entry?.direction === "down";
        const threshold = Number(entry?.thresholdPts);
        const ok =
            row &&
            direction &&
            Number.isFinite(threshold) &&
            typeof entry?.claim === "string" &&
            entry.claim.length > 0 &&
            typeof entry?.falsifier === "string" &&
            entry.falsifier.length > 0 &&
            typeof entry?.evidence === "string" &&
            entry.evidence.length > 0;
        if (!ok) {
            console.warn(`  dropped invalid prediction: ${JSON.stringify(entry).slice(0, 120)}`);
            continue;
        }
        predictions.push({
            month: reportMonth,
            slug,
            pokemonId: row.id,
            pokemonName: row.name,
            claim: entry.claim,
            direction: entry.direction,
            thresholdPts: Math.min(15, Math.max(1, Math.round(threshold))),
            confidence: entry.confidence === "possible" ? "possible" : "likely",
            falsifier: entry.falsifier,
            evidence: entry.evidence,
            baselineUsagePct: row.usage * 100,
        });
    }
    return { predictions, narrative };
}

const GRADE_BADGE: Record<GradedPrediction["grade"], string> = {
    correct: "✅ Correct",
    wrong: "❌ Wrong",
    unclear: "➖ Unclear",
};

/** Deterministic "Last month's calls, graded" table. */
function renderGradedCalls(graded: GradedPrediction[], gradedAgainst: string): string {
    if (graded.length === 0) return "";
    const lines: string[] = [
        "## Last month's calls, graded",
        "",
        `We grade our own predictions. Each call below was published last month with a falsifier attached; grades are computed mechanically from the ${gradedAgainst} usage data — the model that wrote the calls never grades itself.`,
        "",
        "| Call | Then | Now | Move | Grade |",
        "|------|------|-----|------|-------|",
    ];
    for (const g of graded) {
        const move = `${g.deltaPts >= 0 ? "+" : ""}${g.deltaPts.toFixed(2)} pts`;
        lines.push(
            `| ${g.claim} | ${g.baselineUsagePct.toFixed(2)}% | ${g.actualUsagePct.toFixed(2)}% | ${move} | ${GRADE_BADGE[g.grade]} |`,
        );
    }
    const tally = {
        correct: graded.filter((g) => g.grade === "correct").length,
        wrong: graded.filter((g) => g.grade === "wrong").length,
        unclear: graded.filter((g) => g.grade === "unclear").length,
    };
    lines.push("");
    lines.push(
        `Scorecard: ${tally.correct} correct, ${tally.wrong} wrong, ${tally.unclear} unclear.`,
    );
    lines.push("");
    return lines.join("\n");
}

/** Deterministic "Our calls for next month" section, rendered from the validated ledger entries. */
function renderNewCalls(predictions: Prediction[]): string {
    if (predictions.length === 0) return "";
    const lines: string[] = [
        "## Our calls for next month",
        "",
        "Falsifiable predictions — we grade these in the next report:",
        "",
        "| Call | Today | Counts as correct | What proves us wrong | Confidence |",
        "|------|-------|-------------------|----------------------|------------|",
    ];
    for (const p of predictions) {
        const dir = p.direction === "up" ? "+" : "-";
        lines.push(
            `| ${p.claim} | ${p.baselineUsagePct.toFixed(2)}% | ${dir}${p.thresholdPts} pts or more | ${p.falsifier} | ${p.confidence} |`,
        );
    }
    lines.push("");
    return lines.join("\n");
}

// --- Narrative (Anthropic; ported from apps/teambuilder/src/lib/ai/context.ts) ---

function narrativeSystemPrompt(label: string, mode: "vgc" | "singles"): string {
    const modeNote =
        mode === "vgc"
            ? "This is a VGC/doubles format. Frame takeaways for doubles team building (speed control, spread moves, restricted/legendary usage, common cores)."
            : "Frame takeaways for singles team building (hazards, pivots, win conditions, defensive backbone).";

    return `You are a competitive Pokémon metagame analyst. You write concise, data-grounded "state of the meta" reports for ${label}.

${modeNote}

You are given the report's PRECOMPUTED data: the current top-20 usage table, month-over-month risers/fallers/entrants/dropouts, and month-by-month usage series for the biggest movers. The tables are already rendered above your text in the published report — do NOT repeat them as tables.

Write markdown with exactly these sections:
1. \`## Where the meta stands\` — the shape of the format right now, citing the actual usage percentages.
2. \`## Where it's heading\` — read the month-by-month series to call out Pokémon likely to keep climbing or sliding. Frame these as extrapolations from the trend, NOT guarantees.
3. \`## What to prepare for\` — 2–4 actionable takeaways for a team builder.
4. \`## Common questions\` — 2–3 \`### \` subheadings phrased as questions a player would type into a search engine (e.g. "Is X still good in Y?"), each answered in 2–3 sentences from the data.

After the last section, output a fenced \`\`\`json code block containing 3–5 falsifiable predictions for next month, as an array of:
{"pokemonName": string, "direction": "up"|"down", "thresholdPts": number, "confidence": "likely"|"possible", "claim": string, "falsifier": string, "evidence": string}
Prediction rules:
- Subjects MUST appear in the supplied data; \`evidence\` quotes the specific data line (usage series, set change, or tournament result) the call rests on. A prediction with no evidence line will be dropped.
- \`thresholdPts\` is the usage-point move that makes the call correct — pick realistic magnitudes (1–15).
- \`claim\` is one publishable sentence; \`falsifier\` states plainly what outcome proves the call wrong.
- These will be graded mechanically next month and published with your name on them — do not make calls the data cannot support. Fewer good calls beat five weak ones.
- If a "Last month's calls, graded" section is supplied in the evidence, acknowledge the scorecard honestly in \`## Where it's heading\` (one sentence) — never relitigate or excuse the grades.

Rules:
- Ground EVERY claim in the supplied numbers. Quote usage %s and deltas from the data.
- Do NOT invent Pokémon, percentages, or trends that are not present in the data.
- When explaining a usage shift, prefer citing a specific set change from the "Set changes" evidence as the mechanism (e.g. an item or move whose share moved). If no set change of 5+ points exists for that Pokémon, state that its build is stable and attribute the shift to external factors only.
- Tournament placements outrank ladder usage as evidence when tournament results are supplied. Never infer a result that is not listed.
- If history is thin (few months on record), say so plainly and keep it short — never fabricate a trend.
- Be direct and concise — this is an analyst briefing, not a chat. No preamble, no sign-off.
- Regulations are time-boxed; never read across a regulation boundary as if it were continuous.`;
}

/** Titled evidence blocks appended to the narrative user message. */
interface EvidenceSection {
    title: string;
    body: string;
}

async function generateNarrative(
    label: string,
    mode: "vgc" | "singles",
    tables: string,
    evidence: EvidenceSection[],
): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!NARRATIVE || !apiKey) {
        console.warn(
            `  narrative skipped for ${label} (${NARRATIVE ? "ANTHROPIC_API_KEY not set" : "NARRATIVE=0"})`,
        );
        return null;
    }

    const evidenceBlocks = evidence
        .map((section) => `## ${section.title}\n\n${section.body}`)
        .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 2500,
            system: narrativeSystemPrompt(label, mode),
            messages: [
                {
                    role: "user",
                    content: `Report tables (already shown to the reader above your text):\n\n${tables}\n\n${evidenceBlocks}\n\nWrite the analysis sections for ${label}.`,
                },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }
    const result = (await response.json()) as { content: { type: string; text?: string }[] };
    const text = result.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n");
    // Returned RAW — the caller extracts the predictions JSON block before
    // applying MDX escaping (escaping would mangle the JSON braces).
    return text.trim();
}

// --- Per-Pokémon page data ---

function writeMonPages(
    target: Target,
    snapshots: MonthSnapshot[],
    formatId: string,
    formatLabel: string,
    builds: Map<string, MonBuild[]>,
): string[] {
    const latest = snapshots[snapshots.length - 1];
    const dir = join(MONS_DIR, target.slug);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    const ids: string[] = [];
    for (const row of latest.rows.values()) {
        if (row.usage < MON_PAGE_CUTOFF) continue;
        const d = latest.chaos.data[row.name] ?? {};
        const counters = Object.entries(d["Checks and Counters"] ?? {})
            .map(([name, data]: [string, any]) => ({
                name,
                score: Number(data?.[0] ?? 0),
                koPct: Number(data?.[1] ?? 0),
                switchPct: Number(data?.[2] ?? 0),
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        const page = {
            id: row.id,
            name: row.name,
            slug: target.slug,
            formatId,
            formatLabel,
            dataThrough: latest.month,
            history: snapshots.map((s) => {
                const r = s.rows.get(row.id);
                return {
                    month: s.month,
                    usage: r?.usage ?? 0,
                    rank: r?.rank ?? null,
                    raw: r?.raw ?? null,
                };
            }),
            abilities: topNDisplay(d.Abilities, 5, displayAbility),
            items: topNDisplay(d.Items, 8, displayItem),
            moves: topNDisplay(d.Moves, 10, displayMove),
            spreads: topNPercent(d.Spreads, 5),
            // "nothing" is the no-Tera marker (all of Champions) — not a type.
            teraTypes: topNPercent(d["Tera Types"], 5).filter(([type]) => type !== "nothing"),
            teammates: topNPercent(d.Teammates, 10),
            counters,
            builds: builds.get(row.id) ?? [],
        };
        writeFileSync(join(dir, `${row.id}.json`), `${JSON.stringify(page, null, 1)}\n`);
        ids.push(row.id);
    }
    return ids;
}

// --- Manifest & MDX assembly ---

interface ManifestEntry {
    slug: string;
    month: string;
    title: string;
    description: string;
    datePublished: string;
    dateModified: string;
    dataThrough: string;
    formatId: string;
    formatName: string;
    sources: { label: string; url: string }[];
    generated?: boolean;
}

function upsertManifest(entry: ManifestEntry): boolean {
    const manifestPath = join(CONTENT_DIR, "manifest.json");
    const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const existing = manifest.find((e) => e.slug === entry.slug && e.month === entry.month);
    if (existing && !existing.generated) {
        console.warn(
            `  manifest entry ${entry.slug}/${entry.month} is hand-written — leaving it (and its MDX) alone`,
        );
        return false;
    }
    const next = manifest.filter((e) => !(e.slug === entry.slug && e.month === entry.month));
    next.push(entry);
    next.sort((a, b) => a.slug.localeCompare(b.slug) || b.month.localeCompare(a.month));
    writeFileSync(manifestPath, `${JSON.stringify(next, null, 4)}\n`);
    return true;
}

function resolveTarget(
    target: Target,
): { formatId: string; label: string; regulationId: string | null } | null {
    if (target.formatId !== "champions") {
        return { formatId: target.formatId, label: target.label, regulationId: null };
    }
    // Newest regulation that has a Smogon stats id is the live one for reports.
    const candidates = REGULATIONS.filter((r) => r.showdownFormatId).sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
    );
    const reg = candidates[0];
    if (!reg) {
        console.warn("  no Champions regulation has a showdownFormatId yet — skipping champions");
        return null;
    }
    return {
        formatId: reg.showdownFormatId as string,
        label: reg.displayName,
        regulationId: reg.id,
    };
}

async function processTarget(target: Target): Promise<void> {
    const resolved = resolveTarget(target);
    if (!resolved) return;
    const { formatId, label, regulationId } = resolved;
    console.log(`\n${target.slug} (${formatId}) — ${label}`);

    const events = regulationId
        ? selectEvents(regulationId)
        : { forReport: [], forPages: [] as CachedTournament[] };

    if (EVENTS_ONLY) {
        if (events.forPages.length > 0) {
            writeEventPages(target, label, events.forPages, (id) =>
                ladderUsageFromMonData(target.slug, id),
            );
        } else {
            console.log("  no cached events meet the page bar — nothing to write");
        }
        return;
    }

    const snapshots = await fetchHistory(formatId, MONTHS);
    if (snapshots.length === 0) {
        console.warn(`  no Smogon data found for ${formatId} — skipping`);
        return;
    }
    const trends = computeTrends(snapshots);
    const dataThrough = trends.latest.month;
    const reportMonth = indexToMonth(monthIndex(dataThrough) + 1);
    console.log(
        `  ${snapshots.length} month(s) of data through ${dataThrough} -> report ${reportMonth}`,
    );

    // Per-mon page data first, so report tables know which names to link.
    let monIds = new Set<string>();
    if (target.monPages) {
        const builds = regulationId ? clusterBuilds(regulationId) : new Map<string, MonBuild[]>();
        const ids = writeMonPages(target, snapshots, formatId, label, builds);
        monIds = new Set(ids);
        const indexPath = join(MONS_DIR, "index.json");
        const index = JSON.parse(readFileSync(indexPath, "utf-8"));
        index[target.slug] = { formatId, formatLabel: label, dataThrough, ids };
        writeFileSync(indexPath, `${JSON.stringify(index, null, 4)}\n`);
        console.log(`  wrote ${ids.length} per-Pokémon data files`);
    }

    // Event recap pages (ladder usage joined from the live snapshot).
    if (events.forPages.length > 0) {
        writeEventPages(target, label, events.forPages, (id) => {
            const row = trends.latest.rows.get(id);
            return row ? row.usage : null;
        });
    }

    const lead = renderLead(trends, label);
    const tables = renderTables(trends, target, monIds);
    const setShifts = renderSetShifts(trends);
    const setChangesTable = renderSetChangesTable(setShifts.swings, trends, target, monIds);
    const tournamentSection = renderTournamentSection(
        events.forReport,
        target,
        monIds,
        trends.latest,
    );

    // Grade the previous report's calls against this month's data (pure
    // arithmetic — the narrative model only gets the finished grades).
    const prevReportMonth = indexToMonth(monthIndex(reportMonth) - 1);
    const toGrade = loadPredictionLedger().filter(
        (p) => p.slug === target.slug && p.month === prevReportMonth,
    );
    const latestUsagePct = new Map(
        [...trends.latest.rows.values()].map((row) => [row.id, row.usage * 100]),
    );
    const graded = gradePredictions(toGrade, latestUsagePct);
    const gradedSection = renderGradedCalls(graded, monthLong(dataThrough));

    const evidence: EvidenceSection[] = [
        {
            title: "Month-by-month usage series for the biggest movers",
            body: renderSeriesForLlm(snapshots, trends),
        },
    ];
    if (setShifts.llmBlock) {
        evidence.push({
            title: "Set changes for the biggest movers (share of that Pokémon's own usage)",
            body: setShifts.llmBlock,
        });
    }
    const tournamentEvidence = renderTournamentEvidenceForLlm(events.forReport, trends);
    if (tournamentEvidence) {
        evidence.push({
            title: "Tournament results in this report window (top-cut bring rates and winners)",
            body: tournamentEvidence,
        });
    }
    if (graded.length > 0) {
        evidence.push({
            title: "Last month's calls, graded (deterministic — do not re-judge)",
            body: graded
                .map(
                    (g) =>
                        `${GRADE_BADGE[g.grade]}: "${g.claim}" (${g.baselineUsagePct.toFixed(2)}% → ${g.actualUsagePct.toFixed(2)}%, needed ${g.direction === "up" ? "+" : "-"}${g.thresholdPts} pts)`,
                )
                .join("\n"),
        });
    }

    const rawNarrative = await generateNarrative(label, target.mode, tables, evidence);
    let narrative: string | null = null;
    let newCallsSection = "";
    if (rawNarrative) {
        const extracted = extractPredictions(rawNarrative, trends, target.slug, reportMonth);
        narrative = escapeMdx(extracted.narrative);
        if (extracted.predictions.length > 0) {
            savePredictions(target.slug, reportMonth, extracted.predictions);
            newCallsSection = renderNewCalls(extracted.predictions);
            console.log(`  ledger: ${extracted.predictions.length} call(s) for ${reportMonth}`);
        }
    }

    const body = [
        lead,
        "",
        gradedSection,
        tables,
        setChangesTable,
        tournamentSection,
        narrative ?? "> _Narrative analysis pending editorial review._",
        "",
        newCallsSection,
    ].join("\n");

    const today = new Date().toISOString().slice(0, 10);
    const top = trends.top20[0];
    const entry: ManifestEntry = {
        slug: target.slug,
        month: reportMonth,
        title: `${label} Meta Report — ${monthLong(reportMonth)}`,
        description:
            `${top.name} leads ${label} with ${pct(top.usage)} usage in ${monthLong(dataThrough)}. ` +
            "Full usage table, month-over-month risers and fallers, and data-grounded analysis.",
        datePublished: today,
        dateModified: today,
        dataThrough,
        formatId,
        formatName: label,
        sources: snapshots
            .slice(-2)
            .reverse()
            .map((s) => ({
                label: `Smogon usage stats — ${formatId}, ${monthLong(s.month)}`,
                url: `https://www.smogon.com/stats/${s.month}/${formatId}-0.txt`,
            })),
        generated: true,
    };

    // Keep datePublished stable if we are regenerating an existing generated entry.
    const manifestPath = join(CONTENT_DIR, "manifest.json");
    const current: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const prior = current.find((e) => e.slug === entry.slug && e.month === entry.month);
    if (prior?.generated) entry.datePublished = prior.datePublished;

    if (!upsertManifest(entry)) return;

    const contentDir = join(CONTENT_DIR, target.slug);
    mkdirSync(contentDir, { recursive: true });
    writeFileSync(join(contentDir, `${reportMonth}.mdx`), body);
    console.log(`  wrote report ${SITE}/reports/${target.slug}/${reportMonth}`);
}

async function main() {
    const only = process.env.TARGETS?.split(",").map((s) => s.trim());
    const targets = only ? ALL_TARGETS.filter((t) => only.includes(t.slug)) : ALL_TARGETS;
    for (const target of targets) {
        await processTarget(target);
    }
    console.log("\nDone. Review the generated MDX before publishing.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
