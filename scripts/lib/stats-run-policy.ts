/**
 * Shared failure policy for the monthly Smogon stats pipeline scripts
 * (discover-formats.ts, fetch-stats.ts, upload-stats.ts).
 *
 * Principle: a failed run must LOOK failed — non-zero exit code, red workflow
 * step — never a green run that ships stale or broken data.
 */

/**
 * Decide whether a multi-format run (fetch or upload) should exit non-zero.
 *
 * - Zero successes → total failure (full Smogon outage, dead KV token): fail.
 * - More than half failed → too broken to trust: fail.
 * - A minority of failures (e.g. a single format lagging on Smogon's side)
 *   does NOT fail the run — callers must log those loudly instead.
 */
export function shouldFailRun(succeeded: number, failed: number): boolean {
    if (succeeded === 0) return true;
    return failed > succeeded;
}

/**
 * Decide what discover-formats.ts does with the output file when discovery
 * fails: only write the hardcoded bootstrap fallback when NO discovery file
 * exists yet (fresh clone). An existing file is a previously good discovery —
 * clobbering it with the stale fallback list would silently shrink format
 * coverage once the workflow commits it and upload-stats pushes it to KV.
 *
 * Note this only picks the file behavior; a failed discovery always exits
 * non-zero regardless.
 */
export function shouldWriteDiscoveryFallback(existingFilePresent: boolean): boolean {
    return !existingFilePresent;
}
