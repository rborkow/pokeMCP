/** `structuredContent` of the plan_matchup tool (see its outputSchema). */
export type Verdict = "Counter" | "Check" | "Trade" | "Loses";
export type Order = "faster" | "slower" | "tied";

export interface Hit {
    attacker: string;
    defender: string;
    move: string;
    minPercent: number;
    maxPercent: number;
    knockOut: string;
    hits: number | null;
    chancePercent: number | null;
    likelyKoHits: number | null;
    conditions?: string;
}

export interface MatchupCell {
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
    verdict: Verdict;
    trickRoomVerdict: Verdict;
}

interface Reason {
    kind: string;
    subject: string;
    detail: string;
    points: number;
}
interface Pick {
    indices: number[];
    pokemon: string[];
    score: number;
    reasons: Reason[];
}
interface Answer {
    member: number;
    pokemon: string;
    verdict: Verdict;
}
export interface Threat {
    opponent: number;
    pokemon: string;
    beats: number;
    outspeeds: number;
    rank: number;
    weight: number;
    answers: Answer[];
    trickRoomAnswers: Answer[];
}
export interface SetEcho {
    pokemon: string;
    nature: string;
    ability: string;
    item: string | null;
    moves: string[];
    statPoints?: Record<string, number>;
    stats?: Record<string, number>;
}

export interface MatchupData {
    format?: string;
    formatName?: string;
    bring: Pick;
    lead: Pick & { opponent: number[] };
    back: { indices: number[]; pokemon: string[]; reasons: Reason[] };
    threats: Threat[];
    speedNotes: {
        provider: number;
        member: number;
        opponent: number;
        kind: string;
        detail: string;
    }[];
    matrix: MatchupCell[][];
    alternatives: Pick[];
    assumptions: string[];
    team: SetEcho[];
    opponent: SetEcho[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;
const isHit = (value: unknown) =>
    value == null ||
    (isObject(value) &&
        typeof value.move === "string" &&
        typeof value.minPercent === "number" &&
        typeof value.maxPercent === "number");
const hasIndices = (value: unknown) =>
    isObject(value) && Array.isArray(value.indices) && value.indices.every(Number.isInteger);

/**
 * Whether a tool result has everything the grid reads. A host could hand the
 * view an error result or a result from an older server; show a message then
 * instead of throwing. Checks every cell, because one malformed cell would
 * otherwise throw halfway through a render.
 */
export function isMatchupData(value: unknown): value is MatchupData {
    if (!isObject(value)) return false;
    const { matrix, threats, speedNotes } = value;
    if (!Array.isArray(matrix) || matrix.length === 0) return false;
    const width = Array.isArray(matrix[0]) ? matrix[0].length : 0;
    if (width === 0) return false;
    const cellsOk = matrix.every(
        (row) =>
            Array.isArray(row) &&
            row.length === width &&
            row.every(
                (cell) =>
                    isObject(cell) &&
                    typeof cell.pokemon === "string" &&
                    typeof cell.target === "string" &&
                    typeof cell.verdict === "string" &&
                    typeof cell.trickRoomVerdict === "string" &&
                    isObject(cell.speed) &&
                    isHit(cell.deals) &&
                    isHit(cell.takes),
            ),
    );
    return (
        cellsOk &&
        hasIndices(value.bring) &&
        hasIndices(value.lead) &&
        hasIndices(value.back) &&
        Array.isArray(threats) &&
        threats.every(
            (t) =>
                isObject(t) &&
                Number.isInteger(t.opponent) &&
                typeof t.rank === "number" &&
                Array.isArray(t.answers) &&
                Array.isArray(t.trickRoomAnswers),
        ) &&
        Array.isArray(speedNotes)
    );
}
