import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { FakeJev } from "../jev/client.js";
import { SAMPLE_TEAM_PASTE } from "../team.js";
import { gradeLeads } from "./grade-leads.js";

/** Pick a lead-pair key the implementation will actually generate. */
function pairKey(a: string, b: string): string {
    return [a, b].sort().join(" + ");
}

describe("grade_leads", () => {
    it("sends 15 lead options to Jev and reports pick, sim best and disagreement", async () => {
        const pick = pairKey("Gholdengo", "Staraptor");
        const fake = new FakeJev({
            lead: {
                type: "choice",
                choice: pick,
                probabilities: { [pick]: 0.6 },
                confidence: 0.62,
            },
            bring_mega: { type: "noul", noul: 0.8 },
        });
        const out = await gradeLeads(
            {
                paste: SAMPLE_TEAM_PASTE,
                opponentPaste: SAMPLE_TEAM_PASTE,
                games: 6,
                seed: 5,
            },
            { jev: fake },
        );
        const lead = fake.calls[0].questions.lead;
        assert.equal(lead.type, "choice");
        if (lead.type === "choice") {
            assert.equal(Object.keys(lead.criteria).length, 15);
        }
        const rows = out
            .split("\n")
            .filter((line) => /^\| /.test(line) && !line.includes("sim wins/games"));
        assert.equal(rows.length, 15);
        assert.match(
            out,
            new RegExp(`Jev pick: ${pick.replace(" + ", "\\ \\+\\ ")} \\(confidence 0\\.62\\)`),
        );
        assert.match(out, /Sim best: .+ \(\d+\/\d+\)/);
        assert.match(out, /Disagreement: (yes|no)/);
        assert.match(out, /Bring Mega: 0\.80/);
    });
    it("without Jev still prints the sim lead table and a note", async () => {
        const out = await gradeLeads(
            {
                paste: SAMPLE_TEAM_PASTE,
                opponentPaste: SAMPLE_TEAM_PASTE,
                games: 6,
                seed: 5,
            },
            { jev: null },
        );
        const rows = out
            .split("\n")
            .filter((line) => /^\| /.test(line) && !line.includes("sim wins/games"));
        assert.equal(rows.length, 15);
        assert.match(out, /_Jev not configured \(TYPESAFE_API_KEY\)_/);
        assert.match(out, /Sim best: .+ \(\d+\/\d+\)/);
    });
});
