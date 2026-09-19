import { calcStat, Generations } from "@smogon/calc";

/** @smogon/calc models Pokémon Champions as generation 0 (calcStatChampions). */
export const CHAMPIONS_GEN = Generations.get(0);
export type StatKey = "hp" | "atk" | "def" | "spa" | "spd" | "spe";
export const STAT_KEYS: StatKey[] = ["hp", "atk", "def", "spa", "spd", "spe"];
export type StatPoints = Partial<Record<StatKey, number>>;

export function assertStatPoints(sp: StatPoints): void {
    let total = 0;
    for (const k of STAT_KEYS) {
        const v = sp[k] ?? 0;
        if (!Number.isInteger(v) || v < 0 || v > 32) {
            throw new Error(`${k}: Stat Points must be an integer 0–32 (got ${v})`);
        }
        total += v;
    }
    if (total > 66) throw new Error(`Total Stat Points must be ≤ 66 (got ${total})`);
}

export function championsStats(
    base: Record<StatKey, number>,
    sp: StatPoints,
    nature = "Hardy",
): Record<StatKey, number> {
    assertStatPoints(sp);
    const out = {} as Record<StatKey, number>;
    for (const k of STAT_KEYS) {
        out[k] = calcStat(CHAMPIONS_GEN, k, base[k], 31, sp[k] ?? 0, 50, nature);
    }
    return out;
}
