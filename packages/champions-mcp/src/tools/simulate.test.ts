import { strict as assert } from "node:assert";
import { describe, it, after } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const memoryRoot = mkdtempSync(join(tmpdir(), "champions-sim-tests-"));
process.env.CHAMPIONS_MEMORY_ROOT = memoryRoot;
after(() => rmSync(memoryRoot, { recursive: true, force: true }));
import { parseTeamInput, SAMPLE_TEAM_PASTE } from "../team.js";
import { evaluateTeam, simulateMatchup } from "./simulate.js";

describe("simulate tools", () => {
    it("simulate_matchup reports win rate and best leads", async () => {
        const out = await simulateMatchup({
            paste: SAMPLE_TEAM_PASTE,
            opponentPaste: SAMPLE_TEAM_PASTE,
            games: 10,
            seed: 3,
        });
        assert.match(out, /Win rate: \d+\/10/);
        assert.match(out, /Leads/);
    });
    it("evaluate_team runs the pool and ranks opponents by loss rate", async () => {
        const out = await evaluateTeam({
            paste: SAMPLE_TEAM_PASTE,
            gamesPerOpponent: 4,
            seed: 3,
            maxOpponents: 3,
        });
        assert.match(out, /Overall: \d+\/\d+/);
        assert.match(out, /Hardest opponents/);
    });
    it("evaluate_team defaults to the sampling policy and is deterministic per args", async () => {
        const run = () =>
            evaluateTeam({
                paste: SAMPLE_TEAM_PASTE,
                gamesPerOpponent: 2,
                seed: 3,
                maxOpponents: 2,
            });
        const out = await run();
        assert.match(out, /heuristic-sample-policy players/);
        assert.equal(
            out.replace(/Run ID: `[^`]+`/, "Run ID: `<id>"),
            (await run()).replace(/Run ID: `[^`]+`/, "Run ID: `<id>"),
        );
        assert.match(out, /Each game samples a random bring\/lead \(seeded\)/);
    });
    it("simulate_matchup rejects a one-set team instead of dying mid-battle", async () => {
        await assert.rejects(
            simulateMatchup({
                sets: [{ species: "Rillaboom", moves: ["Fake Out"] }],
                opponentSets: [{ species: "Rillaboom", moves: ["Fake Out"] }],
                games: 1,
            }),
            /exactly 6/,
        );
    });
    it("simulate_matchup rejects a short opponent team", async () => {
        await assert.rejects(
            simulateMatchup({
                paste: SAMPLE_TEAM_PASTE,
                opponentSets: [{ species: "Rillaboom", moves: ["Fake Out"] }],
                games: 1,
            }),
            /exactly 6/,
        );
    });
    it("evaluate_team rejects a five-set team", async () => {
        const fiveSets = JSON.parse(JSON.stringify(parseTeamInput({ paste: SAMPLE_TEAM_PASTE })));
        fiveSets.pop();
        await assert.rejects(evaluateTeam({ sets: fiveSets, gamesPerOpponent: 1 }), /exactly 6/);
    });
});
