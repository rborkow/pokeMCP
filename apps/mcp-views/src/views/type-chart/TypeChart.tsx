/**
 * Defensive type chart: one row per attacking type, one column per team
 * member. Every cell says its state in words as well as colour (DESIGN.md:
 * colour alone never carries meaning).
 *
 * Everything here renders through Preact text nodes. Names come from user
 * input (a recognised name is canonical, but `notFound` echoes what was
 * typed), so nothing may be written as HTML.
 */
import { Fragment } from "preact";
import { useState } from "preact/hooks";
import type { TypeChartData } from "./types.js";

type Cell = "weak" | "resist" | "immune" | "neutral";

const CELL_LABEL: Record<Cell, string> = {
    weak: "Weak",
    resist: "Resists",
    immune: "Immune",
    neutral: "",
};

function cellFor(matchup: TypeChartData["matchups"][number], member: string): Cell {
    if (matchup.immune.includes(member)) return "immune";
    if (matchup.weak.includes(member)) return "weak";
    if (matchup.resist.includes(member)) return "resist";
    return "neutral";
}

type Order = "type" | "risk";

/** Most exposed first: weak minus covered, then raw weak count. */
function riskScore(m: TypeChartData["matchups"][number]): number {
    return (m.weak.length - m.resist.length - m.immune.length) * 10 + m.weak.length;
}

export function TypeChart({ data }: { data: TypeChartData }) {
    const [order, setOrder] = useState<Order>("type");
    const shared = new Set(data.sharedWeaknesses);
    const unresisted = new Set(data.unresisted);
    const rows =
        order === "risk"
            ? [...data.matchups].sort((a, b) => riskScore(b) - riskScore(a))
            : data.matchups;

    return (
        <div class="view type-chart">
            <h1 class="view-title">{headline(data)}</h1>
            <p class="view-subtitle">
                Typing only: abilities, items and moves are not counted.
            </p>

            <div class="toolbar" role="group" aria-label="Row order">
                <button
                    type="button"
                    aria-pressed={order === "type"}
                    onClick={() => setOrder("type")}
                >
                    Type order
                </button>
                <button
                    type="button"
                    aria-pressed={order === "risk"}
                    onClick={() => setOrder("risk")}
                >
                    Most exposed first
                </button>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th scope="col" class="type-col">
                                Attack
                            </th>
                            {data.team.map((member, i) => (
                                <th scope="col" key={`${member.name}-${i}`}>
                                    <span class="member-name">{breakAtHyphens(member.name)}</span>
                                    <span class="member-types">{member.types.join(" / ")}</span>
                                </th>
                            ))}
                            <th scope="col" class="sum-col">
                                Weak · covered
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((m) => {
                            const flag = shared.has(m.type)
                                ? "Shared weakness"
                                : unresisted.has(m.type)
                                  ? "Nothing resists"
                                  : null;
                            return (
                                <tr key={m.type} class={flag ? "flagged" : undefined}>
                                    <th scope="row" class="type-col">
                                        <span class="type-name">{m.type}</span>
                                        {flag && <span class="flag">{flag}</span>}
                                    </th>
                                    {data.team.map((member, i) => {
                                        const cell = cellFor(m, member.name);
                                        return (
                                            <td key={`${member.name}-${i}`} class={`cell ${cell}`}>
                                                {CELL_LABEL[cell]}
                                            </td>
                                        );
                                    })}
                                    <td class="sum-col">
                                        {m.weak.length} · {m.resist.length + m.immune.length}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {data.suggestedTypes.length > 0 && (
                <section class="suggestions">
                    <h2>Types that would patch the most gaps</h2>
                    <ul>
                        {data.suggestedTypes.map((s) => (
                            <li key={s.type}>
                                <strong>{s.type}</strong> resists {s.covers.join(", ")}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {data.notFound.length > 0 && (
                <p class="not-found">Not recognised and skipped: {data.notFound.join(", ")}</p>
            )}
        </div>
    );
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

function headline(data: TypeChartData): string {
    const n = data.sharedWeaknesses.length;
    if (n === 0) return "No type hits two or more of this team super effectively";
    const list = data.sharedWeaknesses.slice(0, 3).join(", ");
    return n === 1
        ? `${list} is this team's shared weakness`
        : `${n} shared weaknesses, led by ${list}`;
}
