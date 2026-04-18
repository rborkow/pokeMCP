"use client";

import { ChevronsUpDown } from "lucide-react";
import * as React from "react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { POKEMON_LIST } from "@/lib/data/pokemon-list";
import { useLegalPokemon } from "@/lib/mcp-client";
import { cn } from "@/lib/utils";
import { PokemonSprite } from "./PokemonSprite";

interface PokemonComboboxProps {
    value: string;
    onChange: (name: string) => void;
    format: string;
    id?: string;
    placeholder?: string;
}

export function PokemonCombobox({
    value,
    onChange,
    format,
    id,
    placeholder,
}: PokemonComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState(value);

    // Keep internal query in sync when the parent resets the value.
    React.useEffect(() => {
        setQuery(value);
    }, [value]);

    // Substring filter — overrides cmdk's default fuzzy scorer.
    const substringFilter = React.useCallback(
        (itemValue: string, search: string) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0,
        [],
    );

    const { data: legalSet } = useLegalPokemon(format);

    const { legal, other } = React.useMemo(() => {
        if (!legalSet || legalSet.size === 0) {
            return { legal: null, other: null };
        }
        const legalRows: (typeof POKEMON_LIST)[number][] = [];
        const otherRows: (typeof POKEMON_LIST)[number][] = [];
        for (const p of POKEMON_LIST) {
            if (legalSet.has(p.id)) legalRows.push(p);
            else otherRows.push(p);
        }
        return { legal: legalRows, other: otherRows };
    }, [legalSet]);

    const handleSelect = (displayName: string) => {
        onChange(displayName);
        setQuery(displayName);
        setOpen(false);
    };

    const handleInputChange = (next: string) => {
        setQuery(next);
        onChange(next);
        if (!open) setOpen(true);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div className="relative">
                    <input
                        id={id}
                        role="combobox"
                        aria-expanded={open}
                        value={query}
                        placeholder={placeholder}
                        onFocus={() => setOpen(true)}
                        onChange={(e) => handleInputChange(e.target.value)}
                        className={cn(
                            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                    />
                    <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command filter={substringFilter}>
                    <CommandInput
                        value={query}
                        onValueChange={handleInputChange}
                        placeholder="Search Pokémon…"
                    />
                    <CommandList>
                        <CommandEmpty>No Pokémon match "{query}"</CommandEmpty>
                        {legal === null || other === null ? (
                            <CommandGroup heading="All Pokémon">
                                {POKEMON_LIST.map((p) => (
                                    <CommandItem
                                        key={p.id}
                                        value={p.displayName}
                                        onSelect={() => handleSelect(p.displayName)}
                                    >
                                        <PokemonSprite
                                            pokemon={p.displayName}
                                            size="sm"
                                            className="shrink-0"
                                        />
                                        <span>{p.displayName}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : (
                            <>
                                <CommandGroup heading={`Legal in ${format}`}>
                                    {legal.map((p) => (
                                        <CommandItem
                                            key={p.id}
                                            value={p.displayName}
                                            onSelect={() => handleSelect(p.displayName)}
                                        >
                                            <PokemonSprite
                                                pokemon={p.displayName}
                                                size="sm"
                                                className="shrink-0"
                                            />
                                            <span>{p.displayName}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                                <CommandGroup heading="Other">
                                    {other.map((p) => (
                                        <CommandItem
                                            key={p.id}
                                            value={p.displayName}
                                            onSelect={() => handleSelect(p.displayName)}
                                            className="opacity-60"
                                        >
                                            <PokemonSprite
                                                pokemon={p.displayName}
                                                size="sm"
                                                className="shrink-0"
                                            />
                                            <span>{p.displayName}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
