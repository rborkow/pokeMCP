/**
 * Connector tools for regulations: listing the supported formats and
 * validating a team against one.
 */
import { toID } from "../data-loader.js";
import { REGULATIONS } from "../regulations/registry.js";
import { validateTeamForRegulationId } from "../regulations/validator.js";
import type { TeamPokemon } from "../types.js";
import { formatFields, getDefaultRegulation, resolveRegulation } from "./formats.js";
import { resolvePokemon } from "./pokemon.js";
import { fail, ok, type ToolOutcome } from "./types.js";

// --- list_formats ---

export function listFormats(): ToolOutcome {
    const defaultFormat = getDefaultRegulation().id;
    const formats = [...REGULATIONS]
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
        .map((r) => ({
            id: r.id,
            name: r.displayName,
            startDate: r.startDate,
            ...(r.endDate ? { endDate: r.endDate } : {}),
            level: r.level,
            teamSize: r.teamSize,
            bringCount: r.bringCount,
            speciesClause: r.enforceSpeciesClause,
            itemClause: r.enforceItemClause,
            megaEvolutions: r.megaForms.length,
            usageStats: Boolean(r.showdownFormatId),
        }));

    const text = [
        `**Supported formats** (default: ${defaultFormat})`,
        "",
        ...formats.map(
            (f) =>
                `- \`${f.id}\` — ${f.name}. Started ${f.startDate}` +
                `${f.endDate ? `, ended ${f.endDate}` : ""}. ` +
                `Bring ${f.bringCount} of ${f.teamSize} at level ${f.level}; ` +
                `${f.megaEvolutions} Mega Evolutions; ` +
                `usage statistics ${f.usageStats ? "available" : "not published yet"}.`,
        ),
    ].join("\n");
    return ok({ defaultFormat, formats }, text);
}

// --- validate_team ---

export interface TeamMemberInput {
    pokemon: string;
    moves?: string[];
    ability?: string;
    item?: string;
}

export async function validateTeam(
    args: { team: TeamMemberInput[]; format?: string },
    env: Env,
): Promise<ToolOutcome> {
    const regulation = resolveRegulation(args.format);
    const errors: string[] = [];
    const warnings: string[] = [];

    // The usage tools report Mega Evolutions under their own names, so accept
    // those here: a Mega is validated as its base Pokémon holding its stone.
    const megaNames = new Map<number, string>();
    const team: TeamPokemon[] = args.team.map((member, index) => {
        const plain: TeamPokemon = { ...member, moves: member.moves ?? [] };
        const resolved = resolvePokemon(member.pokemon);
        if (resolved?.unknownMega && !resolved.mega) {
            megaNames.set(index, resolved.name);
            warnings.push(
                `${resolved.name} is not in this connector's Mega Evolution data, so it was ` +
                    `checked as ${resolved.species.name}.`,
            );
            return { ...plain, pokemon: resolved.species.name };
        }
        const mega = resolved?.mega;
        if (!mega) return plain;

        megaNames.set(index, mega.megaName);
        if (!regulation.megaForms.some((f) => toID(f.megaName) === toID(mega.megaName))) {
            errors.push(`${mega.megaName} is not available in ${regulation.shortLabel}.`);
        }
        if (member.item && toID(member.item) !== toID(mega.megaStone)) {
            errors.push(`${mega.megaName} must hold ${mega.megaStone}, not ${member.item}.`);
        }
        // The Mega's ability replaces the base Pokémon's in battle; it isn't one the base can have.
        const ability =
            member.ability && toID(member.ability) === toID(mega.postMegaAbility ?? "")
                ? undefined
                : member.ability;
        return { ...plain, pokemon: mega.basePokemon, item: mega.megaStone, ability };
    });

    const outcome = await validateTeamForRegulationId(team, regulation.id, env);
    if (outcome.kind === "error") {
        return fail(
            `The allowed Pokémon list for ${regulation.shortLabel} is unavailable right now, ` +
                "so teams can't be validated against it. Try again later, or pick another " +
                "format from list_formats.",
        );
    }

    for (const issue of outcome.result.issues) {
        if (issue.code === "illegal_move") {
            errors.push(
                `${issue.message} according to Pokémon Showdown move data ` +
                    "(moves added only in Pokémon Champions may be missing).",
            );
        } else if (issue.severity === "error") {
            errors.push(issue.message);
        } else {
            warnings.push(issue.message);
        }
    }

    const valid = errors.length === 0;
    const data = {
        ...formatFields(regulation),
        valid,
        errors,
        warnings,
        members: outcome.result.members.map((m, index) => ({
            ...m,
            pokemon: megaNames.get(index) ?? m.pokemon,
        })),
        rules: {
            level: regulation.level,
            teamSize: regulation.teamSize,
            bringCount: regulation.bringCount,
            speciesClause: regulation.enforceSpeciesClause,
            itemClause: regulation.enforceItemClause,
        },
    };

    const statusLabel = {
        allowed: "allowed",
        not_allowed: "not allowed",
        unknown: "not recognised",
    };
    const lines = [
        `**${regulation.displayName}** — team is ${valid ? "valid ✅" : "not valid ❌"}`,
        "",
        ...data.members.map((m) => `- ${m.pokemon}: ${statusLabel[m.status]}`),
    ];
    if (errors.length) lines.push("", "Errors:", ...errors.map((e) => `- ${e}`));
    if (warnings.length) lines.push("", "Cautions:", ...warnings.map((w) => `- ${w}`));
    lines.push(
        "",
        `Rules: bring ${regulation.bringCount} of ${regulation.teamSize} at level ${regulation.level}` +
            `${regulation.enforceSpeciesClause ? ", Species Clause" : ""}` +
            `${regulation.enforceItemClause ? ", Item Clause" : ""}.`,
    );
    return ok(data, lines.join("\n"));
}
