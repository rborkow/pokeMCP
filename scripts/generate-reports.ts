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
import { REGULATIONS } from "../src/regulations/registry.js";
import type { ChaosSnapshot } from "./lib/chaos-to-rows.js";

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
const FETCH_DELAY_MS = 1500;
const MON_PAGE_CUTOFF = 0.005; // 0.5% usage
const SHIFT_RELEVANCE = 0.02; // 2% usage to count as a meaningful entrant/dropout
const ANTHROPIC_MODEL = "claude-opus-4-8";

const ROOT = process.cwd(); // scripts run from the repo root via `bun run generate-reports`
const TEAMBUILDER_SRC = join(ROOT, "apps", "teambuilder", "src");
const CONTENT_DIR = join(TEAMBUILDER_SRC, "content", "reports");
const MONS_DIR = join(TEAMBUILDER_SRC, "data", "mons");
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

Rules:
- Ground EVERY claim in the supplied numbers. Quote usage %s and deltas from the data.
- Do NOT invent Pokémon, percentages, or trends that are not present in the data.
- If history is thin (few months on record), say so plainly and keep it short — never fabricate a trend.
- Be direct and concise — this is an analyst briefing, not a chat. No preamble, no sign-off.
- Regulations are time-boxed; never read across a regulation boundary as if it were continuous.`;
}

async function generateNarrative(
    label: string,
    mode: "vgc" | "singles",
    tables: string,
    series: string,
): Promise<string | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!NARRATIVE || !apiKey) {
        console.warn(
            `  narrative skipped for ${label} (${NARRATIVE ? "ANTHROPIC_API_KEY not set" : "NARRATIVE=0"})`,
        );
        return null;
    }

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
                    content: `Report tables (already shown to the reader above your text):\n\n${tables}\n\nMonth-by-month usage series for the biggest movers:\n\n${series}\n\nWrite the analysis sections for ${label}.`,
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
    return escapeMdx(text.trim());
}

// --- Per-Pokémon page data ---

function writeMonPages(
    target: Target,
    snapshots: MonthSnapshot[],
    formatId: string,
    formatLabel: string,
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
            abilities: topNPercent(d.Abilities, 5),
            items: topNPercent(d.Items, 8),
            moves: topNPercent(d.Moves, 10),
            spreads: topNPercent(d.Spreads, 5),
            teraTypes: topNPercent(d["Tera Types"], 5),
            teammates: topNPercent(d.Teammates, 10),
            counters,
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

function resolveTarget(target: Target): { formatId: string; label: string } | null {
    if (target.formatId !== "champions") return { formatId: target.formatId, label: target.label };
    // Newest regulation that has a Smogon stats id is the live one for reports.
    const candidates = REGULATIONS.filter((r) => r.showdownFormatId).sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
    );
    const reg = candidates[0];
    if (!reg) {
        console.warn("  no Champions regulation has a showdownFormatId yet — skipping champions");
        return null;
    }
    return { formatId: reg.showdownFormatId as string, label: reg.displayName };
}

async function processTarget(target: Target): Promise<void> {
    const resolved = resolveTarget(target);
    if (!resolved) return;
    const { formatId, label } = resolved;
    console.log(`\n${target.slug} (${formatId}) — ${label}`);

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
        const ids = writeMonPages(target, snapshots, formatId, label);
        monIds = new Set(ids);
        const indexPath = join(MONS_DIR, "index.json");
        const index = JSON.parse(readFileSync(indexPath, "utf-8"));
        index[target.slug] = { formatId, formatLabel: label, dataThrough, ids };
        writeFileSync(indexPath, `${JSON.stringify(index, null, 4)}\n`);
        console.log(`  wrote ${ids.length} per-Pokémon data files`);
    }

    const lead = renderLead(trends, label);
    const tables = renderTables(trends, target, monIds);
    const series = renderSeriesForLlm(snapshots, trends);
    const narrative = await generateNarrative(label, target.mode, tables, series);

    const body = [
        lead,
        "",
        tables,
        "",
        narrative ?? "> _Narrative analysis pending editorial review._",
        "",
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
