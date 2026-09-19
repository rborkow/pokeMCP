import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FakeJev } from "../jev/client.js";
import { SAMPLE_TEAM_PASTE } from "../team.js";
import { triageLosses, trimLog } from "./triage-losses.js";

describe("triage_losses", () => {
    it("grades each loss with Jev and renders the cause histogram", async () => {
        const fake = new FakeJev({
            cause: {
                type: "choice",
                choice: "wrong_lead",
                probabilities: { wrong_lead: 0.6, hax: 0.4 },
                confidence: 0.6,
            },
            avoidable: { type: "noul", noul: 0.7 },
        });
        // Pool opponent index 2 beats SAMPLE_TEAM 4/4 at these seeds, so losses are guaranteed.
        const out = await triageLosses(
            {
                paste: SAMPLE_TEAM_PASTE,
                gamesPerOpponent: 4,
                seed: 4,
                maxOpponents: 3,
                maxLosses: 10,
            },
            { jev: fake },
        );
        assert.ok(fake.calls.length >= 1);
        assert.match(out, /\| wrong_lead \| \d+ \|/);
        assert.match(out, /Avoidable by better lead\/play: \d+%/);
        for (const call of fake.calls) {
            const state = call.state as { battle_log: string; my_lead: string; opponent: string };
            assert.ok(
                state.battle_log.length <= 4000,
                `trimmed log was ${state.battle_log.length} chars`,
            );
            assert.match(state.my_lead, / \+ /);
            assert.ok(typeof state.opponent === "string" && state.opponent.length > 0);
        }
    });
    it("without Jev reports the loss count and a note", async () => {
        const out = await triageLosses(
            {
                paste: SAMPLE_TEAM_PASTE,
                gamesPerOpponent: 4,
                seed: 4,
                maxOpponents: 3,
            },
            { jev: null },
        );
        assert.match(out, /4 losses/);
        assert.match(out, /_Jev not configured \(TYPESAFE_API_KEY\)_/);
    });
    it("trimLog keeps only battle events and caps at 4000 chars", () => {
        const noisy = [
            "|player|p1|Me|",
            "|teamsize|p1|6",
            "|start",
            ...Array.from({ length: 4000 }, () => "|move|p1a: Rillaboom|Fake Out|p2b|"),
            "|turn|2",
            "|: Anything else",
        ];
        const trimmed = trimLog(noisy);
        assert.ok(trimmed.length <= 4000);
        assert.ok(trimmed.endsWith("...[truncated]"));
        const short = trimLog(["|turn|1", "|jibberish|x", "|move|p1a: X|Tackle|p2b|", "|win|P1"]);
        assert.equal(short, "|turn|1\n|move|p1a: X|Tackle|p2b|\n|win|P1");
    });
});
