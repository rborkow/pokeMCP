import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { lookupPokemon } from "./lookup-pokemon.js";

describe("lookup_pokemon", () => {
    it("shows base stats, abilities, legal status and Mega forms", async () => {
        const out = await lookupPokemon({ pokemon: "Garchomp" });
        assert.match(out, /108\/130\/95\/80\/85\/102/);
        assert.match(out, /Rough Skin/);
        assert.match(out, /Legal in Reg M-C: yes/);
        assert.match(out, /Garchomp-Mega-Z/);
    });
    it("lists Champions-legal learnset moves with power/PP from the champions mod", async () => {
        const out = await lookupPokemon({ pokemon: "Sneasler", moves: true });
        assert.match(out, /Dire Claw \(Poison, 80 BP, 15 PP\)/);
    });
    it("says so for illegal species", async () => {
        const out = await lookupPokemon({ pokemon: "Mewtwo" });
        assert.match(out, /Legal in Reg M-C: no/);
    });
});
