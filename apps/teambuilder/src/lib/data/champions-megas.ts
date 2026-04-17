/**
 * Pokémon Champions Mega Evolution mirror for the teambuilder.
 *
 * This file is a client-side mirror of the MCP worker's
 * `src/regulations/mega-data.ts`. They must stay in sync — any Mega added
 * or corrected in one MUST be applied to the other. Phase 4 may collapse
 * this duplication behind an RPC, but for Phase 3b a local mirror keeps
 * rendering synchronous and removes a network round trip from the
 * analysis panels.
 *
 * Keep the shape identical to the worker's `MegaForm`; consumers assume
 * structural equivalence.
 */

import type { PokemonType } from "./pokemon-types";

export interface MegaForm {
    basePokemon: string;
    formId?: string;
    megaName: string;
    megaStone: string;
    postMegaTypes?: PokemonType[];
    postMegaAbility?: string;
    postMegaBaseStats?: {
        hp: number;
        atk: number;
        def: number;
        spa: number;
        spd: number;
        spe: number;
    };
    championsExclusive?: boolean;
    notes?: string;
}

/**
 * Reg M-A Omni Ring Megas. Mirror of CHAMPIONS_REGMA_MEGAS in
 * src/regulations/mega-data.ts. Keep in sync.
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
