/**
 * Tests for the Champions legality HTML parser in scripts/fetch-champions-legality.ts.
 *
 * We don't hit the live page in tests. Instead we feed known-shape HTML
 * through the parser to catch regressions if The Pokémon Company's markup
 * changes.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { parseChampionsLegalityHtml } from "../regulations/champions-html-parser.js";

const MANY_POKEMON = [
    "Charizard",
    "Blastoise",
    "Venusaur",
    "Gengar",
    "Alakazam",
    "Machamp",
    "Golem",
    "Arcanine",
    "Gyarados",
    "Lapras",
    "Dragonite",
    "Tyranitar",
    "Scizor",
    "Kingdra",
    "Heracross",
    "Meganium",
    "Typhlosion",
    "Feraligatr",
    "Ampharos",
    "Houndoom",
    "Salamence",
    "Metagross",
    "Garchomp",
    "Lucario",
    "Togekiss",
    "Gardevoir",
    "Hydreigon",
    "Volcarona",
    "Excadrill",
    "Chandelure",
    "Haxorus",
    "Ferrothorn",
    "Greninja",
    "Talonflame",
    "Aegislash",
    "Goodra",
    "Dragapult",
    "Mimikyu",
    "Toxapex",
    "Kingambit",
    "Gholdengo",
    "Great Tusk",
    "Iron Valiant",
    "Ogerpon",
    "Roaring Moon",
    "Flutter Mane",
    "Iron Hands",
    "Landorus-Therian",
    "Thundurus-Therian",
    "Tornadus-Therian",
    "Kangaskhan",
    "Incineroar",
    "Rillaboom",
    "Amoonguss",
    "Indeedee-F",
    "Whimsicott",
    "Urshifu",
];

describe("parseChampionsLegalityHtml", () => {
    it("extracts names from data-pokemon attributes", () => {
        const html = MANY_POKEMON.map((p) => `<div data-pokemon="${p}">tile</div>`).join("\n");
        const { names } = parseChampionsLegalityHtml(html);
        for (const p of MANY_POKEMON) {
            assert.ok(names.includes(p), `missing ${p}`);
        }
    });

    it("extracts names from pokemon-name <li>s", () => {
        const html = MANY_POKEMON.map((p) => `<li class="pokemon-name">${p}</li>`).join("\n");
        const { names } = parseChampionsLegalityHtml(html);
        assert.equal(names.length, MANY_POKEMON.length);
    });

    it("throws when the page yields too few names (structural shift)", () => {
        const html = `<div data-pokemon="Garchomp">tile</div>`;
        assert.throws(() => parseChampionsLegalityHtml(html), /structure likely changed/);
    });

    it("deduplicates across patterns", () => {
        const html = [
            ...MANY_POKEMON.map((p) => `<div data-pokemon="${p}">t</div>`),
            ...MANY_POKEMON.slice(0, 5).map((p) => `<li class="pokemon-name">${p}</li>`),
        ].join("\n");
        const { names } = parseChampionsLegalityHtml(html);
        const unique = new Set(names);
        assert.equal(names.length, unique.size, "names should be unique");
    });
});
