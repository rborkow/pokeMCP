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
  calculateOffensiveScore,
  type PokemonType,
} from "@/lib/data/pokemon-types";
import { toDisplayName } from "@/lib/showdown-parser";
import { ThreatDetailModal } from "./ThreatDetailModal";
import { getFormatDisplayName } from "@/types/pokemon";

interface MetaThreat {
  pokemon: string;
  usage: number;
  types: PokemonType[];
}

interface MatchupCell {
  defScore: number | null; // Defensive: -2 to +2, null if unknown types
  offScore: number | null; // Offensive: -2 to +2, null if unknown types
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
 * Get color class for combined matchup score (average of def + off)
 */
function getCombinedColor(defScore: number | null, offScore: number | null): string {
  if (defScore === null || offScore === null) return "bg-gray-400/50";
  const combined = (defScore + offScore) / 2;
  if (combined >= 1.5) return "bg-green-600";
  if (combined >= 0.5) return "bg-green-400";
  if (combined >= -0.5) return "bg-gray-500";
  if (combined >= -1.5) return "bg-red-400";
  return "bg-red-600";
}

/**
 * Get score label (short form)
 */
function getScoreLabel(score: number | null): string {
  if (score === null) return "?";
  switch (score) {
    case 2: return "++";
    case 1: return "+";
    case 0: return "0";
    case -1: return "-";
    case -2: return "--";
    default: return "?";
  }
}

/**
 * Get defensive score description
 */
function getDefensiveDescription(score: number | null): string {
  if (score === null) return "Unknown";
  switch (score) {
    case 2: return "immune/double resists";
    case 1: return "resists";
    case 0: return "neutral damage";
    case -1: return "weak to";
    case -2: return "4x weak to";
    default: return "unknown";
  }
}

/**
 * Get offensive score description
 */
function getOffensiveDescription(score: number | null): string {
  if (score === null) return "Unknown";
  switch (score) {
    case 2: return "4x super effective";
    case 1: return "super effective";
    case 0: return "neutral damage";
    case -1: return "resisted";
    case -2: return "immune/double resisted";
    default: return "unknown";
  }
}

/**
 * Get overall matchup assessment
 */
function getOverallAssessment(defScore: number | null, offScore: number | null): string {
  if (defScore === null || offScore === null) return "Unknown matchup";
  const combined = defScore + offScore;
  if (combined >= 3) return "Excellent matchup";
  if (combined >= 1) return "Favorable matchup";
  if (combined >= -1) return "Even matchup";
  if (combined >= -3) return "Unfavorable matchup";
  return "Bad matchup";
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
  const defLabel = getScoreLabel(matchup.defScore);
  const offLabel = getScoreLabel(matchup.offScore);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-10 h-10 flex flex-col items-center justify-center text-[10px] font-bold cursor-help rounded ${getCombinedColor(matchup.defScore, matchup.offScore)} text-white`}
        >
          <span className="leading-tight">D{defLabel}</span>
          <span className="leading-tight opacity-80">O{offLabel}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-2">
          <p className="font-semibold border-b pb-1">
            {toDisplayName(teamPokemon)} vs {toDisplayName(threat.pokemon)}
          </p>
          <div className="text-xs space-y-1">
            <p>
              <span className="font-medium">DEF:</span> Takes {getDefensiveDescription(matchup.defScore)} {matchup.attackerTypes.join("/")}
            </p>
            <p>
              <span className="font-medium">OFF:</span> Deals {getOffensiveDescription(matchup.offScore)} to {matchup.attackerTypes.join("/")}
            </p>
          </div>
          <p className="text-xs font-medium text-primary pt-1 border-t">
            {getOverallAssessment(matchup.defScore, matchup.offScore)}
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
  // Calculate average combined score (def + off) for each team member
  const teamMemberAverages = matchups.map((row) => {
    const validCells = row.filter((cell) => cell.defScore !== null && cell.offScore !== null);
    if (validCells.length === 0) return null;
    const sum = validCells.reduce((acc, cell) => acc + ((cell.defScore ?? 0) + (cell.offScore ?? 0)) / 2, 0);
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
              className={`w-10 h-10 flex items-center justify-center text-xs font-bold rounded text-white ${avg !== null ? getCombinedColor(avg, avg) : "bg-gray-400/50 text-gray-400"}`}
            >
              {avg !== null ? avg.toFixed(1) : "?"}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{toDisplayName(team[i].pokemon)} {avg !== null ? "average matchup vs all threats" : "(unknown types)"}</p>
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

  // Calculate matchups (both defensive and offensive)
  const matchups = useMemo(() => {
    if (team.length === 0 || metaThreats.length === 0) return [];

    return team.map((pokemon) => {
      const defenderTypes = getPokemonTypes(pokemon.pokemon);
      const hasKnownTypes = defenderTypes.length > 0;
      return metaThreats.map((threat) => ({
        defScore: hasKnownTypes ? calculateMatchupScore(defenderTypes, threat.types) : null,
        offScore: hasKnownTypes ? calculateOffensiveScore(defenderTypes, threat.types) : null,
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
            Could not load meta threats for {getFormatDisplayName(format)}.
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
          Your team vs top {getFormatDisplayName(format)} threats (D=Defense, O=Offense)
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
        <div className="mt-4 space-y-2 text-xs">
          <div className="flex flex-wrap gap-3">
            <span className="text-muted-foreground">Colors:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-600" />
              <span>Excellent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-400" />
              <span>Favorable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gray-500" />
              <span>Even</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-400" />
              <span>Unfavorable</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-600" />
              <span>Bad</span>
            </div>
          </div>
          <div className="text-muted-foreground">
            <span className="font-medium">D</span>=Defense (damage taken) • <span className="font-medium">O</span>=Offense (damage dealt) • <span className="font-medium">++</span>=4x/<span className="font-medium">+</span>=2x/<span className="font-medium">0</span>=1x/<span className="font-medium">-</span>=0.5x/<span className="font-medium">--</span>=immune
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
