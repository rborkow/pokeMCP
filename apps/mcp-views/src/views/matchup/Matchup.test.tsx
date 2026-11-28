import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { MATCHUP_FIXTURE } from "./fixture.js";
import { Matchup, MatchupGrid } from "./Matchup.js";
import { isMatchupData, type MatchupData } from "./types.js";

const clone = (): MatchupData => structuredClone(MATCHUP_FIXTURE);
const grid = (data: MatchupData, trickRoom = false, selected: [number, number] | null = null) =>
    render(
        <MatchupGrid
            data={data}
            trickRoom={trickRoom}
            selected={selected && { member: selected[0], opponent: selected[1] }}
        />,
    ).replaceAll("<wbr/>", "");
/** The verdict word shown in each cell, in display order. */
const verdicts = (html: string) =>
    [...html.matchAll(/class="mu-verdict">([^<]*)</g)].map((match) => match[1]);
/** The row headers in display order, as "Name|Role". */
const rowHeads = (html: string) =>
    [...html.matchAll(/class="mu-rowhead"><span class="mu-name">([^<]*)<\/span><span[^>]*>([^<]*)</g)].map(
        (match) => `${match[1]}|${match[2]}`,
    );

describe("isMatchupData", () => {
    it("accepts a real result", () => {
        expect(isMatchupData(MATCHUP_FIXTURE)).toBe(true);
    });

    it("rejects anything the grid could not render", () => {
        expect(isMatchupData(null)).toBe(false);
        expect(isMatchupData("plan")).toBe(false);
        expect(isMatchupData({})).toBe(false);
        expect(isMatchupData({ ...MATCHUP_FIXTURE, matrix: undefined })).toBe(false);
        expect(isMatchupData({ ...MATCHUP_FIXTURE, matrix: [] })).toBe(false);
        expect(isMatchupData({ ...MATCHUP_FIXTURE, threats: "none" })).toBe(false);
        expect(isMatchupData({ ...MATCHUP_FIXTURE, lead: { pokemon: [] } })).toBe(false);

        const ragged = clone();
        ragged.matrix[3].pop();
        expect(isMatchupData(ragged)).toBe(false);

        const noSpeed = clone() as unknown as { matrix: Record<string, unknown>[][] };
        delete noSpeed.matrix[2][4].speed;
        expect(isMatchupData(noSpeed)).toBe(false);

        const badHit = clone() as unknown as { matrix: Record<string, unknown>[][] };
        badHit.matrix[0][0].deals = "lots";
        expect(isMatchupData(badHit)).toBe(false);
    });

    it("accepts a pair with no calculated damage", () => {
        const data = clone();
        data.matrix[0][0].deals = null;
        data.matrix[0][0].takes = null;
        expect(isMatchupData(data)).toBe(true);
    });
});

describe("MatchupGrid", () => {
    it("draws six rows of six cells under a header row", () => {
        const html = grid(MATCHUP_FIXTURE);
        expect(html.match(/<tr/g)?.length).toBe(7);
        expect(html.match(/class="mu-cell /g)?.length).toBe(36);
        expect(html.match(/<th scope="col" class="mu-col"/g)?.length).toBe(6);
        for (const row of MATCHUP_FIXTURE.matrix) expect(html).toContain(row[0].pokemon);
        for (const cell of MATCHUP_FIXTURE.matrix[0]) expect(html).toContain(cell.target);
    });

    it("says each verdict in words, not colour alone, with both damage ranges", () => {
        const html = grid(MATCHUP_FIXTURE);
        const counts = (word: string) => verdicts(html).filter((v) => v === word).length;
        const expected = (word: string) =>
            MATCHUP_FIXTURE.matrix.flat().filter((cell) => cell.verdict === word).length;
        for (const word of ["Counter", "Check", "Trade", "Loses"]) {
            expect(expected(word)).toBeGreaterThan(0);
            expect(counts(word)).toBe(expected(word));
        }
        // Garchomp into Sneasler: Earthquake 123.87–147.1%, Close Combat back for 59.02–69.4%.
        // Garchomp moves second but survives and KOs: a Check (it once wrongly read Loses).
        expect(html).toContain("Garchomp against Sneasler: Check. Deals 124–147%, takes 59–69%.");
    });

    it("switches every cell to its Trick Room verdict", () => {
        const normal = verdicts(grid(MATCHUP_FIXTURE));
        const trickRoom = verdicts(grid(MATCHUP_FIXTURE, true));
        const count = (list: string[], word: string) => list.filter((v) => v === word).length;
        const cells = MATCHUP_FIXTURE.matrix.flat();
        for (const word of ["Counter", "Check", "Trade", "Loses"]) {
            expect(count(normal, word)).toBe(cells.filter((c) => c.verdict === word).length);
            expect(count(trickRoom, word)).toBe(
                cells.filter((c) => c.trickRoomVerdict === word).length,
            );
        }
        expect(trickRoom).not.toEqual(normal);

        const html = grid(MATCHUP_FIXTURE, true);
        const flipped = cells.filter((c) => c.verdict !== c.trickRoomVerdict).length;
        expect(html.match(/mu-changed/g)?.length).toBe(flipped);
        expect(html).toContain(`Trick Room changes ${flipped} of 36 verdicts`);
        const sample = cells.find((c) => c.verdict !== c.trickRoomVerdict);
        expect(sample).toBeDefined();
        expect(html).toContain(
            `${sample?.pokemon} against ${sample?.target}: ${sample?.trickRoomVerdict}, ${sample?.verdict} at normal Speed.`,
        );
        expect(html).toMatch(/aria-pressed="true"[^>]*>Trick Room</);
        expect(grid(MATCHUP_FIXTURE)).toMatch(/aria-pressed="true"[^>]*>Normal Speed</);
    });

    it("switches the threats' answers with the toggle", () => {
        // A threat in the summary whose answers differ between normal Speed and Trick Room.
        const names = (list: { pokemon: string }[]) => list.map((a) => a.pokemon).join(",");
        const threat = MATCHUP_FIXTURE.threats
            .slice(0, 3)
            .find((t) => names(t.answers) !== names(t.trickRoomAnswers));
        expect(threat).toBeDefined();
        if (!threat) return;
        const lost = threat.answers.find(
            (a) => !threat.trickRoomAnswers.some((b) => b.pokemon === a.pokemon),
        );
        const line = (html: string) =>
            html.match(new RegExp(`${threat.pokemon}</span>.*?</li>`))?.[0] ?? "";
        if (lost) {
            expect(line(grid(MATCHUP_FIXTURE))).toContain(lost.pokemon);
            expect(line(grid(MATCHUP_FIXTURE, true))).not.toContain(`${lost.pokemon} (`);
        }
        if (!threat.trickRoomAnswers.length)
            expect(line(grid(MATCHUP_FIXTURE, true))).toContain("No answer");
    });

    it("marks the leads, the back and the bench, by slot", () => {
        const html = grid(MATCHUP_FIXTURE);
        expect(rowHeads(html)).toEqual([
            "Incineroar|Lead",
            "Talonflame|Lead",
            "Garchomp|Back",
            "Rotom-Wash|Back",
            "Gardevoir|Bench",
            "Kingambit|Bench",
        ]);
        expect(html).toMatch(/<dt>Bring<\/dt><dd>Incineroar, Talonflame, Garchomp, Rotom-Wash</);
        expect(html).toMatch(/<dt>Lead<\/dt><dd>Incineroar \+ Talonflame/);
        expect(html).toMatch(/<dt>Back<\/dt><dd>Garchomp \+ Rotom-Wash</);
    });

    it("orders their six by threat rank and leads with the unanswered one", () => {
        const html = grid(MATCHUP_FIXTURE);
        const ranks = [...html.matchAll(/class="mu-rank[^"]*">Threat (\d)</g)].map((m) => m[1]);
        expect(ranks).toEqual(["1", "2", "3", "4", "5", "6"]);
        // Nobody on the six answers Dragonite, so the headline says "team", not "four".
        expect(html).toContain('<h1 class="view-title">Your team has no answer to Dragonite</h1>');
        const benched = clone();
        benched.threats[0].answers = [{ member: 3, pokemon: "Gardevoir", verdict: "Check" }];
        expect(grid(benched)).toContain("Your four have no answer to Dragonite</h1>");
    });

    it("tells two slots with the same name apart", () => {
        // Species Clause is not checked by the tool, so names can repeat.
        const data = clone();
        for (const row of data.matrix) for (const cell of row) cell.pokemon = "Garchomp";
        expect(rowHeads(grid(data)).map((head) => head.split("|")[1])).toEqual([
            "Lead",
            "Lead",
            "Back",
            "Back",
            "Bench",
            "Bench",
        ]);
    });

    it("shows a selected cell's moves, KO text and Speed under each field", () => {
        const empty = grid(MATCHUP_FIXTURE);
        expect(empty).toContain("Select a matchup");
        expect(empty).not.toContain("Who moves first");

        const html = grid(MATCHUP_FIXTURE, false, [1, 2]);
        expect(html.match(/aria-pressed="true" aria-controls/g)?.length).toBe(1);
        expect(html).toContain("<strong>Earthquake</strong> 123.87–147.1%");
        expect(html).toContain("guaranteed OHKO");
        expect(html).toContain("<strong>Close Combat</strong> 59.02–69.4%");
        expect(html).toContain("Speed 169 vs 189");
        for (const field of ["Normal", "Your Tailwind", "Their Tailwind", "Trick Room"])
            expect(html).toContain(`<dt>${field}</dt>`);
        expect(html).toContain("They move first");
        expect(html).toContain("You move first");
        // Support for this pair is listed; hypothetical-field notes are not repeated.
        expect(html).toContain("Incineroar Intimidate: Garchomp vs Sneasler");
        expect(html).not.toContain("hypothetical field");
        // Weather set by the attacker's own ability.
        expect(grid(MATCHUP_FIXTURE, false, [0, 0])).toContain("Sun weather");
    });

    it("renders a pair with no calculated damage, and an out-of-range selection", () => {
        const data = clone();
        data.matrix[1][2].deals = null;
        data.matrix[1][2].takes = null;
        const html = grid(data, false, [1, 2]);
        expect(html).toContain("Deals none, takes none.");
        expect(html.match(/No damaging move calculated/g)?.length).toBe(2);
        expect(grid(data, false, [9, 9])).toContain("Select a matchup");
    });

    it("renders names typed by the user as text, never as markup", () => {
        const img = "<img src=x onerror=alert(1)>";
        const script = "<script>x</script>";
        const data = clone();
        for (const row of data.matrix) {
            for (const cell of row) {
                if (cell.member === 1) cell.pokemon = img;
                if (cell.opponent === 2) cell.target = script;
            }
        }
        const cell = data.matrix[1][2];
        if (cell.deals) Object.assign(cell.deals, { move: img, knockOut: script, conditions: img });
        if (cell.takes) Object.assign(cell.takes, { move: script, knockOut: img });
        data.bring.pokemon = data.bring.pokemon.map(() => img);
        data.lead.pokemon = data.lead.pokemon.map(() => script);
        for (const threat of data.threats) {
            threat.pokemon = script;
            for (const answer of [...threat.answers, ...threat.trickRoomAnswers])
                answer.pokemon = img;
        }
        for (const note of data.speedNotes) note.detail = `${img}${script}`;
        for (const set of [...data.team, ...data.opponent])
            Object.assign(set, { pokemon: img, item: script, ability: img, nature: script });
        data.formatName = script;

        for (const trickRoom of [false, true]) {
            const html = grid(data, trickRoom, [1, 2]);
            expect(html).not.toContain("<img");
            expect(html).not.toContain("<script");
            expect(html).toContain("&lt;img src=x onerror=alert(1)>");
            expect(html).toContain("&lt;script>x&lt;/script>");
        }
    });
});

describe("Matchup", () => {
    it("starts at normal Speed with nothing selected, or in the state it is given", () => {
        const html = render(<Matchup data={MATCHUP_FIXTURE} />);
        expect(html).toMatch(/aria-pressed="true"[^>]*>Normal Speed</);
        expect(html).toContain("Select a matchup");
        const preset = render(
            <Matchup
                data={MATCHUP_FIXTURE}
                initialTrickRoom
                initialSelected={{ member: 1, opponent: 2 }}
            />,
        );
        expect(preset).toMatch(/aria-pressed="true"[^>]*>Trick Room</);
        expect(preset).toContain("Who moves first");
    });
});
