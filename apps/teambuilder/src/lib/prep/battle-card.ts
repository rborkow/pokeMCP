import { MOVES } from "@/lib/data/moves";
import {
    getPokemonTypes,
    TYPE_EFFECTIVENESS,
    type PokemonType,
} from "@/lib/data/pokemon-types";
import { toID } from "@/lib/showdown-parser";
import type { TeamPokemon } from "@/types/pokemon";
import {
    BattleCardSchema,
    type BattleCard,
    type EvidenceReference,
    type TeamSnapshot,
} from "./schema";

const SPEED_CONTROL = new Set([
    "tailwind",
    "trickroom",
    "icywind",
    "electroweb",
    "thunderwave",
    "scaryface",
]);
const REDIRECTION = new Set(["followme", "ragepowder"]);
const DISRUPTION = new Set(["fakeout", "taunt", "encore", "spore", "sleeppowder"]);
const PROTECT = new Set(["protect", "detect", "kingsshield", "spikyshield"]);
const SPREAD_MOVES = new Set([
    "heatwave",
    "rockslide",
    "earthquake",
    "dazzlinggleam",
    "hypervoice",
    "blizzard",
]);

const moveIds = (pokemon: TeamPokemon) => new Set(pokemon.moves.map(toID));
const hasAny = (pokemon: TeamPokemon, set: Set<string>) =>
    pokemon.moves.some((move) => set.has(toID(move)));

function effectiveness(attackType: PokemonType, defender: TeamPokemon): number {
    return getPokemonTypes(defender.pokemon).reduce(
        (value, type) => value * (TYPE_EFFECTIVENESS[attackType]?.[type] ?? 1),
        1,
    );
}

function pressureScore(pokemon: TeamPokemon, opponent: TeamPokemon[]): number {
    let score = 0;
    for (const move of pokemon.moves) {
        const data = MOVES[move];
        if (!data || data.category === "Status") continue;
        const attackType = data.type as PokemonType;
        score += Math.max(...opponent.map((target) => effectiveness(attackType, target)), 1) - 1;
    }
    if (hasAny(pokemon, SPEED_CONTROL)) score += 2;
    if (hasAny(pokemon, DISRUPTION)) score += 1.5;
    if (hasAny(pokemon, REDIRECTION)) score += 1.25;
    if (hasAny(pokemon, PROTECT)) score += 0.25;
    return score;
}

function roleFor(pokemon: TeamPokemon, opponent: TeamPokemon[]) {
    const ids = moveIds(pokemon);
    const superEffectiveTargets = new Set<string>();
    for (const move of pokemon.moves) {
        const data = MOVES[move];
        if (!data || data.category === "Status") continue;
        for (const target of opponent) {
            if (effectiveness(data.type as PokemonType, target) > 1) {
                superEffectiveTargets.add(target.pokemon);
            }
        }
    }

    if ([...ids].some((id) => SPEED_CONTROL.has(id))) {
        return {
            role: "Pace control",
            note: superEffectiveTargets.size
                ? `Sets the speed mode and pressures ${[...superEffectiveTargets].slice(0, 2).join(" and ")}.`
                : "Sets the speed mode so the partner can act on favorable turns.",
        };
    }
    if ([...ids].some((id) => REDIRECTION.has(id))) {
        return {
            role: "Board protection",
            note: "Redirects pressure and creates a safer setup or damage turn for its partner.",
        };
    }
    if ([...ids].some((id) => DISRUPTION.has(id))) {
        return {
            role: "Disruption",
            note: "Creates tempo with Fake Out, sleep, Taunt, or Encore before committing damage.",
        };
    }
    if (superEffectiveTargets.size) {
        return {
            role: "Primary pressure",
            note: `Has super-effective coverage into ${[...superEffectiveTargets].slice(0, 3).join(", ")}.`,
        };
    }
    return {
        role: "Flexible slot",
        note: "Use its resistances, positioning tools, and neutral damage to stabilize the board.",
    };
}

function rankedTeam(team: TeamPokemon[], opponent: TeamPokemon[]) {
    return team
        .map((pokemon, index) => ({ pokemon, index, score: pressureScore(pokemon, opponent) }))
        .sort((a, b) => b.score - a.score || a.index - b.index);
}

function leadPair(
    ranked: ReturnType<typeof rankedTeam>,
    offset: number,
): [TeamPokemon, TeamPokemon] {
    const first = ranked[offset % ranked.length]?.pokemon ?? ranked[0].pokemon;
    const second =
        ranked.find((entry, index) => index !== offset % ranked.length && entry.pokemon !== first)
            ?.pokemon ?? ranked[1].pokemon;
    return [first, second];
}

function buildDangerPoints(opponent: TeamPokemon[]): BattleCard["dangerPoints"] {
    const points: BattleCard["dangerPoints"] = [];
    const speed = opponent.find((pokemon) => hasAny(pokemon, SPEED_CONTROL));
    const disruption = opponent.find((pokemon) => hasAny(pokemon, DISRUPTION));
    const spread = opponent.find((pokemon) => hasAny(pokemon, SPREAD_MOVES));

    if (speed) {
        points.push({
            title: `${speed.pokemon} can change the speed mode`,
            detail: `Its published set includes ${speed.moves.filter((move) => SPEED_CONTROL.has(toID(move))).join(" or ")}.`,
            response: "Bring a line that can deny, reverse, or function under that speed mode.",
            evidenceIds: ["calc-team-sheet"],
        });
    }
    if (disruption) {
        points.push({
            title: `${disruption.pokemon} can interrupt the first turn`,
            detail: `The set shows ${disruption.moves.filter((move) => DISRUPTION.has(toID(move))).join(" or ")}.`,
            response: "Practice a conservative line that does not depend on both lead slots acting.",
            evidenceIds: ["calc-team-sheet"],
        });
    }
    if (spread) {
        points.push({
            title: "Respect spread damage",
            detail: `${spread.pokemon} carries ${spread.moves.filter((move) => SPREAD_MOVES.has(toID(move))).join(" or ")}.`,
            response: "Avoid leads where both slots concede the same spread attack without counterplay.",
            evidenceIds: ["calc-team-sheet"],
        });
    }
    if (points.length === 0) {
        points.push({
            title: "The exact opening is uncertain",
            detail: "The team sheet does not expose a single obvious speed-control or disruption lead.",
            response: "Use the first game to scout item activation, damage ranges, and protected slots.",
            evidenceIds: ["calc-team-sheet"],
        });
    }
    return points;
}

export function generateBattleCard(
    ownTeam: TeamSnapshot,
    opponentTeam: TeamSnapshot,
): BattleCard {
    const ownRanked = rankedTeam(ownTeam.pokemon, opponentTeam.pokemon);
    const opponentRanked = rankedTeam(opponentTeam.pokemon, ownTeam.pokemon);
    const bringFour = ownRanked.slice(0, 4).map(({ pokemon }) => pokemon.pokemon);
    while (bringFour.length < 4) bringFour.push(ownTeam.pokemon[bringFour.length % ownTeam.pokemon.length].pokemon);

    const primaryLead = leadPair(ownRanked, 0);
    const alternateLead = leadPair(ownRanked, 2);
    const likelyLead = leadPair(opponentRanked, 0);
    const evidence: EvidenceReference[] = [
        {
            id: "calc-team-sheet",
            kind: "calculated",
            label: "Calculated from both team sheets",
            detail: "Roles and priorities use visible moves, abilities, items, typing, and team structure.",
        },
        {
            id: "beta-vp",
            kind: "beta-mechanics",
            label: "Champions mechanics beta",
            detail: "Exact VP-based speed order and unreleased move interactions are not modeled yet.",
        },
    ];
    if (opponentTeam.sourceUrl) {
        evidence.unshift({
            id: "event-source",
            kind: "tournament-source",
            label: opponentTeam.sourceLabel ?? "Published tournament team",
            detail: "Opponent composition and visible set details come from the linked event record.",
            sourceUrl: opponentTeam.sourceUrl,
        });
    }

    return BattleCardSchema.parse({
        matchupRoles: ownTeam.pokemon.map((pokemon) => ({
            pokemon: pokemon.pokemon,
            ...roleFor(pokemon, opponentTeam.pokemon),
            evidenceIds: ["calc-team-sheet"],
        })),
        bringFour,
        leadPlans: [
            {
                pokemon: [primaryLead[0].pokemon, primaryLead[1].pokemon],
                purpose: "Establish your preferred pace while keeping immediate pressure on board.",
                useWhen: "Default when the opponent does not clearly force a defensive opening.",
                evidenceIds: ["calc-team-sheet", "beta-vp"],
            },
            {
                pokemon: [alternateLead[0].pokemon, alternateLead[1].pokemon],
                purpose: "A less committal line for scouting disruption and protecting the back two.",
                useWhen: "Use when the likely opposing lead threatens to deny the primary line.",
                evidenceIds: ["calc-team-sheet", "beta-vp"],
            },
        ],
        likelyOpponentLeads: [
            {
                pokemon: [likelyLead[0].pokemon, likelyLead[1].pokemon],
                purpose: "Pairs the opponent's highest visible control and pressure scores.",
                useWhen: "Treat this as a rehearsal target, not a prediction with a fixed probability.",
                evidenceIds: ["calc-team-sheet"],
            },
        ],
        openingLines: [
            {
                lead: [primaryLead[0].pokemon, primaryLead[1].pokemon],
                primary: "Contest the opponent's setup or speed-control slot before committing the main damage line.",
                alternative: "If their lead is passive, preserve resources and take the safest positional advantage.",
                evidenceIds: ["calc-team-sheet", "beta-vp"],
            },
            {
                lead: [alternateLead[0].pokemon, alternateLead[1].pokemon],
                primary: "Use the flexible lead to reveal their defensive response and keep the strongest attacker in reserve.",
                alternative: "Switch early rather than trading both lead slots into a poor board.",
                evidenceIds: ["calc-team-sheet"],
            },
        ],
        dangerPoints: buildDangerPoints(opponentTeam.pokemon),
        practiceChecklist: [
            { label: `Play three openings into ${likelyLead[0].pokemon} + ${likelyLead[1].pokemon}.`, done: false },
            { label: "Test one line when your preferred speed mode is denied.", done: false },
            { label: "Record the first damage range or item reveal that changes the plan.", done: false },
            { label: "Choose the back-two order for both recommended leads.", done: false },
        ],
        evidence,
    });
}
