/**
 * Tests for the Champions legality HTML parser in scripts/fetch-champions-legality.ts.
 *
 * We don't hit the live page in tests. Instead we feed known-shape HTML
 * through the parser to catch regressions if The Pokémon Company's markup
 * changes.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
    normalizeChampionsFormName,
    parseChampionsLegalityHtml,
} from "../regulations/champions-html-parser.js";

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

    it("parses the client-rendered `const pokemons = [...]` array (M-B shape)", () => {
        const entries = MANY_POKEMON.map(
            (p, i) => `["${String(i).padStart(4, "0")}-000", 1, "${p}"]`,
        );
        const html = `<div id="pokemons"></div><script>const pokemons = [${entries.join(", ")}];</script>`;
        const { names, diagnostics } = parseChampionsLegalityHtml(html);
        for (const p of MANY_POKEMON) {
            assert.ok(names.includes(p), `missing ${p}`);
        }
        assert.ok(
            diagnostics.some((d) => d.startsWith("pokemons[] array:")),
            "should report the array pattern in diagnostics",
        );
    });

    it("normalizes parenthetical form names from the M-B array to Showdown shape", () => {
        const html = `<script>const pokemons = [${MANY_POKEMON.map(
            (p, i) => `["${String(i).padStart(4, "0")}-000", 1, "${p}"]`,
        ).join(
            ", ",
        )}, ["0026-001", 1, "Raichu (Alolan Form)"], ["0479-002", 1, "Rotom (Wash Rotom)"], ["0128-001", 1, "Tauros (Paldean Form (Combat Breed))"]];</script>`;
        const { names } = parseChampionsLegalityHtml(html);
        assert.ok(names.includes("Raichu-Alola"), "Raichu-Alola");
        assert.ok(names.includes("Rotom-Wash"), "Rotom-Wash");
        assert.ok(names.includes("Tauros-Paldea-Combat"), "Tauros-Paldea-Combat");
    });
});

describe("normalizeChampionsFormName", () => {
    const cases: [string, string][] = [
        ["Venusaur", "Venusaur"],
        ["Mr. Rime", "Mr. Rime"],
        ["Landorus-Therian", "Landorus-Therian"], // already Showdown-shaped
        ["Raichu (Alolan Form)", "Raichu-Alola"],
        ["Slowbro (Galarian Form)", "Slowbro-Galar"],
        ["Arcanine (Hisuian Form)", "Arcanine-Hisui"],
        ["Tauros (Paldean Form (Combat Breed))", "Tauros-Paldea-Combat"],
        ["Tauros (Paldean Form (Blaze Breed))", "Tauros-Paldea-Blaze"],
        ["Tauros (Paldean Form (Aqua Breed))", "Tauros-Paldea-Aqua"],
        ["Rotom (Rotom)", "Rotom"],
        ["Rotom (Heat Rotom)", "Rotom-Heat"],
        ["Rotom (Mow Rotom)", "Rotom-Mow"],
        ["Meowstic (Male)", "Meowstic"],
        ["Meowstic (Female)", "Meowstic-F"],
        ["Basculegion (Female)", "Basculegion-F"],
        ["Gourgeist (Medium Variety)", "Gourgeist"],
        ["Gourgeist (Small Variety)", "Gourgeist-Small"],
        ["Gourgeist (Jumbo Variety)", "Gourgeist-Super"],
        ["Lycanroc (Midday Form)", "Lycanroc"],
        ["Lycanroc (Midnight Form)", "Lycanroc-Midnight"],
        ["Lycanroc (Dusk Form)", "Lycanroc-Dusk"],
    ];

    for (const [input, expected] of cases) {
        it(`maps "${input}" -> "${expected}"`, () => {
            assert.equal(normalizeChampionsFormName(input), expected);
        });
    }

    it("throws on an unrecognized parenthetical form (fails loudly)", () => {
        assert.throws(
            () => normalizeChampionsFormName("Pikachu (Cosplay Form)"),
            /Unrecognized Champions form/,
        );
    });
});
