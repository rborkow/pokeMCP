import type { BaseStats } from "../types.js";

/**
 * A Mega Evolution available within a regulation.
 *
 * Records the Pokémon species that can Mega-evolve, the item that triggers
 * it, and the post-Mega stat line. Champions uses the Omni Ring: only one
 * Mega Stone can be held on a team at a time, but the post-Mega data still
 * needs to be surfaced by the teambuilder so type-coverage and threat-matrix
 * analyses can reflect the "as-Mega" state.
 *
 * The post-Mega fields are optional because Champions introduces exclusive
 * Mega forms (e.g. Meganium-Mega) whose canonical data has not been
 * published by The Pokémon Company at the time of writing. Callers must
 * handle `undefined` post-Mega fields gracefully — typically by falling
 * back to the base Pokémon's data and showing a "data pending" notice.
 */
export interface MegaForm {
    /** Base Pokémon display name, e.g. "Charizard". */
    basePokemon: string;
    /**
     * Showdown form id (result of `toID()` on the mega display name), e.g.
     * "charizardmegax". `undefined` for Champions-exclusive Megas that
     * Showdown does not model.
     */
    formId?: string;
    /** Mega display name, e.g. "Charizard-Mega-X". */
    megaName: string;
    /** Item that triggers the Mega Evolution, e.g. "Charizardite X". */
    megaStone: string;
    /** Post-Mega types. `undefined` while data is pending. */
    postMegaTypes?: string[];
    /** Post-Mega ability. `undefined` while data is pending. */
    postMegaAbility?: string;
    /** Post-Mega base stats. `undefined` while data is pending. */
    postMegaBaseStats?: BaseStats;
    /**
     * True for Megas that exist only on the Champions platform. Used by the
     * UI to show a "data pending" banner and by the roadmap to gate work
     * that requires authoritative values.
     */
    championsExclusive?: boolean;
    /** Free-form notes (source, caveats, etc.). Surfaced in UI tooltips. */
    notes?: string;
}

/**
 * Mega Evolution registry for Pokémon Champions — Regulation M-A (Omni Ring).
 *
 * Stat lines for the seven returning Gen 6/7 Megas are the canonical values
 * from Pokémon Showdown / Bulbapedia and match the pre-Champions data.
 * Meganium-Mega is marked championsExclusive with pending data — the field
 * is present so UI consumers can render it as a selectable option while
 * surfacing a "stats TBD" notice.
 */
export const CHAMPIONS_REGMA_MEGAS: MegaForm[] = [
    {
        basePokemon: "Charizard",
        megaName: "Charizard-Mega-X",
        formId: "charizardmegax",
        megaStone: "Charizardite X",
        postMegaTypes: ["Fire", "Dragon"],
        postMegaAbility: "Tough Claws",
        postMegaBaseStats: { hp: 78, atk: 130, def: 111, spa: 130, spd: 85, spe: 100 },
    },
    {
        basePokemon: "Charizard",
        megaName: "Charizard-Mega-Y",
        formId: "charizardmegay",
        megaStone: "Charizardite Y",
        postMegaTypes: ["Fire", "Flying"],
        postMegaAbility: "Drought",
        postMegaBaseStats: { hp: 78, atk: 104, def: 78, spa: 159, spd: 115, spe: 100 },
    },
    {
        basePokemon: "Gengar",
        megaName: "Gengar-Mega",
        formId: "gengarmega",
        megaStone: "Gengarite",
        postMegaTypes: ["Ghost", "Poison"],
        postMegaAbility: "Shadow Tag",
        postMegaBaseStats: { hp: 60, atk: 65, def: 80, spa: 170, spd: 95, spe: 130 },
    },
    {
        basePokemon: "Lucario",
        megaName: "Lucario-Mega",
        formId: "lucariomega",
        megaStone: "Lucarionite",
        postMegaTypes: ["Fighting", "Steel"],
        postMegaAbility: "Adaptability",
        postMegaBaseStats: { hp: 70, atk: 145, def: 88, spa: 140, spd: 70, spe: 112 },
    },
    {
        basePokemon: "Kangaskhan",
        megaName: "Kangaskhan-Mega",
        formId: "kangaskhanmega",
        megaStone: "Kangaskhanite",
        postMegaTypes: ["Normal"],
        postMegaAbility: "Parental Bond",
        postMegaBaseStats: { hp: 105, atk: 125, def: 100, spa: 60, spd: 100, spe: 100 },
    },
    {
        basePokemon: "Gyarados",
        megaName: "Gyarados-Mega",
        formId: "gyaradosmega",
        megaStone: "Gyaradosite",
        postMegaTypes: ["Water", "Dark"],
        postMegaAbility: "Mold Breaker",
        postMegaBaseStats: { hp: 95, atk: 155, def: 109, spa: 70, spd: 130, spe: 81 },
    },
    {
        basePokemon: "Gardevoir",
        megaName: "Gardevoir-Mega",
        formId: "gardevoirmega",
        megaStone: "Gardevoirite",
        postMegaTypes: ["Psychic", "Fairy"],
        postMegaAbility: "Pixilate",
        postMegaBaseStats: { hp: 68, atk: 85, def: 65, spa: 165, spd: 135, spe: 100 },
    },
    {
        basePokemon: "Meganium",
        megaName: "Meganium-Mega",
        megaStone: "Meganiumite",
        championsExclusive: true,
        notes:
            "Champions-exclusive Mega introduced alongside the Omni Ring. Post-Mega " +
            "types, ability, and base stats are pending authoritative publication " +
            "by The Pokémon Company — UI should render a 'stats TBD' notice.",
    },
];
