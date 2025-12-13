"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTeamStore } from "@/stores/team-store";
import { TYPES, type PokemonType } from "@/types/pokemon";

// Type colors for badges
const TYPE_COLORS: Record<PokemonType, string> = {
  Normal: "bg-gray-400",
  Fire: "bg-orange-500",
  Water: "bg-blue-500",
  Electric: "bg-yellow-400",
  Grass: "bg-green-500",
  Ice: "bg-cyan-300",
  Fighting: "bg-red-700",
  Poison: "bg-purple-500",
  Ground: "bg-amber-600",
  Flying: "bg-indigo-300",
  Psychic: "bg-pink-500",
  Bug: "bg-lime-500",
  Rock: "bg-stone-500",
  Ghost: "bg-purple-700",
  Dragon: "bg-violet-600",
  Dark: "bg-stone-700",
  Steel: "bg-slate-400",
  Fairy: "bg-pink-300",
};

// Simplified type effectiveness (1 = weak, 2 = 2x weak, 0 = resist, -1 = immune)
const TYPE_CHART: Record<string, Record<string, number>> = {
  Normal: { Fighting: 1, Ghost: -1 },
  Fire: { Water: 1, Ground: 1, Rock: 1, Fire: 0, Grass: 0, Ice: 0, Bug: 0, Steel: 0, Fairy: 0 },
  Water: { Electric: 1, Grass: 1, Fire: 0, Water: 0, Ice: 0, Steel: 0 },
  Electric: { Ground: 1, Electric: 0, Flying: 0, Steel: 0 },
  Grass: { Fire: 1, Ice: 1, Poison: 1, Flying: 1, Bug: 1, Water: 0, Electric: 0, Grass: 0, Ground: 0 },
  Ice: { Fire: 1, Fighting: 1, Rock: 1, Steel: 1, Ice: 0 },
  Fighting: { Flying: 1, Psychic: 1, Fairy: 1, Bug: 0, Rock: 0, Dark: 0 },
  Poison: { Ground: 1, Psychic: 1, Grass: 0, Fighting: 0, Poison: 0, Bug: 0, Fairy: 0 },
  Ground: { Water: 1, Grass: 1, Ice: 1, Electric: -1, Poison: 0, Rock: 0 },
  Flying: { Electric: 1, Ice: 1, Rock: 1, Ground: -1, Grass: 0, Fighting: 0, Bug: 0 },
  Psychic: { Bug: 1, Ghost: 1, Dark: 1, Fighting: 0, Psychic: 0 },
  Bug: { Fire: 1, Flying: 1, Rock: 1, Grass: 0, Fighting: 0, Ground: 0 },
  Rock: { Water: 1, Grass: 1, Fighting: 1, Ground: 1, Steel: 1, Normal: 0, Fire: 0, Poison: 0, Flying: 0 },
  Ghost: { Ghost: 1, Dark: 1, Normal: -1, Fighting: -1, Poison: 0, Bug: 0 },
  Dragon: { Ice: 1, Dragon: 1, Fairy: 1, Fire: 0, Water: 0, Electric: 0, Grass: 0 },
  Dark: { Fighting: 1, Bug: 1, Fairy: 1, Psychic: -1, Ghost: 0, Dark: 0 },
  Steel: { Fire: 1, Fighting: 1, Ground: 1, Poison: -1, Normal: 0, Grass: 0, Ice: 0, Flying: 0, Psychic: 0, Bug: 0, Rock: 0, Dragon: 0, Steel: 0, Fairy: 0 },
  Fairy: { Poison: 1, Steel: 1, Dragon: -1, Fighting: 0, Bug: 0, Dark: 0 },
};

interface TypeAnalysis {
  weaknesses: { type: PokemonType; count: number }[];
  resistances: { type: PokemonType; count: number }[];
  immunities: { type: PokemonType; count: number }[];
}

function analyzeTeamCoverage(teamTypes: string[][]): TypeAnalysis {
  const weaknessCount: Record<string, number> = {};
  const resistCount: Record<string, number> = {};
  const immuneCount: Record<string, number> = {};

  // For each Pokemon's types
  for (const types of teamTypes) {
    // Check each attacking type
    for (const attackType of TYPES) {
      let effectiveness = 1;

      for (const defType of types) {
        const chart = TYPE_CHART[defType];
        if (chart && chart[attackType] !== undefined) {
          if (chart[attackType] === -1) {
            effectiveness = 0; // Immune
            break;
          } else if (chart[attackType] === 1 || chart[attackType] === 2) {
            effectiveness *= 2;
          } else if (chart[attackType] === 0) {
            effectiveness *= 0.5;
          }
        }
      }

      if (effectiveness === 0) {
        immuneCount[attackType] = (immuneCount[attackType] || 0) + 1;
      } else if (effectiveness >= 2) {
        weaknessCount[attackType] = (weaknessCount[attackType] || 0) + 1;
      } else if (effectiveness <= 0.5) {
        resistCount[attackType] = (resistCount[attackType] || 0) + 1;
      }
    }
  }

  return {
    weaknesses: Object.entries(weaknessCount)
      .map(([type, count]) => ({ type: type as PokemonType, count }))
      .sort((a, b) => b.count - a.count),
    resistances: Object.entries(resistCount)
      .map(([type, count]) => ({ type: type as PokemonType, count }))
      .sort((a, b) => b.count - a.count),
    immunities: Object.entries(immuneCount)
      .map(([type, count]) => ({ type: type as PokemonType, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Mock function to get Pokemon types - in real implementation, this would use the MCP lookup
function getPokemonTypes(pokemon: string): string[] {
  // Common Pokemon types for demo
  const typeMap: Record<string, string[]> = {
    garchomp: ["Dragon", "Ground"],
    "landorus-therian": ["Ground", "Flying"],
    landorustherian: ["Ground", "Flying"],
    kingambit: ["Dark", "Steel"],
    gholdengo: ["Steel", "Ghost"],
    dragonite: ["Dragon", "Flying"],
    tyranitar: ["Rock", "Dark"],
    ferrothorn: ["Grass", "Steel"],
    toxapex: ["Poison", "Water"],
    corviknight: ["Flying", "Steel"],
    heatran: ["Fire", "Steel"],
    rotom: ["Electric", "Ghost"],
    "rotom-wash": ["Electric", "Water"],
    clefable: ["Fairy"],
    dragapult: ["Dragon", "Ghost"],
    rillaboom: ["Grass"],
    cinderace: ["Fire"],
    urshifu: ["Fighting", "Dark"],
    "urshifu-rapid-strike": ["Fighting", "Water"],
  };

  const key = pokemon.toLowerCase().replace(/[^a-z]/g, "");
  return typeMap[key] || ["Normal"];
}

export function TypeCoverage() {
  const { team } = useTeamStore();

  const analysis = useMemo(() => {
    if (team.length === 0) return null;

    const teamTypes = team.map((p) => getPokemonTypes(p.pokemon));
    return analyzeTeamCoverage(teamTypes);
  }, [team]);

  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Type Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add Pokemon to see type coverage analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Type Coverage Analysis</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weaknesses */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-destructive">
            Team Weaknesses
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis?.weaknesses.length === 0 ? (
              <span className="text-sm text-muted-foreground">No shared weaknesses!</span>
            ) : (
              analysis?.weaknesses.map(({ type, count }) => (
                <Badge
                  key={type}
                  className={`${TYPE_COLORS[type]} text-white`}
                >
                  {type} ({count})
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Resistances */}
        <div>
          <h4 className="text-sm font-medium mb-2 text-green-500">
            Team Resistances
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis?.resistances.length === 0 ? (
              <span className="text-sm text-muted-foreground">No resistances</span>
            ) : (
              analysis?.resistances.slice(0, 8).map(({ type, count }) => (
                <Badge
                  key={type}
                  variant="outline"
                  className={`border-2`}
                  style={{ borderColor: TYPE_COLORS[type].replace("bg-", "") }}
                >
                  {type} ({count})
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Immunities */}
        {analysis?.immunities && analysis.immunities.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 text-blue-500">
              Team Immunities
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.immunities.map(({ type, count }) => (
                <Badge key={type} variant="secondary">
                  {type} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
