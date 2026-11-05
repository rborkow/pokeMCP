import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { loadEvents } from "../tournaments.js";
import { getTournamentTeams } from "./get-tournament-teams.js";

describe("get_tournament_teams", {
    skip: loadEvents().length === 0 && "no M-C events cached",
}, () => {
    it("summarises recent M-C events with top-cut usage", async () => {
        const out = await getTournamentTeams({ days: 3650, limit: 3 });
        assert.match(out, /Regulation M-C/);
        assert.match(out, /players/);
        assert.match(out, /Top-cut usage/);
    });
    it("filters by Pokémon and returns full sets", async () => {
        const out = await getTournamentTeams({ days: 3650, pokemon: "Rillaboom" });
        assert.match(out, /Rillaboom @/);
    });
});
