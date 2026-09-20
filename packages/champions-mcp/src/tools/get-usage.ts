import { z } from "zod";
import { PREVIOUS_FORMAT_ID } from "../regulation.js";
import { CHAMPIONS_FORMAT_ID, championsDex } from "../showdown.js";
import {
    latestUsage,
    loadUsageFromDir,
    topOf,
    topSpreads,
    type UsageBlob,
    usageRanking,
} from "../usage.js";
import type { ToolDefinition } from "./registry.js";

function header(blob: UsageBlob): string {
    return `**Usage — ${blob.format} (${blob.month}, cutoff ${blob.cutoff}, ${blob.battles.toLocaleString("en-US")} battles)**\n_Source: smogon.com/stats chaos dump, cached locally in packages/champions-mcp/data/usage_`;
}

/** Showdown's toID: lowercase, strip everything non-alphanumeric. */
function toId(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Display-name index per blob, built once (WeakMap so old blobs can be GC'd).
const nameIndexes = new WeakMap<UsageBlob, Map<string, string>>();

function resolvePokemon(blob: UsageBlob, query: string): string | undefined {
    let index = nameIndexes.get(blob);
    if (!index) {
        index = new Map(Object.keys(blob.pokemon).map((n) => [toId(n), n]));
        nameIndexes.set(blob, index);
    }
    return index.get(toId(query));
}

/** Smogon dumps key items/moves/abilities by id; render the champions-dex name. */
const DEX_TABLES = {
    Items: championsDex.items,
    Moves: championsDex.moves,
    Abilities: championsDex.abilities,
} as const;

function displayName(field: keyof typeof DEX_TABLES, id: string): string {
    const entry = DEX_TABLES[field].get(id);
    return entry?.exists && entry.name ? entry.name : id;
}

type UsageArgs = {
    type: "ranking" | "pokemon" | "teammates" | "counters";
    pokemon?: string;
    limit?: number;
    format?: string;
};

export async function getUsage(args: UsageArgs): Promise<string> {
    const blobs = loadUsageFromDir();
    let blob = latestUsage(blobs, args.format ?? CHAMPIONS_FORMAT_ID);
    let note = "";
    if (!blob && !args.format) {
        blob = latestUsage(blobs, PREVIOUS_FORMAT_ID);
        note =
            "\n⚠️ No Reg M-C usage published yet — showing the last Reg M-B month (previous regulation). Treat as prior, not current.";
    }
    if (!blob) {
        return "No usage data cached. Run `bun run --cwd packages/champions-mcp fetch-usage`.";
    }
    const limit = args.limit ?? 10;
    const target = args.pokemon ? (resolvePokemon(blob, args.pokemon) ?? args.pokemon) : "";
    const fmt = (rows: { key: string; pct: number }[], kind?: keyof typeof DEX_TABLES) =>
        rows.map((r) => `${kind ? displayName(kind, r.key) : r.key} ${r.pct}%`).join(", ");
    // Single shared branch: every per-Pokémon view reports a missing Pokémon alike.
    if (args.type !== "ranking" && !blob.pokemon[target]) {
        return `${header(blob)}${note}\n\n${target} not in this month's data (usage below the 0.5% cache cutoff, or check the Showdown display name).`;
    }
    switch (args.type) {
        case "ranking":
            return `${header(blob)}${note}\n\n${usageRanking(blob, limit)
                .map((r, i) => `${i + 1}. ${r.pokemon} — ${r.usage}%`)
                .join("\n")}`;
        case "pokemon": {
            const p = target;
            const e = blob.pokemon[p];
            return [
                header(blob) + note,
                "",
                `**${p}** — ${Math.round(e.usage * 1000) / 10}% usage`,
                `- Items: ${fmt(topOf(blob, p, "Items", limit), "Items")}`,
                `- Abilities: ${fmt(topOf(blob, p, "Abilities", 3), "Abilities")}`,
                `- Moves: ${fmt(topOf(blob, p, "Moves", limit), "Moves")}`,
                `- Spreads (Nature:HP/Atk/Def/SpA/SpD/Spe Stat Points): ${topSpreads(blob, p, limit)
                    .map((s) => `${s.spread} ${s.pct}%`)
                    .join(", ")}`,
                `- Teammates: ${fmt(topOf(blob, p, "Teammates", limit))}`,
            ].join("\n");
        }
        case "teammates":
            return `${header(blob)}${note}\n\n${topOf(blob, target, "Teammates", limit)
                .map((r) => `- ${r.key} ${r.pct}%`)
                .join("\n")}`;
        case "counters": {
            const cc = blob.pokemon[target]?.["Checks and Counters"] ?? {};
            // Smogon's rating: (p − 4·d) × 100, where p = fraction of encounters the counter wins, d = std dev
            const rows = Object.entries(cc)
                .map(([name, { n, p, d }]) => ({
                    name,
                    score: (p - 4 * d) * 100,
                    n: Math.round(n),
                }))
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
            return `${header(blob)}${note}\n\n${rows
                .map((r) => `- ${r.name} — score ${r.score.toFixed(1)} (n=${r.n})`)
                .join("\n")}`;
        }
    }
}

export const getUsageTool: ToolDefinition = {
    name: "get_usage",
    description:
        "Smogon ladder usage for the current Champions regulation: ranking, per-Pokémon profile (items/moves/Stat Point spreads/teammates), teammates, checks & counters. Falls back to the previous regulation with a warning until the new month is published.",
    schema: {
        type: z.enum(["ranking", "pokemon", "teammates", "counters"]),
        pokemon: z
            .string()
            .optional()
            .describe("Showdown display name; case and spaces insensitive"),
        limit: z.number().int().min(1).max(100).optional(),
        format: z
            .string()
            .optional()
            .describe("Override Showdown format id (default: current regulation)"),
    },
    execute: (args) => getUsage(args as UsageArgs),
};
