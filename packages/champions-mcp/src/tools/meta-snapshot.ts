import { CURRENT_REGULATION, regulationStatus } from "../regulation.js";
import { CHAMPIONS_FORMAT_ID } from "../showdown.js";
import { aggregateUsage, loadEvents } from "../tournaments.js";
import { latestUsage, loadUsageFromDir, usageRanking } from "../usage.js";
import type { ToolDefinition } from "./registry.js";
import { sourceLine } from "./source.js";

const PREVIOUS_FORMAT_ID = "gen9championsvgc2026regmb";
const SNAPSHOT_DAYS = 30;

/** One-call digest: regulation, ladder usage, tournament top-cut usage, and data freshness. */
export async function metaSnapshot(_args: Record<string, unknown>): Promise<string> {
    const now = new Date();
    const status = regulationStatus(now);
    const blobs = loadUsageFromDir();
    let blob = latestUsage(blobs, CHAMPIONS_FORMAT_ID);
    let previousRegulation = false;
    if (!blob) {
        blob = latestUsage(blobs, PREVIOUS_FORMAT_ID);
        previousRegulation = true;
    }

    const lines: string[] = [];
    lines.push(`**Champions meta snapshot** — ${now.toISOString().slice(0, 10)}`);
    lines.push("");
    lines.push(sourceLine());
    lines.push(
        `**Regulation:** ${CURRENT_REGULATION.displayName} — ${status.state}, ${status.daysLeft} days left`,
    );

    if (blob) {
        const ranking = usageRanking(blob, 20)
            .map((r, i) => `${i + 1}. ${r.pokemon} ${r.usage}%`)
            .join(" · ");
        lines.push(
            `**Ladder usage:** ${blob.format} ${blob.month} (cutoff ${blob.cutoff})${previousRegulation ? " — ⚠️ previous regulation" : ""}`,
            ranking,
        );
    } else {
        lines.push(
            "**Ladder usage:** none cached. Run `bun run --cwd packages/champions-mcp fetch-usage`.",
        );
    }

    const cutoff = now.getTime() - SNAPSHOT_DAYS * 86_400_000;
    const events = loadEvents().filter((e) => new Date(e.date).getTime() >= cutoff);
    const usage = aggregateUsage(events).slice(0, 20);
    lines.push(
        `**Tournament top-cut (last ${SNAPSHOT_DAYS}d, ${events.length} events):**`,
        usage.length
            ? usage.map((u, i) => `${i + 1}. ${u.name} ${u.pct}%`).join(" · ")
            : "_No cached events in window._",
    );

    lines.push("");
    lines.push("**Freshness**");
    lines.push("- Showdown sim: see source line above (refresh: `bun run champions:vendor`)");
    lines.push(
        blob
            ? `- Ladder usage: ${blob.month}${previousRegulation ? " (⚠️ previous regulation — M-C month not published yet)" : ""} — refresh: \`bun run --cwd packages/champions-mcp fetch-usage\``
            : "- Ladder usage: not cached — run `bun run --cwd packages/champions-mcp fetch-usage`",
    );
    lines.push(
        events.length > 0
            ? `- Tournaments: newest cached ${events[0].date.slice(0, 10)} — refresh: \`bun run fetch-tournaments\``
            : "- Tournaments: none cached in window — run `bun run fetch-tournaments` at repo root",
    );

    return lines.join("\n");
}

export const metaSnapshotTool: ToolDefinition = {
    name: "meta_snapshot",
    description:
        "One-call digest: regulation status, top-20 ladder usage, top-20 tournament top-cut usage (30d), and data freshness. Call at the start of every team-building session.",
    schema: {},
    execute: (args: Record<string, unknown>) => metaSnapshot(args),
};
