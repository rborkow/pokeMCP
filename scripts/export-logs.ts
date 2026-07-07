#!/usr/bin/env npx tsx
/**
 * Export interaction logs from R2 for fine-tuning data preparation
 *
 * Talks to the Cloudflare REST API directly (wrangler v4 has no
 * `r2 object list`), so it requires:
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_API_TOKEN (with R2 read access)
 *
 * Usage:
 *   npm run export-logs                    # Export last 7 days
 *   npm run export-logs -- --days 30       # Export last 30 days
 *   npm run export-logs -- --all           # Export all logs
 *   npm run export-logs -- --format jsonl  # Output as JSONL (default)
 *   npm run export-logs -- --format csv    # Output as CSV
 *
 * Output: Creates files in ./exported-logs/
 *   - interactions.jsonl: Raw interaction data
 *   - fine-tuning.jsonl: Formatted for fine-tuning (OpenAI format)
 *   - stats.json: Summary statistics
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDatePrefixes, parseR2ListPage, type R2ListPage } from "./lib/r2-export.js";

interface InteractionLog {
    id: string;
    timestamp: number;
    tool: string;
    args: Record<string, unknown>;
    response: string;
    responseTimeMs: number;
    success: boolean;
    format?: string;
    pokemonMentioned?: string[];
}

interface FineTuningExample {
    messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }>;
}

interface ExportStats {
    totalLogs: number;
    byTool: Record<string, number>;
    byFormat: Record<string, number>;
    successRate: number;
    avgResponseTimeMs: number;
    dateRange: {
        earliest: string;
        latest: string;
    };
    exportedAt: string;
}

const BUCKET_NAME = "pokemcp-interaction-logs";
const OUTPUT_DIR = "./exported-logs";
const API_BASE = "https://api.cloudflare.com/client/v4";

interface CloudflareAuth {
    accountId: string;
    apiToken: string;
}

function requireCloudflareAuth(): CloudflareAuth {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    const missing = [
        ...(accountId ? [] : ["CLOUDFLARE_ACCOUNT_ID"]),
        ...(apiToken ? [] : ["CLOUDFLARE_API_TOKEN"]),
    ];
    if (missing.length > 0) {
        console.error(
            `Missing required environment variable(s): ${missing.join(", ")}.\n` +
                "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (an API token with R2 " +
                "read access) before running export-logs.",
        );
        process.exit(1);
    }

    return { accountId: accountId as string, apiToken: apiToken as string };
}

function parseArgs(): { days: number; all: boolean; format: "jsonl" | "csv" } {
    const args = process.argv.slice(2);
    let days = 7;
    let all = false;
    let format: "jsonl" | "csv" = "jsonl";

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--days" && args[i + 1]) {
            days = Number.parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === "--all") {
            all = true;
        } else if (args[i] === "--format" && args[i + 1]) {
            format = args[i + 1] as "jsonl" | "csv";
            i++;
        }
    }

    return { days, all, format };
}

/**
 * List all object keys under a prefix via the Cloudflare REST API, following
 * cursor pagination. Any HTTP or API failure throws — an empty array means the
 * prefix is genuinely empty, never a swallowed error.
 */
async function listR2Objects(auth: CloudflareAuth, prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor: string | undefined;

    do {
        const url = new URL(
            `${API_BASE}/accounts/${auth.accountId}/r2/buckets/${BUCKET_NAME}/objects`,
        );
        url.searchParams.set("prefix", prefix);
        url.searchParams.set("per_page", "1000");
        if (cursor) {
            url.searchParams.set("cursor", cursor);
        }

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${auth.apiToken}` },
        });
        const bodyText = await response.text();

        if (!response.ok) {
            throw new Error(
                `Failed to list R2 objects under "${prefix}": ` +
                    `HTTP ${response.status} ${response.statusText}\n${bodyText}`,
            );
        }

        let page: R2ListPage;
        try {
            page = parseR2ListPage(JSON.parse(bodyText));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to list R2 objects under "${prefix}": ${message}`);
        }

        keys.push(...page.keys);
        cursor = page.cursor;
    } while (cursor);

    return keys;
}

/**
 * Download one log object via the Cloudflare REST API. Throws on any HTTP
 * failure or unparseable body — a missing or corrupt object must abort the
 * export instead of silently shrinking it.
 */
async function downloadR2Object(auth: CloudflareAuth, key: string): Promise<InteractionLog> {
    const objectPath = key.split("/").map(encodeURIComponent).join("/");
    const response = await fetch(
        `${API_BASE}/accounts/${auth.accountId}/r2/buckets/${BUCKET_NAME}/objects/${objectPath}`,
        { headers: { Authorization: `Bearer ${auth.apiToken}` } },
    );
    const bodyText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Failed to download "${key}": HTTP ${response.status} ${response.statusText}\n${bodyText}`,
        );
    }

    try {
        return JSON.parse(bodyText) as InteractionLog;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Downloaded "${key}" but it is not valid JSON: ${message}`);
    }
}

function formatAsFineTuning(log: InteractionLog): FineTuningExample {
    // Create a system prompt that describes the tool's purpose
    const toolDescriptions: Record<string, string> = {
        lookup_pokemon:
            "You are a Pokemon database assistant. Look up Pokemon information including stats, types, abilities, and tier.",
        validate_moveset:
            "You are a Pokemon moveset validator. Check if a Pokemon can legally learn the specified moves.",
        validate_team:
            "You are a Pokemon team validator. Verify team composition follows format rules.",
        suggest_team_coverage:
            "You are a Pokemon team building assistant. Analyze type coverage and suggest improvements.",
        get_popular_sets:
            "You are a Pokemon competitive assistant. Provide popular sets and usage statistics.",
        get_meta_threats:
            "You are a Pokemon metagame analyst. List the top threats in the current metagame.",
        get_teammates:
            "You are a Pokemon team building assistant. Suggest good teammates for a Pokemon.",
        get_checks_counters:
            "You are a Pokemon competitive assistant. Identify checks and counters for specific Pokemon.",
        get_metagame_stats: "You are a Pokemon metagame analyst. Provide format-level statistics.",
        query_strategy:
            "You are a Pokemon strategy expert. Answer questions about competitive strategies using Smogon knowledge.",
        search_strategic_content:
            "You are a Pokemon strategy researcher. Search for specific strategic content.",
    };

    const systemPrompt =
        toolDescriptions[log.tool] || "You are a helpful Pokemon competitive assistant.";

    // Format the user message based on the tool and args
    let userMessage = `Tool: ${log.tool}\n`;
    if (log.args.pokemon) userMessage += `Pokemon: ${log.args.pokemon}\n`;
    if (log.args.format) userMessage += `Format: ${log.args.format}\n`;
    if (log.args.query) userMessage += `Query: ${log.args.query}\n`;
    if (log.args.moves) userMessage += `Moves: ${(log.args.moves as string[]).join(", ")}\n`;
    if (log.args.team) userMessage += `Team: ${JSON.stringify(log.args.team)}\n`;
    if (log.args.current_team)
        userMessage += `Current Team: ${(log.args.current_team as string[]).join(", ")}\n`;

    return {
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage.trim() },
            { role: "assistant", content: log.response },
        ],
    };
}

function calculateStats(logs: InteractionLog[]): ExportStats {
    const byTool: Record<string, number> = {};
    const byFormat: Record<string, number> = {};
    let successCount = 0;
    let totalResponseTime = 0;
    let earliest = Number.POSITIVE_INFINITY;
    let latest = Number.NEGATIVE_INFINITY;

    for (const log of logs) {
        // By tool
        byTool[log.tool] = (byTool[log.tool] || 0) + 1;

        // By format
        const format = log.format || "unknown";
        byFormat[format] = (byFormat[format] || 0) + 1;

        // Success rate
        if (log.success) successCount++;

        // Response time
        totalResponseTime += log.responseTimeMs;

        // Date range
        if (log.timestamp < earliest) earliest = log.timestamp;
        if (log.timestamp > latest) latest = log.timestamp;
    }

    return {
        totalLogs: logs.length,
        byTool,
        byFormat,
        successRate: logs.length > 0 ? successCount / logs.length : 0,
        avgResponseTimeMs: logs.length > 0 ? totalResponseTime / logs.length : 0,
        dateRange: {
            earliest:
                earliest === Number.POSITIVE_INFINITY ? "N/A" : new Date(earliest).toISOString(),
            latest: latest === Number.NEGATIVE_INFINITY ? "N/A" : new Date(latest).toISOString(),
        },
        exportedAt: new Date().toISOString(),
    };
}

async function main() {
    const { days, all, format } = parseArgs();
    const auth = requireCloudflareAuth();

    console.log("Exporting interaction logs...");
    console.log(`  Days: ${all ? "all" : days}`);
    console.log(`  Format: ${format}`);
    console.log();

    // Create output directory
    if (!existsSync(OUTPUT_DIR)) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Get date prefixes to scan
    const prefixes = getDatePrefixes(days, all);
    console.log(`Scanning ${prefixes.length} date prefix(es)...`);

    // List all objects
    const allKeys: string[] = [];
    for (const prefix of prefixes) {
        const keys = await listR2Objects(auth, prefix);
        allKeys.push(...keys);
        console.log(`  ${prefix}: ${keys.length > 0 ? `${keys.length} logs` : "no logs"}`);
    }

    console.log(`\nFound ${allKeys.length} total log files`);

    if (allKeys.length === 0) {
        console.log("No logs to export.");
        return;
    }

    // Download and parse logs
    console.log("Downloading logs...");
    const logs: InteractionLog[] = [];

    for (const key of allKeys) {
        logs.push(await downloadR2Object(auth, key));
        if (logs.length % 100 === 0) {
            console.log(`  Downloaded ${logs.length}/${allKeys.length}...`);
        }
    }

    console.log(`Successfully parsed ${logs.length} logs`);

    // Sort by timestamp
    logs.sort((a, b) => a.timestamp - b.timestamp);

    // Calculate stats
    const stats = calculateStats(logs);
    console.log("\nStatistics:");
    console.log(`  Total logs: ${stats.totalLogs}`);
    console.log(`  Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`  Avg response time: ${stats.avgResponseTimeMs.toFixed(0)}ms`);
    console.log(`  Date range: ${stats.dateRange.earliest} to ${stats.dateRange.latest}`);
    console.log("  By tool:");
    for (const [tool, count] of Object.entries(stats.byTool)) {
        console.log(`    ${tool}: ${count}`);
    }

    // Write output files
    const timestamp = new Date().toISOString().split("T")[0];

    if (format === "jsonl") {
        // Raw interactions JSONL
        const interactionsPath = join(OUTPUT_DIR, `interactions-${timestamp}.jsonl`);
        const interactionsContent = logs.map((log) => JSON.stringify(log)).join("\n");
        writeFileSync(interactionsPath, interactionsContent);
        console.log(`\nWrote raw interactions to: ${interactionsPath}`);

        // Fine-tuning JSONL (OpenAI format)
        const fineTuningPath = join(OUTPUT_DIR, `fine-tuning-${timestamp}.jsonl`);
        const fineTuningContent = logs
            .filter((log) => log.success) // Only include successful interactions
            .map((log) => JSON.stringify(formatAsFineTuning(log)))
            .join("\n");
        writeFileSync(fineTuningPath, fineTuningContent);
        console.log(`Wrote fine-tuning data to: ${fineTuningPath}`);
    } else if (format === "csv") {
        // CSV format
        const csvPath = join(OUTPUT_DIR, `interactions-${timestamp}.csv`);
        const headers = [
            "id",
            "timestamp",
            "tool",
            "format",
            "success",
            "responseTimeMs",
            "pokemonMentioned",
        ];
        const csvRows = logs.map((log) =>
            [
                log.id,
                new Date(log.timestamp).toISOString(),
                log.tool,
                log.format || "",
                log.success,
                log.responseTimeMs,
                (log.pokemonMentioned || []).join(";"),
            ].join(","),
        );
        writeFileSync(csvPath, [headers.join(","), ...csvRows].join("\n"));
        console.log(`\nWrote CSV to: ${csvPath}`);
    }

    // Stats JSON
    const statsPath = join(OUTPUT_DIR, `stats-${timestamp}.json`);
    writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`Wrote stats to: ${statsPath}`);

    console.log("\nExport complete!");
}

main().catch((error) => {
    console.error("Export failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
