/** Deterministic one-threat matchups. No turn simulation or partner effects. */
import { toID } from "../data-loader.js";
import { loadRegulation } from "../regulations/loader.js";
import { getFormatIndex } from "../stats.js";
import { formatFields, resolveRegulation } from "./formats.js";
import {
    bestHit,
    buildField,
    commonAttacks,
    fighter,
    type Hit,
    loadCalc,
    loadTypical,
    type ResolvedSet,
    resolveSet,
    type SetInput,
} from "./matchup.js";
import { resolvePokemon } from "./pokemon.js";
import { fail, ok, round2, type ToolOutcome } from "./types.js";

export const COUNTER_MAX_TAKEN_PERCENT = 50;
export const COUNTER_MAX_KO_HITS = 2;
export const MAX_COUNTER_CANDIDATES = 40;
export const DEFAULT_COUNTER_LIMIT = 5;
export const MAX_COUNTER_LIMIT = 10;
const RANK = { Counter: 0, Check: 1, Trade: 2, Loses: 3 };
type Verdict = keyof typeof RANK;
type Member = SetInput & { moves?: string[] };
type Order = "faster" | "slower" | "tied";

/** Verdicts require at least this probability of KO within the reported count. */
export const LIKELY_KO_PERCENT = 50;

/** Use bestHit's independently established count, never infer from display text,
 * a missing probability, rounded percentages, or an unverified N + 1 fallback.
 * Null (including no KO within nine uses) is unreachable for verdict purposes.
 */
export function likelyKoHits(hit: Hit | null): number {
    return hit?.likelyKoHits ?? Number.POSITIVE_INFINITY;
}

export function verdict(takes: Hit | null, deals: Hit | null, order: Order): Verdict {
    const outgoing = likelyKoHits(deals);
    const incoming = likelyKoHits(takes);
    // Strictly under half: a member that takes exactly 50% can fall to two max rolls.
    if (outgoing <= COUNTER_MAX_KO_HITS && (takes?.maxPercent ?? 0) < COUNTER_MAX_TAKEN_PERCENT)
        return "Counter";
    if (!Number.isFinite(outgoing)) return "Loses";
    if (order === "faster" && outgoing <= incoming) return "Check";
    if (outgoing === incoming || (order === "tied" && outgoing <= incoming)) return "Trade";
    return "Loses";
}

/** Base species for exclusion/deduplication, including Mega forms. */
function speciesKey(name: string): string {
    const resolved = resolvePokemon(name);
    return toID(
        resolved?.mega?.basePokemon ??
            resolved?.species.baseSpecies ??
            resolved?.species.name ??
            name,
    );
}

export async function findCounters(
    args: {
        threat: Member;
        team?: Member[];
        format?: string;
        suggest?: boolean;
        limit?: number;
        trickRoom?: boolean;
    },
    env: Env,
): Promise<ToolOutcome> {
    const { calc, getFinalSpeed } = await loadCalc();
    const gen = calc.Generations.get(0);
    const regulation = resolveRegulation(args.format);
    const assumptions = [
        "level 50, full HP, doubles, no screens, stat changes, switching or partner support; deterministic single-hit calculations, not a battle simulation",
        "spread moves alone receive the doubles 75% reduction; other moves receive no spread reduction",
        "each attacker uses its own entry weather or terrain; Speed uses a plain field (no weather, terrain or Tailwind)",
        "moves the calculator cannot handle are omitted; a null hit means no calculated damaging option",
        "Intimidate and Fake Out are not counted; status moves and move priority are ignored (Speed compares equal-priority moves)",
        "verdict KO counts use the smallest 1–9 uses with at least 50% cumulative KO probability, ignoring accuracy; display KO counts remain the calculator's earliest possible KO",
        "recovery or residual effects require the calculator to report a numeric KO chance of at least 50%; otherwise the verdict KO count is unreachable",
        "Counter means takes under 50% from the hardest hit, so two maximum rolls can't KO it, and KOs within 2 hits",
        "Check means moves first and needs no more KO hits than the threat; otherwise equal KO hits are Trade; a Speed tie prevents Check and is Trade when it could win moving first",
        "margin is deals maximum HP percent minus takes maximum HP percent; rank Counter then Check then Trade then Loses, with larger margin first",
        `verdicts use ${args.trickRoom ? "Trick Room" : "normal Speed order"}; both Speed orders and verdicts are reported`,
    ];
    async function prepare(input: Member) {
        const set = await resolveSet(gen, calc, input, regulation, env);
        if (set.ok === false) return set;
        const notes = [...set.value.assumptions];
        let moves: string[];
        if (input.moves?.length) {
            moves = [];
            for (const name of input.moves.slice(0, 4)) {
                const known = gen.moves.get(toID(name));
                if (!known)
                    return {
                        ok: false as const,
                        error: `"${name}" is not a move in Pokémon Champions. Check the spelling.`,
                        reason: "unknown_name" as const,
                    };
                if (known.category !== "Status" && toID(known.name) !== "fakeout")
                    moves.push(known.name);
            }
        } else {
            const typical =
                set.value.typical ?? (await loadTypical(input.pokemon, regulation, env));
            if (!typical)
                return {
                    ok: false as const,
                    error: `No usage set is available for ${set.value.echo.pokemon} in ${regulation.shortLabel}. Pass its moves, nature, stat points, ability and item.`,
                    reason: "no_usage" as const,
                };
            moves = commonAttacks(
                gen,
                { ...typical, moves: typical.moves.filter((name) => toID(name) !== "fakeout") },
                4,
            );
            notes.push(
                `${set.value.echo.pokemon}: ${moves.join(", ") || "no damaging attacks"} (most used attacks; no moves were given)`,
            );
        }
        return {
            ok: true as const,
            value: { set: set.value, self: fighter(set.value, moves), moves, notes },
        };
    }
    const threat = await prepare(args.threat);
    if (threat.ok === false) return fail(threat.error, threat.reason);
    const target = threat.value;
    assumptions.push(...target.notes);
    const speed = (set: ResolvedSet) =>
        getFinalSpeed(gen, set.pokemon, buildField(calc), new calc.Side({})) as number;
    const threatSpeed = speed(target.set);
    function evaluate(member: typeof target) {
        const memberSpeed = speed(member.set);
        const normal: Order =
            memberSpeed === threatSpeed ? "tied" : memberSpeed > threatSpeed ? "faster" : "slower";
        const trickRoom: Order =
            normal === "tied" ? "tied" : normal === "faster" ? "slower" : "faster";
        const takes = bestHit(gen, calc, [target.self], [member.self], true);
        const deals = bestHit(gen, calc, [member.self], [target.self], true);
        const normalVerdict = verdict(takes, deals, normal);
        const trickRoomVerdict = verdict(takes, deals, trickRoom);
        return {
            pokemon: member.set.echo.pokemon,
            set: member.set.echo,
            moves: member.moves,
            takes,
            deals,
            speed: { member: memberSpeed, threat: threatSpeed, normal, trickRoom },
            verdict: args.trickRoom ? trickRoomVerdict : normalVerdict,
            normalVerdict,
            trickRoomVerdict,
            margin: round2((deals?.maxPercent ?? 0) - (takes?.maxPercent ?? 0)),
        };
    }
    const team: ReturnType<typeof evaluate>[] = [];
    for (const input of args.team ?? []) {
        const member = await prepare(input);
        if (member.ok === false) return fail(member.error, member.reason);
        assumptions.push(...member.value.notes);
        team.push(evaluate(member.value));
    }
    const rank = (a: ReturnType<typeof evaluate>, b: ReturnType<typeof evaluate>) =>
        RANK[a.verdict] - RANK[b.verdict] ||
        b.margin - a.margin ||
        a.pokemon.localeCompare(b.pokemon);
    const suggestions: (ReturnType<typeof evaluate> & { usagePercent: number })[] = [];
    if (!team.some((row) => RANK[row.verdict] <= RANK.Check) && args.suggest !== false) {
        const index = regulation.showdownFormatId
            ? await getFormatIndex(regulation.showdownFormatId, env)
            : null;
        if (!index)
            return fail(
                `Usage statistics for ${regulation.shortLabel} are unavailable. Try again later, or set suggest to false to check only your team.`,
                "data_unavailable",
            );
        let legal: Awaited<ReturnType<typeof loadRegulation>>;
        try {
            legal = await loadRegulation(regulation, env);
        } catch {
            return fail(
                `The allowed Pokémon list for ${regulation.shortLabel} is unavailable. Try again later, or set suggest to false.`,
                "data_unavailable",
            );
        }
        const excluded = new Set(team.map((row) => speciesKey(row.pokemon)));
        // Slice before filtering: the search never expands beyond the top 40 usage entries.
        for (const [name, usage] of Object.entries(index.pokemon)
            .sort(([, a], [, b]) => b - a)
            .slice(0, MAX_COUNTER_CANDIDATES)) {
            const resolved = resolvePokemon(name);
            if (!resolved || (resolved.unknownMega && !resolved.mega)) continue;
            const base = resolved.mega?.basePokemon ?? resolved.name;
            if (!legal.allowedPokemonIds.has(toID(base))) continue;
            if (
                resolved.mega &&
                !regulation.megaForms.some((mega) => toID(mega.megaName) === toID(resolved.name))
            )
                continue;
            const key = speciesKey(name);
            if (excluded.has(key)) continue;
            const member = await prepare({ pokemon: name });
            if (member.ok === false) {
                assumptions.push(
                    `${name}: suggestion skipped because its usage set or battle data is unavailable`,
                );
                continue;
            }
            const row = evaluate(member.value);
            if (RANK[row.verdict] <= RANK.Check) {
                suggestions.push({ ...row, usagePercent: round2(usage * 100) });
                assumptions.push(...member.value.notes);
            }
        }
        suggestions.sort(rank);
        const seen = new Set<string>();
        for (let i = 0; i < suggestions.length; ) {
            const key = speciesKey(suggestions[i].pokemon);
            if (seen.has(key)) suggestions.splice(i, 1);
            else {
                seen.add(key);
                i++;
            }
        }
        suggestions.splice(args.limit ?? DEFAULT_COUNTER_LIMIT);
        assumptions.push(
            `suggestions search only the top ${MAX_COUNTER_CANDIDATES} usage entries, legal species not on the team, one form per species; independently most common set components may not co-occur`,
        );
    }
    const bestAnswer = [...team].sort(rank)[0] ?? null;
    const data = {
        ...formatFields(regulation),
        threat: { ...target.set.echo, moves: target.moves, speed: threatSpeed },
        trickRoom: !!args.trickRoom,
        team,
        bestAnswer,
        suggestions,
        assumptions: [...new Set(assumptions)],
    };
    const hitText = (hit: Hit | null) =>
        hit
            ? `${hit.move}: ${hit.minPercent}–${hit.maxPercent}% (${hit.knockOut}; KO hits ${hit.hits ?? "unknown"}, chance ${hit.chancePercent ?? "unknown"}%; verdict KO hits ${hit.likelyKoHits ?? "unreachable"})${hit.conditions ? `; ${hit.conditions}` : ""}`
            : "no damaging option";
    const setText = (set: ResolvedSet["echo"]) =>
        `${set.pokemon}: ${set.nature}; points ${JSON.stringify(set.statPoints)}; stats ${JSON.stringify(set.stats)}; ${set.ability}; ${set.item ?? "no item"}`;
    const rowText = (row: ReturnType<typeof evaluate>) => [
        `**${row.pokemon}: ${row.verdict}** (margin ${row.margin})`,
        setText(row.set),
        `Moves: ${row.moves.join(", ") || "none"}`,
        `Takes ${hitText(row.takes)}; deals ${hitText(row.deals)}`,
        `Speed ${row.speed.member} vs ${row.speed.threat}: ${row.speed.normal} normally (${row.normalVerdict}), ${row.speed.trickRoom} under Trick Room (${row.trickRoomVerdict})${row.speed.normal === "tied" ? "; Speed tie: cannot claim Check" : ""}`,
    ];
    return ok(
        data,
        [
            `**Find counters — ${regulation.shortLabel}**`,
            `Threat ${setText(data.threat)}; moves ${data.threat.moves.join(", ")}; Speed ${threatSpeed}`,
            `Trick Room: ${data.trickRoom ? "active" : "inactive"}`,
            ...team.flatMap(rowText),
            `Best team answer: ${bestAnswer ? `${bestAnswer.pokemon} (${bestAnswer.verdict})` : "no team given"}`,
            "Suggestions:",
            ...suggestions.flatMap((row) => [...rowText(row), `Usage: ${row.usagePercent}%`]),
            ...(suggestions.length ? [] : ["None."]),
            "Assumed:",
            ...data.assumptions.map((line) => `- ${line}`),
        ].join("\n"),
    );
}
