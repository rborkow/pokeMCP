/**
 * Type-only stub standing in for pokemon-showdown's sim/dex-species (no runtime code).
 * The extracted data files in src/data/ annotate their tables with
 * `import("../sim/...")` types from the showdown source tree; these stubs keep
 * `tsc --noEmit` green without editing the generated data. Intentionally loose:
 * src/data-loader.ts casts each table to the real application types in src/types.ts,
 * and tightening these against the raw data would break on every re-extraction.
 */
export type SpeciesData = { [k: string]: any };
export type SpeciesDataTable = { [id: string]: SpeciesData };

export type SpeciesFormatsData = { [k: string]: any };
export type SpeciesFormatsDataTable = { [id: string]: SpeciesFormatsData };

export type LearnsetData = { [k: string]: any };
export type LearnsetDataTable = { [id: string]: LearnsetData };
