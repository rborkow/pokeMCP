import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAMPIONS_FORMAT_ID } from "../showdown.js";

const here = dirname(fileURLToPath(import.meta.url));
let sha = "unknown";
try {
    sha = readFileSync(join(here, "..", "..", "vendor", "SHOWDOWN_SHA"), "utf-8").trim();
} catch {
    // vendor marker missing: report 'unknown' rather than fail the whole server
}

/** One-line provenance footer every tool appends so the agent can cite it. */
export function sourceLine(extra = ""): string {
    return `_Source: pokemon-showdown @ ${sha}, format ${CHAMPIONS_FORMAT_ID}${extra ? `; ${extra}` : ""}_`;
}
