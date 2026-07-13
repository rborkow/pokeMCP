import type { TeamPokemon } from "@/types/pokemon";

export function PokemonLineup({ team, compact = false }: { team: TeamPokemon[]; compact?: boolean }) {
    return (
        <ul className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`} aria-label="Team composition">
            {team.map((pokemon) => (
                <li
                    key={pokemon.pokemon}
                    className={`rounded-md border border-border bg-inset text-foreground ${
                        compact ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm"
                    }`}
                >
                    {pokemon.pokemon}
                </li>
            ))}
        </ul>
    );
}
