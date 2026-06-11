import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonParams, getMonsIndex, type MonPageData } from "@/lib/mon-pages";
import { formatMonthLong, getLatestReport } from "@/lib/reports";

export const dynamic = "force-static";
export const dynamicParams = false;

interface PageProps {
    params: Promise<{ id: string; format: string }>;
}

export function generateStaticParams() {
    return getMonParams();
}

async function loadMon(format: string, id: string): Promise<MonPageData | null> {
    if (!getMonsIndex()[format]?.ids.includes(id)) return null;
    const data = await import(`@/data/mons/${format}/${id}.json`);
    return data.default as MonPageData;
}

const pctOfTotal = (value: number) => `${value.toFixed(1)}%`;
const usagePct = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id, format } = await params;
    const mon = await loadMon(format, id);
    if (!mon) return { title: "Pokémon Not Found" };

    const latest = mon.history[mon.history.length - 1];
    const title = `${mon.name} — ${mon.formatLabel} Usage Stats & Trends`;
    const description = `${mon.name} ranks #${latest.rank} in ${mon.formatLabel} with ${usagePct(latest.usage)} usage as of ${formatMonthLong(mon.dataThrough)}. Month-over-month usage history, top moves, items, abilities, teammates, and counters from Smogon ladder data.`;

    return {
        title,
        description,
        alternates: { canonical: `https://www.pokemcp.com/pokemon/${id}/${format}` },
        openGraph: { title, description },
    };
}

function PercentTable({
    title,
    rows,
    nameHeader,
}: {
    title: string;
    rows: [string, number][];
    nameHeader: string;
}) {
    if (rows.length === 0) return null;
    return (
        <section>
            <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                {title}
            </h2>
            <table className="w-full max-w-md border-collapse text-sm">
                <thead className="border-b border-border text-left">
                    <tr>
                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                            {nameHeader}
                        </th>
                        <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                            Share
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([name, value]) => (
                        <tr key={name}>
                            <td className="border-b border-border px-3 py-2 text-foreground">
                                {name}
                            </td>
                            <td className="border-b border-border px-3 py-2 text-foreground">
                                {pctOfTotal(value)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

export default async function MonPage({ params }: PageProps) {
    const { id, format } = await params;
    const mon = await loadMon(format, id);
    if (!mon) notFound();

    const latest = mon.history[mon.history.length - 1];
    const first = mon.history[0];
    const monthsOnRecord = mon.history.filter((point) => point.usage > 0).length;
    const trendDelta = latest.usage - first.usage;
    const trendWord =
        mon.history.length < 2 || Math.abs(trendDelta) < 0.01
            ? "held steady"
            : trendDelta > 0
              ? `risen ${(trendDelta * 100).toFixed(2)} points`
              : `fallen ${(Math.abs(trendDelta) * 100).toFixed(2)} points`;
    const latestReport = getLatestReport(mon.slug);

    return (
        <article className="mx-auto w-full max-w-3xl px-4 py-10">
            <header className="mb-8 border-b border-border pb-6">
                <p className="signal-mono mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <Link href="/reports" className="hover:text-foreground">
                        Meta Reports
                    </Link>{" "}
                    / {mon.formatLabel}
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                    {mon.name} — {mon.formatLabel} usage stats and trends
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    Data through {formatMonthLong(mon.dataThrough)} · Smogon weighted ladder
                    statistics
                </p>
            </header>

            <p className="my-4 leading-7 text-muted-foreground">
                <strong className="font-semibold text-foreground">{mon.name}</strong> ranks #
                {latest.rank} in {mon.formatLabel} with {usagePct(latest.usage)} usage as of{" "}
                {formatMonthLong(mon.dataThrough)}. Over {monthsOnRecord} month
                {monthsOnRecord === 1 ? "" : "s"} on record its usage has {trendWord}.
            </p>

            <section>
                <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                    Usage history
                </h2>
                <table className="w-full max-w-md border-collapse text-sm">
                    <thead className="border-b border-border text-left">
                        <tr>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Month
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Usage
                            </th>
                            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                Rank
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {mon.history.map((point) => (
                            <tr key={point.month}>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {formatMonthLong(point.month)}
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {point.usage > 0 ? usagePct(point.usage) : "—"}
                                </td>
                                <td className="border-b border-border px-3 py-2 text-foreground">
                                    {point.rank ?? "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            <PercentTable title={`Top ${mon.name} moves`} rows={mon.moves} nameHeader="Move" />
            <PercentTable title={`Top ${mon.name} items`} rows={mon.items} nameHeader="Item" />
            <PercentTable title="Abilities" rows={mon.abilities} nameHeader="Ability" />
            <PercentTable
                title="Common EV spreads (Showdown ladder)"
                rows={mon.spreads}
                nameHeader="Spread"
            />
            <PercentTable title="Tera types" rows={mon.teraTypes} nameHeader="Tera type" />
            <PercentTable
                title={`Common ${mon.name} teammates`}
                rows={mon.teammates}
                nameHeader="Teammate"
            />

            {mon.counters.length > 0 && (
                <section>
                    <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                        Checks and counters
                    </h2>
                    <table className="w-full border-collapse text-sm">
                        <thead className="border-b border-border text-left">
                            <tr>
                                <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                    Pokémon
                                </th>
                                <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                    Score
                                </th>
                                <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                    KO %
                                </th>
                                <th className="signal-mono px-3 py-2 font-medium text-muted-foreground">
                                    Switch-out %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {mon.counters.map((counter) => (
                                <tr key={counter.name}>
                                    <td className="border-b border-border px-3 py-2 text-foreground">
                                        {counter.name}
                                    </td>
                                    <td className="border-b border-border px-3 py-2 text-foreground">
                                        {counter.score.toFixed(2)}
                                    </td>
                                    <td className="border-b border-border px-3 py-2 text-foreground">
                                        {counter.koPct.toFixed(1)}%
                                    </td>
                                    <td className="border-b border-border px-3 py-2 text-foreground">
                                        {counter.switchPct.toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Score: higher means more effective against {mon.name}. KO % is how often{" "}
                        {mon.name} is knocked out by the counter; switch-out % is how often it
                        switches out against it.
                    </p>
                </section>
            )}

            <section>
                <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground">
                    Is {mon.name} good in {mon.formatLabel}?
                </h2>
                <p className="my-4 leading-7 text-muted-foreground">
                    By usage, {mon.name} is the #{latest.rank} pick in {mon.formatLabel} at{" "}
                    {usagePct(latest.usage)} of weighted teams as of{" "}
                    {formatMonthLong(mon.dataThrough)}, and its usage has {trendWord} over the
                    months on record. Usage is not a tier rating — but at this rate you should
                    either have a plan for {mon.name} or a reason you are not running it.
                </p>
            </section>

            <footer className="mt-12 space-y-6 border-t border-border pt-6">
                {latestReport && (
                    <p className="text-sm text-muted-foreground">
                        For the full picture, read the{" "}
                        <Link
                            href={`/reports/${mon.slug}`}
                            className="text-foreground underline underline-offset-4"
                        >
                            latest {mon.formatLabel} meta report
                        </Link>
                        .
                    </p>
                )}
                <section className="chat-first-panel rounded-lg p-5">
                    <h2 className="text-base font-semibold text-foreground">
                        Building a team with {mon.name}?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        The PokeMCP team builder checks your coverage against the counters above and
                        validates the team for {mon.formatLabel}.
                    </p>
                    <Link
                        href="/builder"
                        className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                        Open the team builder
                    </Link>
                </section>
            </footer>
        </article>
    );
}
