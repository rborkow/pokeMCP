import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The vendored pokemon-showdown build is CommonJS; load it through
 * createRequire so this ESM package can use it. Paths are resolved relative
 * to this file so the server works from any cwd (Hermes spawns it as stdio).
 */
const here = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(here, "..", "vendor", "pokemon-showdown", "dist", "sim");
const require = createRequire(import.meta.url);

function requireVendor(id: string): unknown {
    try {
        return require(id);
    } catch (error) {
        throw new Error(
            "pokemon-showdown not vendored; run `bun run champions:vendor` from the repo root",
            {
                cause: error,
            },
        );
    }
}

export const showdown: any = requireVendor(VENDOR);
export const Dex: any = showdown.Dex;
export const Teams: any = showdown.Teams;
export const TeamValidator: any = showdown.TeamValidator;
export const BattleStream: any = showdown.BattleStream;
export const getPlayerStreams: any = showdown.getPlayerStreams;
export const RandomPlayerAI: any = (
    requireVendor(join(VENDOR, "tools", "random-player-ai")) as {
        RandomPlayerAI: unknown;
    }
).RandomPlayerAI;

/** Current Champions doubles ladder format on Showdown (Reg M-C). */
export const CHAMPIONS_FORMAT_ID = "gen9championsvgc2026regmc";
/** Showdown mod that carries the live Champions dex (post-Mega forms, Champions balance). */
export const CHAMPIONS_MOD = "champions";
export const championsDex = Dex.mod(CHAMPIONS_MOD);
