/**
 * Matchup plan: my six down the side, their six across, one verdict per pair.
 * Rows are ordered leads, back, bench and columns by threat rank, so the plan
 * reads from the top-left corner. Every cell says its verdict in words as well
 * as colour (DESIGN.md: colour alone never carries meaning).
 *
 * Pokémon are identified by slot index everywhere: Species Clause is not
 * checked by the tool, so two slots can share a name.
 *
 * Everything here renders through Preact text nodes. Names, moves and notes
 * echo what the caller typed, so nothing may be written as HTML.
 */
import { Fragment } from "preact";
import { useState } from "preact/hooks";
import type { Hit, MatchupCell, MatchupData, Order, SetEcho, Threat, Verdict } from "./types.js";

/** A cell, by slot index on each side. */
export interface CellRef {
    member: number;
    opponent: number;
}

type Role = "Lead" | "Back" | "Bench";

const VERDICT_CLASS: Record<string, string> = {
    Counter: "mu-v-counter",
    Check: "mu-v-check",
    Trade: "mu-v-trade",
    Loses: "mu-v-loses",
};
const VERDICT_MEANING: [Verdict, string][] = [
    ["Counter", "takes under half, KOs in two"],
    ["Check", "KOs it before it KOs you"],
    ["Trade", "even; Speed decides"],
    ["Loses", "anything else"],
];
/** speedNotes kinds that describe a hypothetical field, not a teammate's support. */
const FIELD_KINDS = new Set(["myTailwind", "theirTailwind", "trickRoom"]);
const SPEED_MODES = [
    ["normal", "Normal"],
    ["myTailwind", "Your Tailwind"],
    ["theirTailwind", "Their Tailwind"],
    ["trickRoom", "Trick Room"],
] as const;
const ORDER_LABEL: Record<Order, string> = {
    faster: "You move first",
    slower: "They move first",
    tied: "Speed tie",
};

/** Stateful view: holds the Trick Room toggle and the selected cell. */
export function Matchup({
    data,
    initialTrickRoom = false,
    initialSelected = null,
}: {
    data: MatchupData;
    initialTrickRoom?: boolean;
    initialSelected?: CellRef | null;
}) {
    const [trickRoom, setTrickRoom] = useState(initialTrickRoom);
    const [selected, setSelected] = useState<CellRef | null>(initialSelected);
    return (
        <MatchupGrid
            data={data}
            trickRoom={trickRoom}
            selected={selected}
            onTrickRoom={setTrickRoom}
            onSelect={(ref) =>
                setSelected((prev) =>
                    prev && prev.member === ref.member && prev.opponent === ref.opponent
                        ? null
                        : ref,
                )
            }
        />
    );
}

/** Slot indices in display order: the listed ones first, then the rest. */
function ordered(first: number[], count: number): number[] {
    const seen = new Set<number>();
    for (const i of first) if (Number.isInteger(i) && i >= 0 && i < count) seen.add(i);
    for (let i = 0; i < count; i++) seen.add(i);
    return [...seen];
}

const shown = (cell: MatchupCell, trickRoom: boolean) =>
    trickRoom ? cell.trickRoomVerdict : cell.verdict;
const rounded = (hit: Hit | null) =>
    hit ? `${Math.round(hit.minPercent)}–${Math.round(hit.maxPercent)}%` : "none";

/** Pure view: everything on screen follows from the props. */
export function MatchupGrid({
    data,
    trickRoom,
    selected,
    onTrickRoom,
    onSelect,
}: {
    data: MatchupData;
    trickRoom: boolean;
    selected: CellRef | null;
    onTrickRoom?: (on: boolean) => void;
    onSelect?: (ref: CellRef) => void;
}) {
    const { matrix } = data;
    const leads = new Set(data.lead.indices);
    const backs = new Set(data.back.indices);
    const brought = new Set([...data.bring.indices, ...leads, ...backs]);
    const roleOf = (i: number): Role => (leads.has(i) ? "Lead" : brought.has(i) ? "Back" : "Bench");
    const rows = ordered(
        [...data.lead.indices, ...data.back.indices, ...data.bring.indices],
        matrix.length,
    );
    const threats = [...data.threats].sort((a, b) => a.rank - b.rank);
    const cols = ordered(
        threats.map((t) => t.opponent),
        matrix[0].length,
    );
    const threatAt = new Map(threats.map((t) => [t.opponent, t]));
    const myName = (i: number) => matrix[i]?.[0].pokemon ?? `Slot ${i + 1}`;
    const theirName = (j: number) => matrix[0][j]?.target ?? `Slot ${j + 1}`;
    const names = (indices: number[], name: (i: number) => string) =>
        indices.filter((i) => Number.isInteger(i)).map(name);
    const bench = rows.filter((i) => !brought.has(i));
    const flipped = matrix.flat().filter((c) => c.verdict !== c.trickRoomVerdict).length;
    const chosen =
        selected && matrix[selected.member]?.[selected.opponent]
            ? matrix[selected.member][selected.opponent]
            : null;

    /** Arrow keys move between cells; every cell is also a tab stop. */
    const onKeyDown = (event: KeyboardEvent, r: number, c: number) => {
        const step: Record<string, [number, number]> = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };
        const move = step[event.key];
        if (!move) return;
        const next = document.getElementById(`mu-cell-${r + move[0]}-${c + move[1]}`);
        if (next) {
            event.preventDefault();
            next.focus();
        }
    };

    return (
        <div class="view matchup">
            <h1 class="view-title">{headline(threats, brought, theirName)}</h1>
            <p class="view-subtitle">
                {data.formatName ? `${data.formatName} · ` : ""}Single-hit calculations, not a
                battle simulation.
            </p>

            <div class="mu-summary">
                <dl class="mu-plan">
                    <div>
                        <dt>Bring</dt>
                        <dd>{names(rows.filter((i) => brought.has(i)), myName).join(", ")}</dd>
                    </div>
                    <div>
                        <dt>Lead</dt>
                        <dd>
                            {names(data.lead.indices, myName).join(" + ")}
                            {data.lead.opponent?.length > 0 && (
                                <span class="mu-note">
                                    Hardest opposing lead:{" "}
                                    {names(data.lead.opponent, theirName).join(" + ")}
                                </span>
                            )}
                        </dd>
                    </div>
                    <div>
                        <dt>Back</dt>
                        <dd>{names(data.back.indices, myName).join(" + ")}</dd>
                    </div>
                    {bench.length > 0 && (
                        <div class="mu-plan-bench">
                            <dt>Bench</dt>
                            <dd>{names(bench, myName).join(", ")}</dd>
                        </div>
                    )}
                </dl>

                <section class="mu-threats" aria-label="Their biggest threats">
                    <h2>
                        Their biggest threats
                        {trickRoom && <span class="mu-mode"> under Trick Room</span>}
                    </h2>
                    <ol>
                        {threats.slice(0, 3).map((t) => (
                            <ThreatLine
                                key={t.opponent}
                                threat={t}
                                name={theirName(t.opponent)}
                                trickRoom={trickRoom}
                                brought={brought}
                                losses={
                                    matrix.filter(
                                        (row) =>
                                            row[t.opponent] &&
                                            shown(row[t.opponent], trickRoom) === "Loses",
                                    ).length
                                }
                                total={matrix.length}
                            />
                        ))}
                    </ol>
                </section>
            </div>

            <div class="mu-toolbar">
                <div class="mu-toggle" role="group" aria-label="Speed order">
                    <button
                        type="button"
                        aria-pressed={!trickRoom}
                        onClick={() => onTrickRoom?.(false)}
                    >
                        Normal Speed
                    </button>
                    <button
                        type="button"
                        aria-pressed={trickRoom}
                        onClick={() => onTrickRoom?.(true)}
                    >
                        Trick Room
                    </button>
                </div>
                <p class="mu-toolbar-note" aria-live="polite">
                    {trickRoom
                        ? `Trick Room changes ${flipped} of ${matrix.length * matrix[0].length} verdicts (dotted). The bring, lead and threat ranks are for normal Speed.`
                        : "Each cell: the verdict, then the hardest hit you deal and take, as % of HP."}
                </p>
            </div>

            <div class="mu-wrap">
                <table class="mu-table">
                    <caption class="mu-sr">
                        Verdict for each of your Pokémon against each of theirs,{" "}
                        {trickRoom ? "under Trick Room" : "at normal Speed"}
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col" class="mu-corner">
                                <span>Yours</span>
                                <span>Theirs</span>
                            </th>
                            {cols.map((j) => {
                                const threat = threatAt.get(j);
                                return (
                                    <th scope="col" key={j} class="mu-col">
                                        <span
                                            class={
                                                threat && threat.rank <= 3
                                                    ? "mu-rank mu-rank-top"
                                                    : "mu-rank"
                                            }
                                        >
                                            {threat ? `Threat ${threat.rank}` : "Unranked"}
                                        </span>
                                        <span class="mu-name">
                                            {breakAtHyphens(theirName(j))}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((i, r) => {
                            const role = roleOf(i);
                            const firstBench = role === "Bench" && roleOf(rows[r - 1]) !== "Bench";
                            return (
                                <tr
                                    key={i}
                                    class={`mu-row mu-row-${role.toLowerCase()}${firstBench ? " mu-row-split" : ""}`}
                                >
                                    <th scope="row" class="mu-rowhead">
                                        <span class="mu-name">{breakAtHyphens(myName(i))}</span>
                                        <span class={`mu-role mu-role-${role.toLowerCase()}`}>
                                            {role}
                                        </span>
                                    </th>
                                    {cols.map((j, c) => {
                                        const cell = matrix[i][j];
                                        const verdict = shown(cell, trickRoom);
                                        const changed =
                                            trickRoom && cell.verdict !== cell.trickRoomVerdict;
                                        const isSelected =
                                            selected?.member === i && selected?.opponent === j;
                                        return (
                                            <td key={j} class="mu-td">
                                                <button
                                                    type="button"
                                                    id={`mu-cell-${r}-${c}`}
                                                    class={`mu-cell ${VERDICT_CLASS[verdict] ?? "mu-v-trade"}${changed ? " mu-changed" : ""}`}
                                                    aria-pressed={isSelected}
                                                    aria-controls="mu-detail"
                                                    aria-label={
                                                        `${cell.pokemon} against ${cell.target}: ${verdict}` +
                                                        `${changed ? `, ${cell.verdict} at normal Speed` : ""}. ` +
                                                        `Deals ${rounded(cell.deals)}, takes ${rounded(cell.takes)}.`
                                                    }
                                                    onClick={() =>
                                                        onSelect?.({ member: i, opponent: j })
                                                    }
                                                    onKeyDown={(event) => onKeyDown(event, r, c)}
                                                >
                                                    <span class="mu-verdict">{verdict}</span>
                                                    <span class="mu-range">
                                                        <span class="mu-range-k">deal</span>{" "}
                                                        {rounded(cell.deals)}
                                                    </span>
                                                    <span class="mu-range">
                                                        <span class="mu-range-k">take</span>{" "}
                                                        {rounded(cell.takes)}
                                                    </span>
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ul class="mu-legend" aria-label="What the verdicts mean">
                {VERDICT_MEANING.map(([verdict, meaning]) => (
                    <li key={verdict}>
                        <span class={`mu-swatch ${VERDICT_CLASS[verdict]}`}>{verdict}</span>{" "}
                        {meaning}
                    </li>
                ))}
            </ul>

            <section id="mu-detail" class="mu-detail" aria-live="polite">
                {chosen ? (
                    <Detail data={data} cell={chosen} trickRoom={trickRoom} />
                ) : (
                    <p class="mu-hint">
                        Select a matchup for its moves, KO odds and Speed order under Tailwind
                        and Trick Room.
                    </p>
                )}
            </section>
        </div>
    );
}

function ThreatLine({
    threat,
    name,
    trickRoom,
    brought,
    losses,
    total,
}: {
    threat: Threat;
    name: string;
    trickRoom: boolean;
    brought: Set<number>;
    losses: number;
    total: number;
}) {
    const answers = trickRoom ? threat.trickRoomAnswers : threat.answers;
    const mine = answers.filter((a) => brought.has(a.member));
    const benched = answers.filter((a) => !brought.has(a.member));
    return (
        <li>
            <span class="mu-threat-name">{name}</span>{" "}
            <span class="mu-threat-beats">
                beats {losses} of {total}
            </span>
            <span class="mu-threat-answers">
                {mine.length === 0 ? (
                    <strong class="mu-unanswered">
                        {benched.length > 0 ? "No answer in your four" : "No answer"}
                    </strong>
                ) : (
                    mine.map((a, k) => (
                        <Fragment key={a.member}>
                            {k > 0 && ", "}
                            {a.pokemon} <span class="mu-answer-verdict">({a.verdict})</span>
                        </Fragment>
                    ))
                )}
                {benched.length > 0 && (
                    <span class="mu-benched">
                        {" "}
                        · on the bench: {benched.map((a) => `${a.pokemon} (${a.verdict})`).join(", ")}
                    </span>
                )}
            </span>
        </li>
    );
}

function Detail({
    data,
    cell,
    trickRoom,
}: {
    data: MatchupData;
    cell: MatchupCell;
    trickRoom: boolean;
}) {
    const support = data.speedNotes.filter(
        (note) =>
            note.member === cell.member &&
            note.opponent === cell.opponent &&
            !FIELD_KINDS.has(note.kind),
    );
    const active = trickRoom ? "trickRoom" : "normal";
    return (
        <Fragment>
            <h2>
                {cell.pokemon} <span class="mu-vs">vs</span> {cell.target}
            </h2>
            <p class="mu-detail-verdicts">
                <span class={`mu-swatch ${VERDICT_CLASS[cell.verdict] ?? "mu-v-trade"}`}>
                    {cell.verdict}
                </span>{" "}
                at normal Speed ·{" "}
                <span class={`mu-swatch ${VERDICT_CLASS[cell.trickRoomVerdict] ?? "mu-v-trade"}`}>
                    {cell.trickRoomVerdict}
                </span>{" "}
                under Trick Room
            </p>
            <div class="mu-hits">
                <HitBlock title="You deal" hit={cell.deals} set={data.team?.[cell.member]} />
                <HitBlock title="You take" hit={cell.takes} set={data.opponent?.[cell.opponent]} />
            </div>
            <h3>
                Who moves first{" "}
                <span class="mu-speed-stat">
                    Speed {cell.speed.member} vs {cell.speed.threat}
                </span>
            </h3>
            <dl class="mu-speed">
                {SPEED_MODES.map(([mode, label]) => (
                    <div key={mode} class={mode === active ? "mu-speed-active" : undefined}>
                        <dt>{label}</dt>
                        <dd>{ORDER_LABEL[cell.speed[mode]] ?? String(cell.speed[mode])}</dd>
                    </div>
                ))}
            </dl>
            {support.length > 0 && (
                <Fragment>
                    <h3>With a teammate's support (not counted in the verdict)</h3>
                    <ul class="mu-support">
                        {support.map((note, k) => (
                            <li key={k}>{note.detail}</li>
                        ))}
                    </ul>
                </Fragment>
            )}
        </Fragment>
    );
}

function HitBlock({ title, hit, set }: { title: string; hit: Hit | null; set?: SetEcho }) {
    return (
        <div class="mu-hit">
            <h3>{title}</h3>
            {hit ? (
                <Fragment>
                    <p class="mu-hit-main">
                        <strong>{hit.move}</strong> {hit.minPercent}–{hit.maxPercent}%
                    </p>
                    <p class="mu-hit-ko">
                        {hit.knockOut || "No KO within range"}
                        {hit.conditions ? ` · ${hit.conditions}` : ""}
                    </p>
                </Fragment>
            ) : (
                <p class="mu-hit-main">No damaging move calculated</p>
            )}
            {set && (
                <p class="mu-set">
                    {[set.pokemon, set.item || "no item", set.ability, set.nature]
                        .filter((part) => typeof part === "string" && part)
                        .join(" · ")}
                </p>
            )}
        </div>
    );
}

/** The finding to lead with: which of their Pokémon the chosen four cannot answer. */
function headline(threats: Threat[], brought: Set<number>, name: (j: number) => string): string {
    const open = threats.filter((t) => !t.answers.some((a) => brought.has(a.member)));
    if (open.length === 0) return "Your four have an answer to each of their Pokémon";
    const first = name(open[0].opponent);
    // "Your team" when nobody on the six answers it either, so the bench is not implied.
    const who = open[0].answers.length === 0 ? "Your team has" : "Your four have";
    return open.length === 1
        ? `${who} no answer to ${first}`
        : `${who} no answer to ${first}, and ${open.length - 1} more of theirs go unanswered`;
}

/** "Charizard-Mega-Y" may wrap after a hyphen, never inside a word. */
function breakAtHyphens(name: string) {
    const parts = name.split("-");
    return parts.map((part, i) => (
        <Fragment key={i}>
            {part}
            {i < parts.length - 1 && "-"}
            {i < parts.length - 1 && <wbr />}
        </Fragment>
    ));
}
