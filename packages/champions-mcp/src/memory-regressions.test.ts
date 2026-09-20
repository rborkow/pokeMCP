import { strict as assert } from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, after } from "node:test";
import {
    currentFingerprints,
    getRun,
    getFinding,
    recordFinding,
    listFindings,
    listRuns,
} from "./memory.js";
import { simulateMatchup, evaluateTeam } from "./tools/simulate.js";
import { replayRunTool, compareRunsTool } from "./tools/memory.js";
import { SAMPLE_TEAM_PASTE } from "./team.js";

const root = mkdtempSync(join(tmpdir(), "champions-memory-regressions-"));
process.env.CHAMPIONS_MEMORY_ROOT = root;
after(() => rmSync(root, { recursive: true, force: true }));
const canonical = (x: any): any =>
    Array.isArray(x)
        ? x.map(canonical)
        : x && typeof x === "object"
          ? Object.fromEntries(
                Object.entries(x)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([k, v]) => [k, canonical(v)]),
            )
          : x;
function writeArtifact(id: string, artifact: any) {
    const dir = join(root, "runs", id);
    mkdirSync(dir, { recursive: true });
    const integrity = createHash("sha256")
        .update(JSON.stringify(canonical(artifact)))
        .digest("hex");
    writeFileSync(join(dir, "run.json"), JSON.stringify({ artifact, integrity }));
}

test("real engine evidence integrity, replay compatibility, and findings revisions", async (t) => {
    const output = await simulateMatchup({
        paste: SAMPLE_TEAM_PASTE,
        opponentPaste: SAMPLE_TEAM_PASTE,
        games: 1,
        seed: 42,
    });
    const id = /Run ID: `([^`]+)`/.exec(output)![1];
    const original = getRun(id);
    await t.test("unchanged run replays full content", async () => {
        assert.equal(JSON.parse(await replayRunTool.execute({ runId: id })).status, "verified");
    });
    for (const [label, mutate, diagnostic] of [
        ["missing fingerprint", (a: any) => delete a.fingerprints.team, /complete runtime/],
        ["summary mismatch", (a: any) => a.result.series.games++, /summary/],
        ["seed mismatch", (a: any) => a.result.series.results[0].seed++, /seed schedule/],
        ["parameter count mismatch", (a: any) => a.parameters.games++, /parameter game/],
        ["id mismatch", (a: any) => (a.id = randomUUID()), /artifact path/],
        ["invalid policy", (a: any) => (a.parameters.policy = "made-up"), /enum/],
    ] as const) {
        await t.test(label + " rejected with valid checksum", () => {
            const edited = structuredClone(original);
            mutate(edited);
            writeArtifact(id, edited);
            assert.throws(() => getRun(id), diagnostic);
            writeArtifact(id, original);
        });
    }
    await t.test("changed policy fails replay and comparison before simulation", async () => {
        const altered = structuredClone(original);
        altered.id = randomUUID();
        altered.fingerprints.policy = "0".repeat(64);
        writeArtifact(altered.id, altered);
        assert.equal(getRun(altered.id).id, altered.id);
        const result = JSON.parse(await replayRunTool.execute({ runId: altered.id }));
        assert.equal(result.status, "incompatible");
        assert.ok(result.drift.includes("policy"));
        assert.equal(
            JSON.parse(await compareRunsTool.execute({ leftRunId: id, rightRunId: altered.id }))
                .status,
            "incompatible",
        );
    });
    await t.test("truncated artifact reported explicitly", () => {
        writeFileSync(join(root, "runs", id, "run.json"), "{");
        assert.throws(() => getRun(id), /corrupt/);
        assert.ok(listRuns().warnings.length);
        writeArtifact(id, original);
    });
    await t.test("findings enforce regulation, revise, and preserve evidence", () => {
        const input = {
            claim: "Regression only",
            regulation: original.regulation.id,
            evidenceRunIds: [id],
            limitations: "Single test game, no strategic inference",
            status: "hypothesis" as const,
            testOnly: true,
        };
        assert.throws(() => recordFinding({ ...input, regulation: "wrong" }), /regulation/);
        assert.throws(() => recordFinding({ ...input, evidenceRunIds: [randomUUID()] }), /missing/);
        const findingId = recordFinding(input);
        recordFinding({ ...input, claim: "Revised regression only", reviseId: findingId });
        assert.equal(getFinding(findingId).revision, 1);
        assert.equal(
            readdirSync(join(root, "findings", findingId)).filter((x) => x.endsWith(".json"))
                .length,
            2,
        );
        assert.equal(listFindings().items.length, 0);
        assert.equal(listFindings(undefined, true).items[0].claim, "Revised regression only");
        writeFileSync(join(root, "findings", findingId, ".lock"), "test");
        assert.throws(() => recordFinding({ ...input, reviseId: findingId }), /concurrently/);
        rmSync(join(root, "findings", findingId, ".lock"));
        writeFileSync(join(root, "runs", id, "run.json"), "{");
        assert.ok(listFindings(undefined, true).items[0].evidenceWarnings.length);
        writeArtifact(id, original);
    });
    await t.test("fingerprints cover actual data and glue", () => {
        const fingerprints = currentFingerprints();
        for (const key of [
            "vendorData",
            "vendorDist",
            "vendorLib",
            "team",
            "bridge",
            "integration",
            "rootLock",
        ])
            assert.match(fingerprints[key], /^[a-f0-9]{64}$/);
    });
    await t.test("evaluation snapshot replays with unrelated pool identity", async () => {
        const out = await evaluateTeam({
            paste: SAMPLE_TEAM_PASTE,
            gamesPerOpponent: 1,
            maxOpponents: 1,
            seed: 43,
        });
        const evalId = /Run ID: `([^`]+)`/.exec(out)![1];
        const stored = getRun(evalId);
        stored.fingerprints.opponentPool = "0".repeat(64);
        writeArtifact(evalId, stored);
        assert.equal(JSON.parse(await replayRunTool.execute({ runId: evalId })).status, "verified");
    });
    await t.test("storage failure is not returned as successful recording", async () => {
        const blocker = join(root, "not-a-directory");
        writeFileSync(blocker, "x");
        process.env.CHAMPIONS_MEMORY_ROOT = blocker;
        try {
            await assert.rejects(
                simulateMatchup({
                    paste: SAMPLE_TEAM_PASTE,
                    opponentPaste: SAMPLE_TEAM_PASTE,
                    games: 1,
                    seed: 44,
                }),
            );
        } finally {
            process.env.CHAMPIONS_MEMORY_ROOT = root;
        }
    });
});
