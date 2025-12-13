"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PokemonSprite } from "@/components/team/PokemonSprite";
import type { PokemonType } from "@/lib/data/pokemon-types";

interface PopularSet {
  pokemon: string;
  moves: { name: string; usage: number }[];
  abilities: { name: string; usage: number }[];
  items: { name: string; usage: number }[];
  spreads: { nature: string; evs: string; usage: number }[];
  teraTypes?: { name: string; usage: number }[];
}

interface ThreatDetailModalProps {
  pokemon: string | null;
  types: PokemonType[];
  usage: number;
  format: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "https://api.pokemcp.com";

function parsePopularSets(response: string): Partial<PopularSet> {
  const result: Partial<PopularSet> = {
    moves: [],
    abilities: [],
    items: [],
    spreads: [],
    teraTypes: [],
  };

  const lines = response.split("\n");
  let currentSection = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("## Moves") || trimmed.startsWith("**Moves")) {
      currentSection = "moves";
    } else if (trimmed.startsWith("## Abilities") || trimmed.startsWith("**Abilities")) {
      currentSection = "abilities";
    } else if (trimmed.startsWith("## Items") || trimmed.startsWith("**Items")) {
      currentSection = "items";
    } else if (trimmed.startsWith("## Spreads") || trimmed.startsWith("**Spreads")) {
      currentSection = "spreads";
    } else if (trimmed.startsWith("## Tera") || trimmed.startsWith("**Tera")) {
      currentSection = "tera";
    } else if (trimmed.startsWith("-") || trimmed.match(/^\d+\./)) {
      // Parse list items like "- Close Combat: 85.2%" or "1. Close Combat - 85.2%"
      const match = trimmed.match(/[-\d.]\s*\*?\*?([^:*]+)\*?\*?[:\s-]+(\d+\.?\d*)%/);
      if (match) {
        const name = match[1].trim();
        const usage = parseFloat(match[2]);

        if (currentSection === "moves" && result.moves) {
          result.moves.push({ name, usage });
        } else if (currentSection === "abilities" && result.abilities) {
          result.abilities.push({ name, usage });
        } else if (currentSection === "items" && result.items) {
          result.items.push({ name, usage });
        } else if (currentSection === "tera" && result.teraTypes) {
          result.teraTypes.push({ name, usage });
        }
      }

      // Parse spreads like "- Adamant 252 Atk / 4 Def / 252 Spe: 45.2%"
      if (currentSection === "spreads") {
        const spreadMatch = trimmed.match(/[-\d.]\s*(\w+)\s+([^:]+):\s*(\d+\.?\d*)%/);
        if (spreadMatch && result.spreads) {
          result.spreads.push({
            nature: spreadMatch[1],
            evs: spreadMatch[2].trim(),
            usage: parseFloat(spreadMatch[3]),
          });
        }
      }
    }
  }

  return result;
}

function UsageBar({ usage, label }: { usage: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      <span className="w-12 text-right text-muted-foreground text-xs">
        {usage.toFixed(1)}%
      </span>
    </div>
  );
}

export function ThreatDetailModal({
  pokemon,
  types,
  usage,
  format,
  open,
  onOpenChange,
}: ThreatDetailModalProps) {
  const [setData, setSetData] = useState<Partial<PopularSet> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pokemon || !open) {
      setSetData(null);
      return;
    }

    async function fetchSets() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${MCP_URL}/api/tools`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tool: "get_popular_sets",
            args: { pokemon, format },
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch sets");
        }

        const data = await response.json();
        const parsed = parsePopularSets(data.result || "");
        setSetData(parsed);
      } catch (e) {
        console.error("Failed to fetch popular sets:", e);
        setError("Could not load set data");
      } finally {
        setLoading(false);
      }
    }

    fetchSets();
  }, [pokemon, format, open]);

  if (!pokemon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <PokemonSprite pokemon={pokemon} size="lg" />
            <div>
              <div className="text-xl">{pokemon}</div>
              <div className="flex gap-1 mt-1">
                {types.map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Usage */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">
              Usage in {format.toUpperCase()}
            </div>
            <div className="text-2xl font-bold">{usage.toFixed(1)}%</div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {error && (
            <div className="text-sm text-muted-foreground text-center py-4">
              {error}
            </div>
          )}

          {setData && !loading && (
            <>
              {/* Top Moves */}
              {setData.moves && setData.moves.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Top Moves</h4>
                  <div className="space-y-1">
                    {setData.moves.slice(0, 6).map((move) => (
                      <UsageBar key={move.name} label={move.name} usage={move.usage} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Abilities */}
              {setData.abilities && setData.abilities.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Abilities</h4>
                  <div className="space-y-1">
                    {setData.abilities.slice(0, 3).map((ability) => (
                      <UsageBar key={ability.name} label={ability.name} usage={ability.usage} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Items */}
              {setData.items && setData.items.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Items</h4>
                  <div className="space-y-1">
                    {setData.items.slice(0, 4).map((item) => (
                      <UsageBar key={item.name} label={item.name} usage={item.usage} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top Spreads */}
              {setData.spreads && setData.spreads.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Common Spreads</h4>
                  <div className="space-y-2">
                    {setData.spreads.slice(0, 3).map((spread, i) => (
                      <div key={i} className="text-sm p-2 bg-muted/50 rounded">
                        <div className="flex justify-between">
                          <span className="font-medium">{spread.nature}</span>
                          <span className="text-muted-foreground">{spread.usage.toFixed(1)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{spread.evs}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tera Types */}
              {setData.teraTypes && setData.teraTypes.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Tera Types</h4>
                  <div className="space-y-1">
                    {setData.teraTypes.slice(0, 4).map((tera) => (
                      <UsageBar key={tera.name} label={tera.name} usage={tera.usage} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
