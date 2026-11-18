/**
 * Builds ONE view (named by the VIEW environment variable) into a single
 * self-contained HTML file: scripts and styles inlined, because a host renders
 * the view in a sandbox that may load nothing else. build.ts runs this once
 * per view.
 */
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const view = process.env.VIEW;
if (!view) throw new Error("Set VIEW to the view to build, e.g. VIEW=type-chart");

export default defineConfig({
    root: `src/views/${view}`,
    plugins: [preact(), viteSingleFile()],
    build: {
        outDir: `../../../dist/${view}`,
        emptyOutDir: true,
        minify: true,
        cssMinify: true,
        reportCompressedSize: false,
    },
});
