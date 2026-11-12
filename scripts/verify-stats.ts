/**
 * Verify that `upload-stats` took effect: for every regulation with published
 * usage statistics, the `{format}:_index` key now in KV must describe the same
 * snapshot as the file fetched in this run.
 *
 * This replaces a check that called the retired `/api/tools` endpoint, which
 * has answered `410 Gone` since the July 2026 relaunch and so failed every
 * run after the upload had already succeeded — skipping the tournament fetch
 * and report generation that follow it.
 *
 * Reads KV directly (no dependency on any deployed route) and exits non-zero
 * when a regulation's index is missing, malformed or stale.
 *
 * Usage:
 *   bun run verify-stats                       # production KV
 *   KV_NAMESPACE_ID=xxx bun run verify-stats   # custom namespace
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REGULATIONS } from "../src/regulations/registry.js";
import { checkIndex } from "./lib/verify-index.js";

const KV_NAMESPACE_ID = process.env.KV_NAMESPACE_ID || "58525ad4ec5c454eb3e1ae7586414483";
const CACHE_DIR = join(process.cwd(), "src", "cached-stats");

function kvGet(key: string): string | null {
    try {
        return execFileSync(
            "npx",
            ["wrangler", "kv", "key", "get", "--remote", `--namespace-id=${KV_NAMESPACE_ID}`, key],
            { stdio: ["ignore", "pipe", "pipe"], timeout: 120_000, maxBuffer: 64 * 1024 * 1024 },
        ).toString();
    } catch {
        return null;
    }
}

function main() {
    const targets = REGULATIONS.filter((r) => r.showdownFormatId);
    if (targets.length === 0) {
        console.error("No regulation has published usage statistics configured.");
        process.exit(1);
    }

    let verified = 0;
    const problems: string[] = [];
    for (const regulation of targets) {
        const format = regulation.showdownFormatId as string;
        const file = join(CACHE_DIR, `${format}.json`);
        if (!existsSync(file)) {
            console.log(`- ${regulation.id}: not fetched this run (${format}), skipping`);
            continue;
        }
        const fetched = JSON.parse(readFileSync(file, "utf-8"));
        const problem = checkIndex(format, fetched, kvGet(`${format}:_index`));
        if (problem) {
            problems.push(`${regulation.id}: ${problem}`);
        } else {
            verified++;
            console.log(`✅ ${regulation.id}: KV index matches the ${fetched.date} snapshot`);
        }
    }

    for (const problem of problems) console.error(`::error::${problem}`);
    if (problems.length > 0) process.exit(1);
    if (verified === 0) {
        console.error("::error::No regulation's statistics were fetched, so nothing was verified.");
        process.exit(1);
    }
    console.log(`\nVerified ${verified} regulation index(es) in KV.`);
}

main();
