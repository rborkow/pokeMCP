/**
 * Escaping for text that `scripts/generate-reports.ts` writes into report MDX.
 *
 * MDX compiles `{…}` to a JavaScript expression and `<…>` to JSX, and the report pages are
 * prerendered, so either would run during `next build`. Text from Limitless (event names,
 * player names, decklists), Smogon and the Claude API must go through one of these first.
 * `apps/teambuilder/src/__tests__/report-mdx-safety.test.ts` fails CI if a generated report
 * still contains JSX, an expression or an import/export statement.
 */

/**
 * Narrative prose written by the model. Blocks JSX, expressions and ESM (a line starting with
 * `import` or `export` is a JavaScript module statement in MDX) but keeps Markdown formatting
 * (emphasis, lists, links), because the narrative is meant to be formatted.
 */
export function escapeMdx(text: string): string {
    return text
        .replace(/</g, "&lt;")
        .replace(/\{/g, "&#123;")
        .replace(/\}/g, "&#125;")
        .replace(/^([ \t]*)(import|export)\b/gm, (_m, indent: string, word: string) => {
            // Write the first letter as a character reference: it renders the same, but the
            // line no longer starts with the keyword.
            return `${indent}&#${word.charCodeAt(0)};${word.slice(1)}`;
        });
}

/**
 * Third-party or generated text placed in an inline slot: a heading, a table cell or link
 * text. It renders exactly as given:
 * - JSX and expressions are blocked (`<`, `>`, `{`, `}` become entities)
 * - Markdown can't format it or add links or images (backslash-escaped punctuation)
 * - `|` can't split a table cell, and a line break can't end the heading or table row
 */
export function escapeMdxInline(text: string): string {
    return text
        .replace(/\s*[\r\n]+\s*/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/[`*_[\]~|#!]/g, (c) => `\\${c}`)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\{/g, "&#123;")
        .replace(/\}/g, "&#125;");
}
