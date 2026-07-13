import type { EventPageData, EventPlacing } from "@/lib/event-pages";
import type { TeamPokemon } from "@/types/pokemon";
import { createTeamSnapshot, type OpponentSource, type TeamSnapshot } from "./schema";

export function eventPlacingToPokemon(placing: EventPlacing): TeamPokemon[] {
    return placing.team.map((slot) => ({
        pokemon: slot.name,
        moves: slot.moves,
        ability: slot.ability ?? undefined,
        item: slot.item ?? undefined,
        nature: slot.nature ?? undefined,
        level: 50,
    }));
}

export function eventPlacingToSnapshot(event: EventPageData, placing: EventPlacing): TeamSnapshot {
    return createTeamSnapshot(
        `${placing.player}'s ${event.name} team`,
        "champions-regmb",
        eventPlacingToPokemon(placing),
        {
            id: `${event.slug}-${placing.placing}`,
            sourceLabel: `#${placing.placing} at ${event.name}`,
            sourceUrl: event.sourceUrl,
        },
    );
}

export function eventOpponentSource(event: EventPageData, placing: EventPlacing): OpponentSource {
    return { kind: "event-team", eventId: event.slug, teamId: String(placing.placing) };
}
