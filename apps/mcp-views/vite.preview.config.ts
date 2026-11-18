/**
 * Local preview of every view with fixture data and no host:
 * `bun run preview`, then open /preview.html?view=type-chart&theme=dark.
 */
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
    root: "src/preview",
    plugins: [preact()],
    server: { port: 5180 },
});
