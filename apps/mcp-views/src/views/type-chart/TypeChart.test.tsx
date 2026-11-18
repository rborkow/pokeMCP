import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { TYPE_CHART_FIXTURE } from "./fixture.js";
import { TypeChart } from "./TypeChart.js";

describe("TypeChart", () => {
    it("draws a row per attacking type and a column per team member", () => {
        const html = render(<TypeChart data={TYPE_CHART_FIXTURE} />);
        expect(html.match(/<tr/g)?.length).toBe(1 + TYPE_CHART_FIXTURE.matchups.length);
        const text = html.replaceAll("<wbr/>", "");
        for (const member of TYPE_CHART_FIXTURE.team) expect(text).toContain(member.name);
    });

    it("says each cell's state in words, not colour alone", () => {
        const html = render(<TypeChart data={TYPE_CHART_FIXTURE} />);
        expect(html).toMatch(/class="cell weak">Weak</);
        expect(html).toMatch(/class="cell immune">Immune</);
        expect(html).toMatch(/class="cell resist">Resists</);
    });

    it("leads with the team's shared weaknesses", () => {
        const html = render(<TypeChart data={TYPE_CHART_FIXTURE} />);
        const [first] = TYPE_CHART_FIXTURE.sharedWeaknesses;
        expect(html).toMatch(new RegExp(`<h1 class="view-title">[^<]*${first}`));
    });

    it("renders names typed by the user as text, never as markup", () => {
        const hostile = "<img src=x onerror=alert(1)>";
        const html = render(
            <TypeChart data={{ ...TYPE_CHART_FIXTURE, notFound: [hostile, "<script>x</script>"] }} />,
        );
        expect(html).not.toContain("<img");
        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;img src=x onerror=alert(1)>");
    });
});
