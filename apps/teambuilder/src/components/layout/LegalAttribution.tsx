import { cn } from "@/lib/utils";

interface LegalAttributionProps {
    className?: string;
}

export function LegalAttribution({ className }: LegalAttributionProps) {
    return (
        <div className={cn("text-[11px] leading-relaxed text-muted-foreground", className)}>
            <p>
                Pokémon and all related names, characters, and imagery are trademarks of Nintendo,
                Game Freak, and The Pokémon Company. PokeMCP is an unaffiliated fan project and is
                not endorsed by or associated with any of these rightsholders.
            </p>
            <p className="mt-1">
                Competitive usage statistics and set data are sourced from{" "}
                <a
                    href="https://www.smogon.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline hover:text-foreground"
                >
                    Smogon University
                </a>{" "}
                and{" "}
                <a
                    href="https://pokemonshowdown.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:underline hover:text-foreground"
                >
                    Pokémon Showdown
                </a>
                .
            </p>
        </div>
    );
}
