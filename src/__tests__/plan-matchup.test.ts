import { strict as assert } from "node:assert";
import { it } from "node:test";
import { verdict } from "../connector/counters.js";
import type { Hit } from "../connector/matchup.js";
import {
    type Cell,
    chooseLead,
    combinations,
    PLAN_SCORE,
    planMatchup,
    scoreBring,
    scoreLead,
} from "../connector/plan.js";

const hit = (likely: number | null, possible = likely): Hit => ({
    attacker: "A",
    defender: "B",
    move: "Test",
    minPercent: 50,
    maxPercent: 60,
    knockOut: "",
    hits: possible,
    likelyKoHits: likely,
    chancePercent: null,
});
function matrix(): Cell[][] {
    return Array.from({ length: 6 }, (_, i) =>
        Array.from({ length: 6 }, (_, j) => ({
            member: i,
            opponent: j,
            pokemon: `M${i}`,
            target: `T${j}`,
            deals: hit(2),
            takes: hit(3),
            speed: {
                member: 100,
                threat: 90,
                normal: "faster",
                myTailwind: "faster",
                theirTailwind: "slower",
                trickRoom: "slower",
            },
            verdict: "Check",
            trickRoomVerdict: "Loses",
        })),
    );
}
it("avoids four individually strong members that all lose to one sweeper", () => {
    const m = matrix();
    for (let i = 0; i < 4; i++) m[i][0].verdict = "Loses";
    for (let i = 4; i < 6; i++) for (let j = 1; j < 6; j++) m[i][j].verdict = "Trade";
    const all = combinations([0, 1, 2, 3, 4, 5], 4)
        .map((ids) => scoreBring(ids, m))
        .sort((a, b) => b.score - a.score);
    assert.ok(all[0].indices.some((i) => i >= 4));
    assert.ok(all[0].score > scoreBring([0, 1, 2, 3], m).score);
    assert.ok(
        scoreBring([0, 1, 2, 3], m).reasons.some((r) => r.kind === "sweeper" && r.points === -60),
    );
});
it("lead maximises the worst case, including an adversarial opponent pair", () => {
    const m = matrix();
    m[0][0].takes = hit(1);
    m[0][1].takes = hit(1);
    m[2][0].deals = hit(1);
    m[3][1].deals = hit(1);
    const chosen = chooseLead([0, 1, 2, 3], m);
    const worsts = combinations([0, 1, 2, 3], 2).map((mine) =>
        Math.min(
            ...combinations([0, 1, 2, 3, 4, 5], 2).map(
                (theirs) => scoreLead(mine, theirs, m).score,
            ),
        ),
    );
    assert.equal(chosen.score, Math.max(...worsts));
    assert.deepEqual(chosen.indices, [1, 2]);
    // 4 from the OHKOs and Speed, plus 2 for each of the four cells' likely 2HKO.
    assert.equal(chosen.score, 12);
    assert.equal(chosen.score, scoreLead(chosen.indices, chosen.opponent, m).score);
});
it("unproven incoming KO remains dangerous in bring and lead scoring", () => {
    const m = matrix();
    const c = m[0][0];
    c.takes = hit(null, 1);
    c.deals = hit(2);
    c.verdict = verdict(c.takes, c.deals, c.speed.normal);
    assert.equal(c.verdict, "Loses");
    const dangerousBring = scoreBring([0, 1, 2, 3], m).score;
    const dangerousLead = scoreLead([0, 1], [0, 1], m).score;
    for (let i = 1; i < 4; i++) m[i][0].verdict = "Loses";
    const uncovered = scoreBring([0, 1, 2, 3], m).score;
    c.takes = null;
    c.verdict = verdict(c.takes, c.deals, c.speed.normal);
    assert.ok(scoreBring([0, 1, 2, 3], m).score > uncovered);
    assert.ok(scoreLead([0, 1], [0, 1], m).score > dangerousLead);
    assert.ok(Number.isFinite(dangerousBring));
    c.deals = hit(null, 1);
    assert.match(scoreLead([0, 1], [0, 1], m).reasons[0].detail, /likely OHKO 0/);
});
it("support is bounded and requires selected provider and beneficiary", () => {
    const m = matrix();
    const support = [
        { provider: 4, member: 0, opponent: 0, kind: "Tailwind", detail: "order improves" },
    ];
    const base = scoreBring([0, 1, 2, 3], m).score;
    assert.equal(scoreBring([0, 1, 2, 3], m, support).score, base);
    assert.equal(scoreBring([0, 1, 2, 4], m, [...support, ...support]).score, base + 2);
});
const plain = (pokemon: string, moves: string[], spe = 0) => ({
    pokemon,
    moves,
    nature: "Hardy",
    statPoints: { spe },
    ability: "Pressure",
    item: "none",
});
it("Trick Room changes a threat answer in a calculated full matrix", async () => {
    const slow = plain("Garchomp", ["Dragon Claw"]);
    const fast = plain("Garchomp", ["Dragon Claw"], 32);
    const result = await planMatchup(
        { team: Array(6).fill(slow), opponent: Array(6).fill(fast) },
        {} as Env,
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.data.threats[0].answers.length, 0);
    assert.equal(result.data.threats[0].trickRoomAnswers.length, 6);
    assert.equal(result.data.matrix[0][0].speed.myTailwind, "faster");
});
it("measures full six-by-six calls with four attacks per Pokémon", async () => {
    const team = [
        plain("Garchomp", ["Earthquake", "Dragon Claw", "Rock Slide", "Crunch"]),
        plain("Sneasler", ["Close Combat", "Dire Claw", "Quick Attack", "Shadow Claw"]),
        plain("Kingambit", ["Iron Head", "Kowtow Cleave", "Sucker Punch", "Brick Break"]),
        plain("Blastoise", ["Surf", "Ice Beam", "Dark Pulse", "Flash Cannon"]),
        plain("Charizard", ["Heat Wave", "Air Slash", "Dragon Pulse", "Solar Beam"]),
        plain("Gardevoir", ["Psychic", "Moonblast", "Shadow Ball", "Thunderbolt"]),
    ];
    for (const mode of ["cold", "warm", "Intimidate"]) {
        const intimidate = mode === "Intimidate";
        const members = team.map((s, i) =>
            i === 0 && intimidate ? { ...s, ability: "Intimidate" } : s,
        );
        const cpu = process.cpuUsage();
        const start = performance.now();
        const result = await planMatchup({ team: members, opponent: team }, {} as Env);
        const usage = process.cpuUsage(cpu);
        assert.ok(result.ok);
        console.log(
            `plan_matchup ${mode}: CPU ${((usage.user + usage.system) / 1000).toFixed(2)} ms; latency ${(performance.now() - start).toFixed(2)} ms`,
        );
    }
});
it("lead scoring credits likely 2HKOs, which two attackers can finish in one turn", () => {
    const m = matrix();
    const base = scoreLead([0, 1], [0, 1], m).score;
    for (const i of [0, 1]) for (const j of [0, 1]) m[i][j].deals = hit(3);
    // Without the 2HKOs only Speed separates the cells.
    assert.equal(scoreLead([0, 1], [0, 1], m).score, base - 4 * PLAN_SCORE.leadTwoHit);
});
