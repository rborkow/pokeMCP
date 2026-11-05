import { createHash, randomUUID } from "node:crypto";
import {
    existsSync,
    mkdirSync,
    readdirSync,
    renameSync,
    rmSync,
    readFileSync,
    writeFileSync,
    statSync,
    openSync,
    closeSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CURRENT_REGULATION } from "./regulation.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fingerprintKeys = [
    "vendorSha",
    "vendorDist",
    "vendorChampionsData",
    "vendorFormats",
    "vendorPackage",
    "vendorLock",
    "package",
    "runner",
    "policy",
    "simulation",
    "regulation",
    "nodeRuntime",
    "team",
    "bridge",
    "integration",
    "memory",
    "memoryTools",
    "rootLock",
    "vendorData",
    "vendorLib",
] as const;
const set = z
    .object({
        species: z.string().min(1),
        item: z.string().optional(),
        ability: z.string().optional(),
        moves: z.array(z.string()).max(4),
        nature: z.string().optional(),
        evs: z
            .object({
                hp: z.number().int().min(0).max(32),
                atk: z.number().int().min(0).max(32),
                def: z.number().int().min(0).max(32),
                spa: z.number().int().min(0).max(32),
                spd: z.number().int().min(0).max(32),
                spe: z.number().int().min(0).max(32),
            })
            .partial()
            .optional(),
        level: z.number().int().min(1).max(100),
    })
    .strict();
const regulation = z
    .object({
        id: z.string().min(1),
        displayName: z.string().min(1),
        startDate: z.string(),
        endDate: z.string(),
        announcementUrl: z.string().url(),
        level: z.number().int().positive(),
        teamSize: z.literal(6),
        bringCount: z.literal(4),
        statPointsTotal: z.literal(66),
        statPointsPerStat: z.literal(32),
    })
    .strict();
const parameters = z
    .object({
        games: z.number().int().positive(),
        seed: z.number().int().nonnegative(),
        policy: z.enum(["random", "heuristic", "heuristic-sample"]),
        gamesPerOpponent: z.number().int().positive().optional(),
    })
    .strict();
const game = z
    .object({
        seed: z.number().int().nonnegative(),
        winner: z.enum(["p1", "p2", "tie"]),
        turns: z.number().int().nonnegative(),
        p1Lead: z.array(z.string()),
        p2Lead: z.array(z.string()),
        log: z.array(z.string()),
    })
    .strict();
const series = z
    .object({
        games: z.number().int().positive(),
        p1Wins: z.number().int().nonnegative(),
        p2Wins: z.number().int().nonnegative(),
        ties: z.number().int().nonnegative(),
        results: z.array(game),
        leadStats: z.array(
            z
                .object({
                    lead: z.string(),
                    games: z.number().int().nonnegative(),
                    wins: z.number().int().nonnegative(),
                })
                .strict(),
        ),
    })
    .strict()
    .superRefine((v, c) => {
        if (
            v.results.length !== v.games ||
            v.p1Wins + v.p2Wins + v.ties !== v.games ||
            v.p1Wins !== v.results.filter((r) => r.winner === "p1").length ||
            v.p2Wins !== v.results.filter((r) => r.winner === "p2").length ||
            v.ties !== v.results.filter((r) => r.winner === "tie").length
        )
            c.addIssue({
                code: z.ZodIssueCode.custom,
                message: "series summary does not match games",
            });
    });
const matchupResult = z.object({ series }).strict();
const evaluationRecord = z
    .object({
        source: z.string().min(1),
        wins: z.number().int().nonnegative(),
        games: z.number().int().positive(),
        series,
    })
    .strict()
    .superRefine((v, c) => {
        if (v.series.games !== v.games || v.series.p1Wins !== v.wins)
            c.addIssue({ code: z.ZodIssueCode.custom, message: "evaluation record mismatch" });
    });
const evaluationResult = z
    .object({
        records: z.array(evaluationRecord),
        totalGames: z.number().int().positive(),
        totalWins: z.number().int().nonnegative(),
    })
    .strict()
    .superRefine((v, c) => {
        if (
            v.totalGames !== v.records.reduce((n, r) => n + r.games, 0) ||
            v.totalWins !== v.records.reduce((n, r) => n + r.wins, 0)
        )
            c.addIssue({ code: z.ZodIssueCode.custom, message: "evaluation summary mismatch" });
    });
const base = {
    schemaVersion: z.literal(2),
    id: z.string().regex(ID),
    createdAt: z.string().datetime(),
    regulation,
    format: z.string().min(1),
    parameters,
    team: z.array(set).length(6),
    opponents: z
        .array(
            z
                .object({
                    source: z.string().min(1),
                    sets: z.array(set).length(6),
                    seed: z.number().int().nonnegative(),
                })
                .strict(),
        )
        .min(1),
    rawInput: z.record(z.unknown()),
    fingerprints: z
        .record(z.string().regex(/^[a-f0-9]{64}$/))
        .refine(
            (x) =>
                fingerprintKeys.every((key) => key in x) &&
                Object.keys(x).every(
                    (key) => key === "opponentPool" || fingerprintKeys.includes(key as any),
                ),
            "complete runtime fingerprints required",
        ),
};
const runShape = z.discriminatedUnion("kind", [
    z.object({ ...base, kind: z.literal("matchup"), result: matchupResult }).strict(),
    z.object({ ...base, kind: z.literal("evaluation"), result: evaluationResult }).strict(),
]);
const runSchema = runShape.superRefine((run, context) => {
    const fail = (message: string) => context.addIssue({ code: z.ZodIssueCode.custom, message });
    const groups =
        run.kind === "matchup"
            ? [run.result.series]
            : run.result.records.map((record) => record.series);
    if (groups.length !== run.opponents.length) fail("opponent/result count mismatch");
    if (
        run.kind === "matchup" &&
        (run.opponents.length !== 1 || run.parameters.gamesPerOpponent !== undefined)
    )
        fail("invalid matchup parameters");
    if (
        run.kind === "evaluation" &&
        (!run.parameters.gamesPerOpponent || !run.fingerprints.opponentPool)
    )
        fail("evaluation provenance missing");
    const total = groups.reduce((n, group) => n + group.games, 0);
    if (total !== run.parameters.games) fail("parameter game count mismatch");
    groups.forEach((group, i) => {
        const opponent = run.opponents[i];
        if (!opponent) return;
        const expectedSeed = run.parameters.seed + (run.kind === "evaluation" ? i * 1000 : 0);
        if (
            opponent.seed !== expectedSeed ||
            group.results.some((game, j) => game.seed !== expectedSeed + j)
        )
            fail("game seed schedule mismatch");
        if (
            run.kind === "evaluation" &&
            (group.games !== run.parameters.gamesPerOpponent ||
                run.result.records[i].source !== opponent.source)
        )
            fail("evaluation opponent mapping mismatch");
    });
});
export type RunArtifact = z.infer<typeof runSchema>;
export interface ListResult<T> {
    items: T[];
    warnings: string[];
    truncated: boolean;
}
export function memoryRoot(): string {
    return resolve(
        process.env.CHAMPIONS_MEMORY_ROOT || join(packageRoot, "data", "experiment-memory"),
    );
}
function safeId(id: string): string {
    if (!ID.test(id)) throw new Error("Invalid run or finding id.");
    return id;
}
function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => [k, canonical(v)]),
        );
    return value;
}
const digest = (value: unknown) =>
    createHash("sha256")
        .update(JSON.stringify(canonical(value)))
        .digest("hex");
const hashFile = (path: string) => {
    if (!existsSync(path) || !statSync(path).isFile())
        throw new Error(`Required fingerprint input is missing: ${path}`);
    return createHash("sha256").update(readFileSync(path)).digest("hex");
};
function hashTree(root: string): string {
    if (!existsSync(root)) throw new Error(`Required fingerprint tree is missing: ${root}`);
    const files: string[] = [];
    const walk = (dir: string) =>
        readdirSync(dir, { withFileTypes: true })
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((e) =>
                e.isDirectory() ? walk(join(dir, e.name)) : files.push(join(dir, e.name)),
            );
    walk(root);
    return digest(files.map((f) => [f.slice(root.length + 1), hashFile(f)]));
}
/** Hash the pinned executable, Champions data, bridge, dependencies, regulation and runtime. */
export function currentFingerprints(poolContent?: unknown): Record<string, string> {
    const v = join(packageRoot, "vendor", "pokemon-showdown");
    const fp: Record<string, string> = {
        vendorSha: hashFile(join(packageRoot, "vendor", "SHOWDOWN_SHA")),
        vendorDist: hashTree(join(v, "dist", "sim")),
        vendorData: hashTree(join(v, "dist", "data")),
        vendorLib: hashTree(join(v, "dist", "lib")),
        team: hashFile(join(packageRoot, "src", "team.ts")),
        bridge: hashFile(join(packageRoot, "src", "showdown.ts")),
        integration: hashFile(join(packageRoot, "src", "tools", "simulate.ts")),
        memory: hashFile(join(packageRoot, "src", "memory.ts")),
        memoryTools: hashFile(join(packageRoot, "src", "tools", "memory.ts")),
        rootLock: hashFile(join(packageRoot, "..", "..", "bun.lock")),
        vendorChampionsData: hashTree(join(v, "data", "mods", "champions")),
        vendorFormats: hashFile(join(v, "dist", "config", "formats.js")),
        vendorPackage: hashFile(join(v, "package.json")),
        vendorLock: hashFile(join(v, "package-lock.json")),
        package: hashFile(join(packageRoot, "package.json")),
        runner: hashFile(join(packageRoot, "src", "sim", "runner.ts")),
        policy: hashFile(join(packageRoot, "src", "sim", "heuristic-player.ts")),
        simulation: hashTree(join(packageRoot, "src", "sim")),
        regulation: hashFile(join(packageRoot, "src", "regulation.ts")),
        nodeRuntime: digest(process.version),
    };
    if (poolContent !== undefined) fp.opponentPool = digest(poolContent);
    return fp;
}
const startupFingerprint = currentFingerprints();
export function assertRuntimeStable(before: Record<string, string>): void {
    const after = currentFingerprints();
    const core = (x: Record<string, string>) => {
        const y = { ...x };
        delete y.opponentPool;
        return y;
    };
    if (
        digest(core(before)) !== digest(core(after)) ||
        digest(core(after)) !== digest(core(startupFingerprint))
    )
        throw new Error("Runtime files changed during this process; refusing to record or replay.");
}
const runPath = (id: string) => join(memoryRoot(), "runs", safeId(id), "run.json");
const envelope = (artifact: RunArtifact) => ({ artifact, integrity: digest(artifact) });
export function saveRun(input: Omit<RunArtifact, "schemaVersion" | "id" | "createdAt">): string {
    const before = currentFingerprints();
    const full = runSchema.parse({
        ...input,
        schemaVersion: 2,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
    });
    const beforeCore = { ...before };
    delete beforeCore.opponentPool;
    const storedCore = { ...full.fingerprints };
    delete storedCore.opponentPool;
    if (digest(storedCore) !== digest(beforeCore))
        throw new Error("Run fingerprints do not match the pre-run runtime");
    assertRuntimeStable(before);
    const root = join(memoryRoot(), "runs");
    mkdirSync(root, { recursive: true });
    const temp = join(root, `.${full.id}.${process.pid}.${randomUUID()}`);
    try {
        mkdirSync(temp);
        writeFileSync(join(temp, "run.json"), JSON.stringify(envelope(full), null, 2) + "\n", {
            flag: "wx",
        });
        renameSync(temp, join(root, full.id));
    } catch (e) {
        rmSync(temp, { recursive: true, force: true });
        throw new Error("Could not persist completed experiment run", { cause: e });
    }
    return full.id;
}
export function getRun(id: string): RunArtifact {
    safeId(id);
    let raw: unknown;
    try {
        raw = JSON.parse(readFileSync(runPath(id), "utf8"));
    } catch (e) {
        throw new Error(`Run ${id} is missing or corrupt`, { cause: e });
    }
    const e = z
        .object({ artifact: z.unknown(), integrity: z.string().length(64) })
        .strict()
        .parse(raw);
    if (digest(e.artifact) !== e.integrity)
        throw new Error(`Run ${id} failed integrity verification`);
    const run = runSchema.parse(e.artifact);
    if (run.id !== id) throw new Error("Run ID does not match artifact path");
    return run;
}
export function listRuns(
    limit = 50,
): ListResult<Pick<RunArtifact, "id" | "kind" | "createdAt" | "regulation" | "parameters">> {
    const items: ListResult<any>["items"] = [];
    const warnings: string[] = [];
    const root = join(memoryRoot(), "runs");
    if (!existsSync(root)) return { items, warnings, truncated: false };
    for (const id of readdirSync(root).filter((x) => ID.test(x))) {
        try {
            const r = getRun(id);
            items.push({
                id: r.id,
                kind: r.kind,
                createdAt: r.createdAt,
                regulation: r.regulation,
                parameters: r.parameters,
            });
        } catch (e) {
            warnings.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const cap = Math.max(1, Math.min(limit, 200));
    return { items: items.slice(0, cap), warnings, truncated: items.length > cap };
}
export function saveReplay(runId: string, evidence: unknown): void {
    getRun(runId);
    const dir = join(memoryRoot(), "runs", safeId(runId), "replays");
    mkdirSync(dir, { recursive: true });
    const id = randomUUID();
    const temp = join(dir, `.${id}`);
    writeFileSync(
        temp,
        JSON.stringify({ id, createdAt: new Date().toISOString(), evidence }, null, 2) + "\n",
        { flag: "wx" },
    );
    renameSync(temp, join(dir, `${id}.json`));
}
const findingSchema = z
    .object({
        schemaVersion: z.literal(2),
        id: z.string().regex(ID),
        revision: z.number().int().nonnegative(),
        createdAt: z.string().datetime(),
        regulation: z.string().min(1),
        claim: z.string().min(1),
        evidenceRunIds: z.array(z.string().regex(ID)).min(1),
        limitations: z.string().min(1),
        status: z.enum(["hypothesis", "supported", "superseded"]),
        testOnly: z.boolean(),
    })
    .strict();
export type Finding = z.infer<typeof findingSchema>;
const findingPath = (id: string, rev: number) =>
    join(memoryRoot(), "findings", safeId(id), `revision-${rev}.json`);
const verifyEvidence = (ids: string[]) =>
    ids.flatMap((id) => {
        try {
            getRun(id);
            return [];
        } catch (e) {
            return [`evidence ${id}: ${e instanceof Error ? e.message : String(e)}`];
        }
    });
export function recordFinding(
    input: Omit<Finding, "schemaVersion" | "id" | "createdAt" | "revision"> & { reviseId?: string },
): string {
    input.evidenceRunIds.forEach((id) => {
        if (getRun(id).regulation.id !== input.regulation)
            throw new Error("Finding regulation differs from evidence regulation");
    });
    const id = input.reviseId ? safeId(input.reviseId) : randomUUID();
    const dir = join(memoryRoot(), "findings", id);
    mkdirSync(dir, { recursive: true });
    const lockPath = join(dir, ".lock");
    let fd: number;
    try {
        fd = openSync(lockPath, "wx");
    } catch {
        throw new Error(`Finding ${id} is being revised concurrently`);
    }
    try {
        const revisions = readdirSync(dir)
            .filter((x) => /^revision-\d+\.json$/.test(x))
            .map((x) => Number(x.slice(9, -5)));
        const rev = revisions.length ? Math.max(...revisions) + 1 : 0;
        if (input.reviseId && !revisions.length)
            throw new Error(`Finding ${id} has no revision to revise`);
        const f = findingSchema.parse({
            claim: input.claim,
            regulation: input.regulation,
            evidenceRunIds: input.evidenceRunIds,
            limitations: input.limitations,
            status: input.status,
            testOnly: input.testOnly,
            schemaVersion: 2,
            id,
            revision: rev,
            createdAt: new Date().toISOString(),
        });
        const temp = join(dir, `.${rev}.${randomUUID()}`);
        writeFileSync(temp, JSON.stringify(f, null, 2) + "\n", { flag: "wx" });
        renameSync(temp, findingPath(id, rev));
        return id;
    } finally {
        closeSync(fd);
        rmSync(lockPath, { force: true });
    }
}
export function getFinding(id: string): Finding {
    safeId(id);
    const dir = join(memoryRoot(), "findings", id);
    try {
        const revs = readdirSync(dir)
            .filter((x) => /^revision-\d+\.json$/.test(x))
            .map((x) => Number(x.slice(9, -5)));
        if (!revs.length) throw new Error("no revisions");
        return findingSchema.parse(
            JSON.parse(readFileSync(findingPath(id, Math.max(...revs)), "utf8")),
        );
    } catch (e) {
        throw new Error(`Finding ${id} is missing or corrupt`, { cause: e });
    }
}
export function listFindings(
    regulation?: string,
    includeTestOnly = false,
): ListResult<Finding & { stale: boolean; evidenceWarnings: string[] }> {
    const items: (Finding & { stale: boolean; evidenceWarnings: string[] })[] = [];
    const warnings: string[] = [];
    const root = join(memoryRoot(), "findings");
    if (!existsSync(root)) return { items, warnings, truncated: false };
    for (const id of readdirSync(root).filter((x) => ID.test(x))) {
        try {
            const f = getFinding(id);
            if ((!regulation || f.regulation === regulation) && (includeTestOnly || !f.testOnly))
                items.push({
                    ...f,
                    stale:
                        f.regulation !== CURRENT_REGULATION.id ||
                        Date.now() > Date.parse(CURRENT_REGULATION.endDate + "T23:59:59Z"),
                    evidenceWarnings: verifyEvidence(f.evidenceRunIds),
                });
        } catch (e) {
            warnings.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    return { items, warnings, truncated: false };
}
export { CURRENT_REGULATION };
