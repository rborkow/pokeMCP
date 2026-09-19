import { z } from "zod";
import {
    aggregateUsage,
    type Event,
    loadEvents,
    type Placing,
    type Slot,
    slotToPaste,
} from "../tournaments.js";
import type { ToolDefinition } from "./registry.js";

interface TournamentArgs {
    days?: number;
    limit?: number;
    pokemon?: string;
    minPlayers?: number;
}

function toId(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isoDate(date: string): string {
    return date.slice(0, 10);
}

function header(events: Event[], days: number): string {
    return [
        `**Limitless tournaments — Regulation M-C** (${events.length} events, last ${days} days)`,
        "_Source: play.limitlesstcg.com via src/cached-tournaments/champions-regmc; open team sheets carry no Stat Points_",
    ].join("\n");
}

function matchSlot(queryId: string, slot: Slot): boolean {
    return toId(slot.name) === queryId || toId(slot.id) === queryId;
}

function pokemonSection(events: Event[], pokemon: string, limit: number): string {
    const queryId = toId(pokemon);
    const hits: { event: Event; placing: Placing; slot: Slot }[] = [];
    for (const e of events) {
        for (const p of e.topCut) {
            const slot = p.team.find((s) => matchSlot(queryId, s));
            if (slot) hits.push({ event: e, placing: p, slot });
        }
    }
    const shown = hits.slice(0, limit);
    const blocks = shown.map(({ event: e, placing: p, slot }) => {
        const teammates = p.team.filter((s) => s !== slot).map((s) => s.name);
        return [
            `### ${e.name} — #${p.placing} ${p.player} (${isoDate(e.date)}, ${e.players} players)`,
            "",
            slotToPaste(slot),
            `Teammates: ${teammates.join(", ")}`,
        ].join("\n");
    });
    const count = `**${pokemon}: ${hits.length} top-cut appearance${hits.length === 1 ? "" : "s"}**${hits.length > shown.length ? ` (showing ${shown.length})` : ""}`;
    return [
        count,
        ...(blocks.length
            ? ["", blocks.join("\n\n")]
            : ["", "No top-cut team carried it in the window."]),
    ].join("\n");
}

function usageAndEvents(events: Event[], limit: number): string {
    const usage = aggregateUsage(events)
        .slice(0, 25)
        .map((u) => `- ${u.name} ${u.pct}% (${u.teams})`)
        .join("\n");
    const shownEvents = events.slice(0, limit);
    const eventLines = shownEvents
        .map((e) => {
            const winner = e.topCut.find((p) => p.placing === 1) ?? e.topCut[0];
            const team = winner ? ` [${winner.team.map((s) => s.name).join(", ")}]` : "";
            return `- ${isoDate(e.date)} **${e.name}** — ${e.players} players — winner: ${winner?.player ?? "?"}${team} — ${e.sourceUrl}`;
        })
        .join("\n");
    return [
        "**Top-cut usage (share of top-cut teams):**",
        usage || "_none_",
        "",
        "**Events:**",
        eventLines || "_none_",
    ].join("\n");
}

export async function getTournamentTeams(args: TournamentArgs): Promise<string> {
    const days = args.days ?? 30;
    const minPlayers = args.minPlayers ?? 48;
    const cutoff = Date.now() - days * 86_400_000;
    const events = loadEvents().filter(
        (e) => new Date(e.date).getTime() >= cutoff && e.players >= minPlayers,
    );
    if (events.length === 0) {
        return "No cached Reg M-C events in window. Run `bun run fetch-tournaments` at repo root.";
    }
    const parts = [header(events, days)];
    parts.push(
        args.pokemon
            ? pokemonSection(events, args.pokemon, args.limit ?? 10)
            : usageAndEvents(events, args.limit ?? 5),
    );
    return parts.join("\n\n");
}

export const getTournamentTeamsTool: ToolDefinition = {
    name: "get_tournament_teams",
    description:
        "Top-cut teams from recent Regulation M-C tournaments (Limitless cache): aggregate usage, event list with winners, or every top-cut set for one Pokémon. Open team sheets carry no Stat Point spreads — use get_usage for those.",
    schema: {
        days: z.number().int().optional().describe("Lookback window in days (default 30)"),
        limit: z
            .number()
            .int()
            .optional()
            .describe(
                "Max results: sets when filtering by Pokémon (default 10), else events listed (default 5)",
            ),
        pokemon: z
            .string()
            .optional()
            .describe("Show every top-cut set of this Pokémon (name or id, case insensitive)"),
        minPlayers: z
            .number()
            .int()
            .optional()
            .describe("Only events with at least this many players (default 48)"),
    },
    execute: (args) => getTournamentTeams(args as TournamentArgs),
};
