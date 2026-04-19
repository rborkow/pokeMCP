/**
 * Release stage flag. Drives the BETA badge on the landing status bar and
 * builder header. Set NEXT_PUBLIC_RELEASE_STAGE=stable at build time to
 * retire the badge without touching components.
 */

export type ReleaseStage = "beta" | "stable";

export const RELEASE_STAGE: ReleaseStage =
    process.env.NEXT_PUBLIC_RELEASE_STAGE === "stable" ? "stable" : "beta";

export const IS_BETA = RELEASE_STAGE === "beta";
