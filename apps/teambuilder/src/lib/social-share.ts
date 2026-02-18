import type { TeamPokemon } from "@/types/pokemon";
import { getFormatDisplayName } from "@/types/pokemon";

/**
 * Generate a Twitter/X share URL with pre-filled tweet
 */
export function getTwitterShareUrl(teamUrl: string, format: string, team: TeamPokemon[]): string {
    const pokemonNames = team.map((p) => p.pokemon).join(", ");
    const formatName = getFormatDisplayName(format);
    const text = `Check out my ${formatName} team: ${pokemonNames}`;
    const params = new URLSearchParams({ text, url: teamUrl });
    return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/**
 * Generate a Reddit share URL
 */
export function getRedditShareUrl(teamUrl: string, format: string, team: TeamPokemon[]): string {
    const formatName = getFormatDisplayName(format);
    const pokemonNames = team.map((p) => p.pokemon).join(", ");
    const title = `[${formatName}] ${pokemonNames}`;
    const params = new URLSearchParams({ title, url: teamUrl });
    return `https://reddit.com/submit?${params.toString()}`;
}

/**
 * Format a team for Discord (Markdown-style message)
 */
export function formatDiscordMessage(team: TeamPokemon[], format: string, teamUrl: string): string {
    const formatName = getFormatDisplayName(format);
    const lines = [`**${formatName} Team**`, ""];

    for (const member of team) {
        let line = `> **${member.pokemon}**`;
        if (member.item) line += ` @ ${member.item}`;
        if (member.ability) line += ` (${member.ability})`;
        lines.push(line);

        if (member.moves.length > 0) {
            lines.push(`> ${member.moves.join(" / ")}`);
        }
    }

    lines.push("", teamUrl);
    return lines.join("\n");
}

/**
 * Trigger a JSON file download of the team
 */
export function downloadTeamAsJson(team: TeamPokemon[], format: string): void {
    const data = JSON.stringify({ format, team }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `team-${format}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
