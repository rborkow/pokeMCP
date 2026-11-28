/** Matchup planning from one cached matrix; scores are heuristics, never win rates. */
import { toID } from "../data-loader.js";
import { incomingKoHits, likelyKoHits, verdict } from "./counters.js";
import { formatFields, resolveRegulation } from "./formats.js";
import {
    bestHit,
    buildField,
    commonAttacks,
    fighter,
    type Hit,
    loadCalc,
    loadTypical,
    resolveSet,
    type SetInput,
} from "./matchup.js";
import { fail, ok } from "./types.js";

export const PLAN_SCORE = {
    counter: 4,
    check: 2,
    unanswered: 6,
    sweep: 30,
    speedControl: 2,
    disruption: 1,
    leadKo: 4,
    // A likely 2HKO: in doubles, two attackers can finish it in one turn.
    leadTwoHit: 2,
    leadSpeed: 1,
} as const;
export const PLAN_FORMULA =
    "Bring: for each opponent, weight = 7 - threat rank (rank by Loses count, then outspeeds count); add weight × best answer (Counter=4, Check=2, otherwise=-6), subtract 30 × (losses-2) when it beats >=3 selected members. Add at most 2 total for beneficial speed control and 1 total for beneficial disruption. Lead: sum over the 2×2 cells [4 × (my likely OHKO - their pessimistic OHKO) + 2 × (my likely 2HKO - their pessimistic 2HKO) + Speed sign (+1/0/-1)], plus at most 1 for conditional Fake Out that improves a verdict. Maximise the minimum over all 15 opponent pairs. Ties use input order.";
type Member = SetInput & { moves?: string[] };
type Order = "faster" | "slower" | "tied";
export type Reason = { kind: string; subject: string; detail: string; points: number };
export interface Cell {
    member: number;
    opponent: number;
    pokemon: string;
    target: string;
    deals: Hit | null;
    takes: Hit | null;
    speed: {
        member: number;
        threat: number;
        normal: Order;
        myTailwind: Order;
        theirTailwind: Order;
        trickRoom: Order;
    };
    verdict: ReturnType<typeof verdict>;
    trickRoomVerdict: ReturnType<typeof verdict>;
}
export interface Support {
    provider: number;
    member: number;
    opponent: number;
    kind: string;
    detail: string;
}
const order = (a: number, b: number): Order => (a === b ? "tied" : a > b ? "faster" : "slower");
const answer = (v: string) => v === "Counter" || v === "Check";
export function combinations(values: number[], size: number): number[][] {
    if (!size) return [[]];
    return values.flatMap((v, i) =>
        combinations(values.slice(i + 1), size - 1).map((rest) => [v, ...rest]),
    );
}
export function rankThreats(matrix: Cell[][]) {
    return matrix[0]
        .map((cell, j) => {
            const rows = matrix.map((row) => row[j]);
            return {
                opponent: j,
                pokemon: cell.target,
                beats: rows.filter((r) => r.verdict === "Loses").length,
                outspeeds: rows.filter((r) => r.speed.normal === "slower").length,
                answers: rows
                    .filter((r) => answer(r.verdict))
                    .map((r) => ({ member: r.member, pokemon: r.pokemon, verdict: r.verdict })),
                trickRoomAnswers: rows
                    .filter((r) => answer(r.trickRoomVerdict))
                    .map((r) => ({
                        member: r.member,
                        pokemon: r.pokemon,
                        verdict: r.trickRoomVerdict,
                    })),
            };
        })
        .sort((a, b) => b.beats - a.beats || b.outspeeds - a.outspeeds || a.opponent - b.opponent)
        .map((t, i) => ({ ...t, rank: i + 1, weight: 6 - i }));
}
export function scoreBring(indices: number[], matrix: Cell[][], support: Support[] = []) {
    const reasons: Reason[] = [];
    for (const t of rankThreats(matrix)) {
        const rows = indices.map((i) => matrix[i][t.opponent]);
        const best = rows.some((r) => r.verdict === "Counter")
            ? PLAN_SCORE.counter
            : rows.some((r) => r.verdict === "Check")
              ? PLAN_SCORE.check
              : -PLAN_SCORE.unanswered;
        reasons.push({
            kind: "coverage",
            subject: t.pokemon,
            detail: `rank ${t.rank}, weight ${t.weight} × best answer value ${best}`,
            points: t.weight * best,
        });
        const losses = rows.filter((r) => r.verdict === "Loses").length;
        if (losses >= 3)
            reasons.push({
                kind: "sweeper",
                subject: t.pokemon,
                detail: `${losses}/4 lose; -${PLAN_SCORE.sweep} × (${losses}-2)`,
                points: -PLAN_SCORE.sweep * (losses - 2),
            });
    }
    for (const [kind, points] of [
        ["speedControl", PLAN_SCORE.speedControl],
        ["disruption", PLAN_SCORE.disruption],
    ] as const) {
        const evidence = support.find(
            (s) =>
                indices.includes(s.provider) &&
                indices.includes(s.member) &&
                (kind === "disruption"
                    ? ["Fake Out", "Intimidate"].includes(s.kind)
                    : !["Fake Out", "Intimidate"].includes(s.kind)),
        );
        if (evidence)
            reasons.push({
                kind,
                subject: matrix[evidence.provider][0].pokemon,
                detail: evidence.detail,
                points,
            });
    }
    return { indices, score: reasons.reduce((sum, r) => sum + r.points, 0), reasons };
}
export function scoreLead(
    mine: number[],
    theirs: number[],
    matrix: Cell[][],
    support: Support[] = [],
) {
    const reasons: Reason[] = mine.flatMap((i) =>
        theirs.map((j) => {
            const c = matrix[i][j];
            const mineHits = likelyKoHits(c.deals);
            const theirHits = incomingKoHits(c.takes);
            const outgoing = Number(mineHits === 1);
            const incoming = Number(theirHits === 1);
            const outgoingTwo = Number(mineHits === 2);
            const incomingTwo = Number(theirHits === 2);
            const speed = c.speed.normal === "faster" ? 1 : c.speed.normal === "slower" ? -1 : 0;
            return {
                kind: "leadCell",
                subject: `${c.pokemon} vs ${c.target}`,
                detail: `likely OHKO ${outgoing}, incoming OHKO ${incoming}, likely 2HKO ${outgoingTwo}, incoming 2HKO ${incomingTwo}, Speed sign ${speed}`,
                points:
                    PLAN_SCORE.leadKo * (outgoing - incoming) +
                    PLAN_SCORE.leadTwoHit * (outgoingTwo - incomingTwo) +
                    PLAN_SCORE.leadSpeed * speed,
            };
        }),
    );
    const fake = support.find(
        (s) =>
            s.kind === "Fake Out" &&
            mine.includes(s.provider) &&
            mine.includes(s.member) &&
            theirs.includes(s.opponent),
    );
    if (fake)
        reasons.push({
            kind: "disruption",
            subject: "Fake Out",
            detail: fake.detail,
            points: PLAN_SCORE.disruption,
        });
    return { score: reasons.reduce((sum, r) => sum + r.points, 0), reasons };
}
export function chooseLead(bring: number[], matrix: Cell[][], support: Support[] = []) {
    const opponents = combinations(
        matrix[0].map((_, i) => i),
        2,
    );
    return combinations(bring, 2)
        .map((indices) => {
            const worst = opponents
                .map((theirs) => ({
                    opponent: theirs,
                    ...scoreLead(indices, theirs, matrix, support),
                }))
                .sort((a, b) => a.score - b.score)[0];
            return { indices, ...worst };
        })
        .sort((a, b) => b.score - a.score)[0];
}

export async function planMatchup(
    args: { team: Member[]; opponent: (Member | string)[]; format?: string },
    env: Env,
) {
    if (args.team.length !== 6 || args.opponent.length !== 6)
        return fail(
            "Pass exactly six Pokémon on each side; use find_counters for smaller matchups.",
            "invalid_input",
        );
    const { calc, getFinalSpeed } = await loadCalc();
    const gen = calc.Generations.get(0);
    const regulation = resolveRegulation(args.format);
    const assumptions = [
        PLAN_FORMULA,
        "Exactly six per side. Species and Item Clause are not checked; use validate_team. Slot indices are zero-based.",
        "Level 50, full HP, single attacks in doubles, no screens, switching, move priority, accuracy or partner support in the base matrix; not a battle simulation. Spread attacks receive the doubles reduction.",
        "Each attacker uses its own entry weather/terrain; Speed uses a plain field. Unsupported attacks are omitted; null means no calculated damaging option, not proof of immunity to every move.",
        "Shared find_counters verdicts: Counter takes strictly under 50% and likely KOs in <=2 uses; Check KOs first (fewer hits, or as many while moving first); Trade has equal counts or a potentially winning Speed tie; otherwise Loses. My KOs require >=50% probability; unproven incoming KOs use the earliest possible count. Display ranges never supply KO counts.",
        "Smogon does not publish doubles lead frequency: evaluate all 15 opposing lead pairs. Lead score counts pairwise OHKO and 2HKO opportunities, not coordinated targeting or a turn simulation.",
        "Support bonuses are conditional on successful setup, never guaranteed: Tailwind/Trick Room/one Speed drop must improve an order; Fake Out must improve a partner verdict if the target flinches; Intimidate must improve a partner verdict after its Attack drop. Bonuses are capped by category, not stacked. Opposing support, redirection, Protect, switching and setup reliability are not simulated.",
        "Base cost is at most 288 move calculations (36 pairs × four moves × two directions). Intimidate adds at most 288 cached calculations (both directions, since a lower Attack also weakens moves like Foul Play); subsets and leads never recalculate damage.",
        "Missing nature/stat points are filled independently from the usage spread, preserving supplied fields; missing usage falls back to resolveSet defaults. Usage components may not co-occur. Missing moves use the four most-used moves, including status moves.",
    ];
    async function prepare(raw: Member | string, side: string, slot: number) {
        const input: Member = typeof raw === "string" ? { pokemon: raw } : { ...raw };
        const typical = await loadTypical(input.pokemon, regulation, env);
        const filled: string[] = [];
        if (typical?.spread) {
            if (input.nature === undefined) {
                input.nature = typical.spread.nature;
                filled.push(`nature=${input.nature}`);
            }
            if (input.statPoints === undefined) {
                input.statPoints = typical.spread.statPoints;
                filled.push(`statPoints=${JSON.stringify(input.statPoints)}`);
            }
        }
        const resolved = await resolveSet(gen, calc, input, regulation, env);
        if (resolved.ok === false) return resolved;
        const names = input.moves ?? typical?.moves.slice(0, 4);
        if (!names)
            return {
                ok: false as const,
                error: `No usage moves for ${input.pokemon}. Pass its moves explicitly.`,
                reason: "no_usage" as const,
            };
        const moves: string[] = [];
        for (const name of names) {
            const move = gen.moves.get(toID(name));
            if (!move)
                return {
                    ok: false as const,
                    error: `Unknown move "${name}". Check the spelling.`,
                    reason: "unknown_name" as const,
                };
            moves.push(move.name);
        }
        if (!input.moves) filled.push(`moves=${moves.join(", ")}`);
        assumptions.push(...resolved.value.assumptions.map((note) => `${side}[${slot}]: ${note}`));
        if (filled.length)
            assumptions.push(
                `${side}[${slot}] ${input.pokemon}: ${filled.join("; ")} (from usage; fields not given)`,
            );
        const attacks = commonAttacks(
            gen,
            { ...typical, moves: moves.map(toID).filter((id) => id !== "fakeout") },
            4,
        );
        const self = fighter(resolved.value, attacks);
        const speed = (tailwind = false, drop = false) => {
            const p = resolved.value.pokemon.clone();
            if (drop) p.boosts.spe = -1;
            return getFinalSpeed(
                gen,
                p,
                buildField(calc),
                new calc.Side({ isTailwind: tailwind }),
            ) as number;
        };
        return {
            ok: true as const,
            value: {
                set: resolved.value,
                self,
                moves,
                speed: speed(),
                tailwind: speed(true),
                dropped: speed(false, true),
            },
        };
    }
    const mine: Awaited<ReturnType<typeof prepare>>[] = [];
    const theirs: typeof mine = [];
    for (const [side, inputs, output] of [
        ["team", args.team, mine],
        ["opponent", args.opponent, theirs],
    ] as const) {
        for (const [i, input] of inputs.entries()) {
            const result = await prepare(input, side, i);
            if (result.ok === false) return fail(result.error, result.reason);
            output.push(result);
        }
    }
    const team = mine.map((r) => {
        if (!r.ok) throw new Error("unreachable");
        return r.value;
    });
    const opponents = theirs.map((r) => {
        if (!r.ok) throw new Error("unreachable");
        return r.value;
    });
    const matrix: Cell[][] = team.map((m, i) =>
        opponents.map((t, j) => {
            const deals = bestHit(gen, calc, [m.self], [t.self], true);
            const takes = bestHit(gen, calc, [t.self], [m.self], true);
            const normal = order(m.speed, t.speed);
            const trickRoom = order(t.speed, m.speed);
            return {
                member: i,
                opponent: j,
                pokemon: m.self.name,
                target: t.self.name,
                deals,
                takes,
                speed: {
                    member: m.speed,
                    threat: t.speed,
                    normal,
                    myTailwind: order(m.tailwind, t.speed),
                    theirTailwind: order(m.speed, t.tailwind),
                    trickRoom,
                },
                verdict: verdict(takes, deals, normal),
                trickRoomVerdict: verdict(takes, deals, trickRoom),
            };
        }),
    );
    const support: Support[] = [];
    const improves = (before: Order, after: Order) =>
        ["slower", "tied", "faster"].indexOf(after) > ["slower", "tied", "faster"].indexOf(before);
    const better = (before: string, after: string) =>
        ["Loses", "Trade", "Check", "Counter"].indexOf(after) >
        ["Loses", "Trade", "Check", "Counter"].indexOf(before);
    // Additional Intimidate calculations are cached per cell, never per subset/lead.
    const intimidated = new Map<string, { takes: Hit | null; deals: Hit | null }>();
    for (const [p, provider] of team.entries())
        for (const [i, row] of matrix.entries())
            for (const [j, c] of row.entries()) {
                const target = opponents[j];
                const add = (kind: string, detail: string) =>
                    support.push({
                        provider: p,
                        member: i,
                        opponent: j,
                        kind,
                        detail: `${provider.self.name} ${kind}: ${c.pokemon} vs ${c.target}: ${detail}`,
                    });
                for (const move of provider.moves) {
                    let after: Order | undefined;
                    if (move === "Tailwind") after = c.speed.myTailwind;
                    if (move === "Trick Room") after = c.speed.trickRoom;
                    // Conservative target filter: Speed-drop immunity, reflection/benefit and type immunity.
                    const immune =
                        [
                            "Clear Body",
                            "White Smoke",
                            "Full Metal Body",
                            "Mirror Armor",
                            "Contrary",
                            "Defiant",
                            "Competitive",
                            "Shield Dust",
                        ].includes(target.set.echo.ability) ||
                        ["Clear Amulet", "Covert Cloak"].includes(target.set.echo.item);
                    if (
                        ["Icy Wind", "Electroweb"].includes(move) &&
                        !immune &&
                        !(
                            move === "Electroweb" &&
                            (target.set.pokemon.types.includes("Ground") ||
                                ["Volt Absorb", "Lightning Rod", "Motor Drive"].includes(
                                    target.set.echo.ability,
                                ))
                        )
                    )
                        after = order(team[i].speed, target.dropped);
                    if (after && improves(c.speed.normal, after))
                        add(
                            move,
                            `Speed ${c.speed.member} vs ${c.speed.threat}: ${c.speed.normal} -> ${after}, conditional on setup`,
                        );
                    if (
                        move === "Fake Out" &&
                        p !== i &&
                        !target.set.pokemon.types.includes("Ghost") &&
                        !["Inner Focus", "Shield Dust"].includes(target.set.echo.ability) &&
                        target.set.echo.item !== "Covert Cloak" &&
                        ![...team, ...opponents].some(
                            (t) => t.set.echo.ability === "Psychic Surge",
                        ) &&
                        !opponents.some((t) =>
                            ["Armor Tail", "Dazzling", "Queenly Majesty"].includes(
                                t.set.echo.ability,
                            ),
                        ) &&
                        better(c.verdict, verdict(c.takes, c.deals, "faster"))
                    )
                        add(
                            move,
                            `${c.verdict} -> ${verdict(c.takes, c.deals, "faster")} if flinch grants partner first action; base Speed ${c.speed.member} vs ${c.speed.threat}`,
                        );
                }
                if (
                    provider.set.echo.ability === "Intimidate" &&
                    p !== i &&
                    ![
                        "Clear Body",
                        "White Smoke",
                        "Full Metal Body",
                        "Mirror Armor",
                        "Contrary",
                        "Defiant",
                        "Competitive",
                        "Inner Focus",
                        "Oblivious",
                        "Own Tempo",
                        "Scrappy",
                    ].includes(target.set.echo.ability) &&
                    target.set.echo.item !== "Clear Amulet"
                ) {
                    const key = `${i}:${j}`;
                    if (!intimidated.has(key)) {
                        const pokemon = target.self.pokemon.clone();
                        pokemon.boosts.atk = -1;
                        const lowered = { ...target.self, pokemon };
                        // Both directions: the target's lower Attack also weakens moves that
                        // use it against itself, such as Foul Play.
                        intimidated.set(key, {
                            takes: bestHit(gen, calc, [lowered], [team[i].self], true),
                            deals: bestHit(gen, calc, [team[i].self], [lowered], true),
                        });
                    }
                    const after = intimidated.get(key);
                    const changed = verdict(after.takes, after.deals, c.speed.normal);
                    if (better(c.verdict, changed))
                        add("Intimidate", `Attack stage 0 -> -1: ${c.verdict} -> ${changed}`);
                }
            }
    const ranked = combinations([0, 1, 2, 3, 4, 5], 4)
        .map((ids) => scoreBring(ids, matrix, support))
        .sort((a, b) => b.score - a.score);
    const pick = (r: (typeof ranked)[number]) => ({
        ...r,
        pokemon: r.indices.map((i) => team[i].self.name),
        reasons: [
            ...r.reasons,
            ...r.indices.map((i) => ({
                kind: "member",
                subject: team[i].self.name,
                points: 0,
                detail: `slot ${i}: ${matrix[i].filter((c) => c.verdict === "Counter").length} Counters, ${matrix[i].filter((c) => c.verdict === "Check").length} Checks; only selected answer to ${
                    matrix[i]
                        .filter(
                            (c) =>
                                answer(c.verdict) &&
                                !r.indices.some(
                                    (k) => k !== i && answer(matrix[k][c.opponent].verdict),
                                ),
                        )
                        .map((c) => c.target)
                        .join(", ") || "none"
                }; informational, already counted in coverage`,
            })),
        ],
    });
    const chosen = ranked[0];
    const lead = chooseLead(chosen.indices, matrix, support);
    const back = chosen.indices.filter((i) => !lead.indices.includes(i));
    const data = {
        ...formatFields(regulation),
        bring: pick(chosen),
        lead: { ...lead, pokemon: lead.indices.map((i) => team[i].self.name) },
        back: {
            indices: back,
            pokemon: back.map((i) => team[i].self.name),
            reasons: [
                {
                    kind: "back",
                    subject: "Remaining bring members",
                    detail: `4 selected minus 2 leads = ${back.length} back members`,
                    points: 0,
                },
            ],
        },
        threats: rankThreats(matrix),
        speedNotes: [
            ...support,
            ...matrix.flatMap((row) =>
                row.flatMap((c) =>
                    (["myTailwind", "theirTailwind", "trickRoom"] as const)
                        .filter((mode) => c.speed[mode] !== c.speed.normal)
                        .map((mode) => ({
                            provider: c.member,
                            member: c.member,
                            opponent: c.opponent,
                            kind: mode,
                            detail: `${c.pokemon} vs ${c.target}: Speed ${c.speed.member} vs ${c.speed.threat}; ${c.speed.normal} -> ${c.speed[mode]} under ${mode} (hypothetical field, not a support bonus)`,
                        })),
                ),
            ),
        ],
        matrix,
        alternatives: ranked.slice(1, 3).map(pick),
        assumptions,
        team: team.map((m) => ({ ...m.set.echo, moves: m.moves })),
        opponent: opponents.map((m) => ({ ...m.set.echo, moves: m.moves })),
    };
    // The text carries the same plan as structuredContent, for clients that only read text.
    const range = (h: Hit | null) => (h ? `${h.minPercent}–${h.maxPercent}%` : "no damage");
    const answers = (list: { pokemon: string; verdict: string }[]) =>
        list.map((a) => `${a.pokemon} (${a.verdict})`).join(", ") || "none";
    const text = [
        `**Bring** ${data.bring.pokemon.join(", ")} (score ${chosen.score}); **lead** ` +
            `${data.lead.pokemon.join(", ")} (worst case ${lead.score}); **back** ` +
            `${data.back.pokemon.join(", ")}. Deterministic calculations, not a battle simulation.`,
        "",
        "**Their threats** (most dangerous first):",
        ...data.threats.map(
            (t) =>
                `${t.rank}. ${t.pokemon}: beats ${t.beats} of yours, outspeeds ${t.outspeeds}; ` +
                `answered by ${answers(t.answers)}; under Trick Room ${answers(t.trickRoomAnswers)}`,
        ),
        "",
        "**Why this bring:**",
        ...chosen.reasons.map((r) => `- ${r.subject}: ${r.detail} (${r.points})`),
        "",
        "**Why this lead:**",
        ...lead.reasons.map((r) => `- ${r.subject}: ${r.detail} (${r.points})`),
        "",
        "**Alternatives:**",
        ...data.alternatives.map((a) => `- ${a.pokemon.join(", ")} (score ${a.score})`),
        "",
        "**Matchups** (verdict; your hardest hit / theirs):",
        ...matrix.map(
            (row) =>
                `${row[0].pokemon}: ` +
                row
                    .map((c) => `${c.target} ${c.verdict} (${range(c.deals)} / ${range(c.takes)})`)
                    .join("; "),
        ),
        ...(support.length
            ? ["", "**Support:**", ...support.map((n) => `- ${n.kind}: ${n.detail}`)]
            : []),
        "",
        "**Assumptions:**",
        ...assumptions.map((a) => `- ${a}`),
    ].join("\n");
    return ok(data, text);
}
