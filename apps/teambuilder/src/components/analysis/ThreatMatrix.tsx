"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTeamStore } from "@/stores/team-store";
import { useMetaThreats } from "@/lib/mcp-client";
import { PokemonSprite } from "@/components/team/PokemonSprite";
import {
  getPokemonTypes,
  calculateMatchupScore,
  type PokemonType,
} from "@/lib/data/pokemon-types";
import { toDisplayName } from "@/lib/showdown-parser";
import { ThreatDetailModal } from "./ThreatDetailModal";

interface MetaThreat {
  pokemon: string;
  usage: number;
  types: PokemonType[];
}

interface MatchupCell {
  score: number | null; // -2 to +2, null if unknown types
  defenderTypes: PokemonType[];
  attackerTypes: PokemonType[];
  unknownTypes?: boolean;
}

/**
 * Parse meta threats from MCP response
 */
function parseMetaThreats(response: string): MetaThreat[] {
  const threats: MetaThreat[] = [];
  const lines = response.split("\n");

  for (const line of lines) {
    // Match patterns like "1. **Great Tusk** - 30.55% usage"
    const match = line.match(/\d+\.\s+\*?\*?([^*]+)\*?\*?\s*-\s*([\d.]+)%/);
    if (match) {
      const pokemon = match[1].trim();
      const usage = parseFloat(match[2]);
      const types = getPokemonTypes(pokemon);
      // Only include Pokemon with known types
      if (types.length > 0) {
        threats.push({ pokemon, usage, types });
      } else {
        console.warn(`Skipping threat with unknown types: ${pokemon}`);
      }
    }
  }

  return threats;
}

/**
 * Get color class for matchup score
 */
function getScoreColor(score: number | null): string {
  if (score === null) return "bg-gray-400/50 text-gray-400";
  switch (score) {
    case 2:
      return "bg-green-600 text-white";
    case 1:
      return "bg-green-400 text-white";
    case 0:
      return "bg-gray-500 text-white";
    case -1:
      return "bg-red-400 text-white";
    case -2:
      return "bg-red-600 text-white";
    default:
      return "bg-gray-400 text-white";
  }
}

/**
 * Get score label
 */
function getScoreLabel(score: number | null): string {
  if (score === null) return "?";
  switch (score) {
    case 2:
      return "++";
    case 1:
      return "+";
    case 0:
      return "0";
    case -1:
      return "-";
    case -2:
      return "--";
    default:
      return "?";
  }
}

/**
 * Get score description
 */
function getScoreDescription(score: number | null): string {
  if (score === null) return "Unknown types - cannot calculate matchup";
  switch (score) {
    case 2:
      return "Very favorable (immune or double resist)";
    case 1:
      return "Favorable (resists STAB)";
    case 0:
      return "Neutral";
    case -1:
      return "Unfavorable (weak to STAB)";
    case -2:
      return "Very unfavorable (4x weak)";
    default:
      return "Unknown";
  }
}

function ThreatMatrixCell({
  matchup,
  teamPokemon,
  threat,
}: {
  matchup: MatchupCell;
  teamPokemon: string;
  threat: MetaThreat;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-10 h-10 flex items-center justify-center text-sm font-bold cursor-help rounded ${getScoreColor(matchup.score)}`}
        >
          {getScoreLabel(matchup.score)}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">
            {toDisplayName(teamPokemon)} vs {toDisplayName(threat.pokemon)}
          </p>
          <p className="text-xs">
            Your types: {matchup.defenderTypes.length > 0 ? matchup.defenderTypes.join("/") : "Unknown"}
          </p>
          <p className="text-xs">
            Threat types: {matchup.attackerTypes.join("/")}
          </p>
          <p className="text-xs text-muted-foreground">
            {getScoreDescription(matchup.score)}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TeamSummaryColumn({
  matchups,
  team,
}: {
  matchups: MatchupCell[][];
  team: { pokemon: string }[];
}) {
  // Calculate average score for each team member across all threats
  // Exclude cells with null scores (unknown types)
  const teamMemberAverages = matchups.map((row) => {
    const validCells = row.filter((cell) => cell.score !== null);
    if (validCells.length === 0) return null;
    const sum = validCells.reduce((acc, cell) => acc + (cell.score ?? 0), 0);
    return sum / validCells.length;
  });

  return (
    <div className="flex flex-col gap-1">
      <div className="h-10 flex items-center justify-center text-xs font-medium text-muted-foreground">
        Avg
      </div>
      {teamMemberAverages.map((avg, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <div
              className={`w-10 h-10 flex items-center justify-center text-xs font-bold rounded ${avg !== null ? getScoreColor(Math.round(avg)) : "bg-gray-400/50 text-gray-400"}`}
            >
              {avg !== null ? avg.toFixed(1) : "?"}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{toDisplayName(team[i].pokemon)} {avg !== null ? "average vs all threats" : "(unknown types)"}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function ThreatMatrix() {
  const { team, format } = useTeamStore();
  // Ensure format is lowercase for API calls
  const normalizedFormat = format.toLowerCase();
  const { data: metaThreatsData, isLoading, error } = useMetaThreats(normalizedFormat, 10);
  const [selectedThreat, setSelectedThreat] = useState<MetaThreat | null>(null);

  // Parse meta threats
  const metaThreats = useMemo(() => {
    if (!metaThreatsData || typeof metaThreatsData !== "string") {
      console.log("[ThreatMatrix] No meta threats data for format:", normalizedFormat, "data:", metaThreatsData);
      return [];
    }
    const parsed = parseMetaThreats(metaThreatsData);
    console.log("[ThreatMatrix] Parsed", parsed.length, "threats for format:", normalizedFormat);
    return parsed;
  }, [metaThreatsData, normalizedFormat]);

  // Calculate matchups
  const matchups = useMemo(() => {
    if (team.length === 0 || metaThreats.length === 0) return [];

    return team.map((pokemon) => {
      const defenderTypes = getPokemonTypes(pokemon.pokemon);
      const hasKnownTypes = defenderTypes.length > 0;
      return metaThreats.map((threat) => ({
        score: hasKnownTypes ? calculateMatchupScore(defenderTypes, threat.types) : null,
        defenderTypes,
        attackerTypes: threat.types,
        unknownTypes: !hasKnownTypes,
      }));
    });
  }, [team, metaThreats]);

  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Threat Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add Pokemon to see matchups vs meta threats
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Threat Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">Loading meta threats...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || metaThreats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Threat Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Could not load meta threats for {format.toUpperCase()}.
            {error && <span className="block text-xs text-destructive mt-1">Error: {String(error)}</span>}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Threat Matrix</CardTitle>
        <p className="text-xs text-muted-foreground">
          Your team vs top {format.toUpperCase()} threats (type-based defensive matchups)
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-flex gap-1">
            {/* Row headers (your team) */}
            <div className="flex flex-col gap-1 pr-2">
              <div className="h-10" /> {/* Spacer for column headers */}
              {team.map((pokemon, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className="w-32 h-10 flex items-center gap-2">
                      <PokemonSprite pokemon={pokemon.pokemon} size="sm" />
                      <span className="text-xs truncate flex-1">
                        {toDisplayName(pokemon.pokemon)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{toDisplayName(pokemon.pokemon)}</p>
                    <p className="text-xs text-muted-foreground">
                      {getPokemonTypes(pokemon.pokemon).join("/") || "Unknown types"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Matrix grid */}
            <div className="flex gap-1">
              {metaThreats.map((threat, threatIndex) => (
                <div key={threatIndex} className="flex flex-col gap-1">
                  {/* Column header (threat) - clickable for details */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="h-10 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 rounded transition-colors"
                        onClick={() => setSelectedThreat(threat)}
                      >
                        <PokemonSprite pokemon={threat.pokemon} size="sm" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{toDisplayName(threat.pokemon)}</p>
                      <p className="text-xs">{threat.types.join("/")}</p>
                      <p className="text-xs text-muted-foreground">
                        {threat.usage.toFixed(1)}% usage
                      </p>
                      <p className="text-xs text-primary mt-1">Click for details</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Matchup cells */}
                  {matchups.map((row, teamIndex) => (
                    <ThreatMatrixCell
                      key={teamIndex}
                      matchup={row[threatIndex]}
                      teamPokemon={team[teamIndex].pokemon}
                      threat={threat}
                    />
                  ))}
                </div>
              ))}

              {/* Summary column */}
              <div className="border-l pl-1 ml-1">
                <TeamSummaryColumn matchups={matchups} team={team} />
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground">Legend:</span>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getScoreColor(2)}`} />
            <span>Very favorable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getScoreColor(1)}`} />
            <span>Favorable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getScoreColor(0)}`} />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getScoreColor(-1)}`} />
            <span>Unfavorable</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${getScoreColor(-2)}`} />
            <span>Very unfavorable</span>
          </div>
        </div>
      </CardContent>

      {/* Threat Detail Modal */}
      <ThreatDetailModal
        pokemon={selectedThreat?.pokemon ?? null}
        types={selectedThreat?.types ?? []}
        usage={selectedThreat?.usage ?? 0}
        format={format}
        open={!!selectedThreat}
        onOpenChange={(open) => !open && setSelectedThreat(null)}
      />
    </Card>
  );
}
