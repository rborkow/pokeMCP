import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CURRENT_REGULATION } from "./regulation.js";
import { currentFingerprints, getRun, listRuns, saveRun } from "./memory.js";
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "./team.js";

const team = parseTeamInput({ paste: SAMPLE_TEAM_PASTE });
const oneGame = {
    seed: 1,
    winner: "p1" as const,
    turns: 1,
    p1Lead: ["Staraptor"],
    p2Lead: ["Staraptor"],
    log: ["|win|P1"],
};
const artifact = () => ({
    kind: "matchup" as const,
    regulation: CURRENT_REGULATION,
    format: "test",
    parameters: { games: 1, seed: 1, policy: "random" as const },
    team,
    opponents: [{ source: "test", sets: team, seed: 1 }],
    result: {
        series: { games: 1, p1Wins: 1, p2Wins: 0, ties: 0, results: [oneGame], leadStats: [] },
    },
    rawInput: {},
    fingerprints: currentFingerprints(),
});

describe("durable memory", () => {
    it("uses a cwd-independent root, validates IDs, and detects tampering", () => {
        const old = process.env.CHAMPIONS_MEMORY_ROOT;
        const root = mkdtempSync(join(tmpdir(), "champions-memory-"));
        process.env.CHAMPIONS_MEMORY_ROOT = root;
        try {
            const id = saveRun(artifact());
            assert.equal(getRun(id).id, id);
            assert.equal(listRuns().items.length, 1);
            assert.throws(() => getRun("../nope"), /Invalid/);
            const path = join(root, "runs", id, "run.json");
            const raw = JSON.parse(readFileSync(path, "utf8"));
            raw.artifact.team[0].species = "Tampered";
            writeFileSync(path, JSON.stringify(raw));
            assert.throws(() => getRun(id), /integrity/);
            assert.equal(listRuns().warnings.length, 1);
        } finally {
            if (old === undefined) delete process.env.CHAMPIONS_MEMORY_ROOT;
            else process.env.CHAMPIONS_MEMORY_ROOT = old;
            rmSync(root, { recursive: true, force: true });
        }
    });
});
