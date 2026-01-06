"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTeamStore } from "@/stores/team-store";
import { PokemonSprite } from "@/components/team/PokemonSprite";
import { toDisplayName } from "@/lib/showdown-parser";
import {
  analyzeTeamSpeed,
  hasTeamSpeedControl,
  getSpeedTier,
  getSpeedTierColor,
  getSpeedTierBgColor,
  SPEED_BENCHMARKS,
  type TeamSpeedInfo,
} from "@/lib/speed-calc";

function SpeedRow({ info }: { info: TeamSpeedInfo }) {
  const speedDisplay = info.speed !== null ? info.speed : "?";
  const tier = info.tier;
  const tierColor = tier ? getSpeedTierColor(tier) : "text-muted-foreground";
  const tierBg = tier ? getSpeedTierBgColor(tier) : "bg-muted";

  // Find relevant benchmarks
  const benchmarksOutsped = info.speed
    ? SPEED_BENCHMARKS.filter((b) => info.speed! > b.speed).slice(-2)
    : [];
  const benchmarksOutspedBy = info.speed
    ? SPEED_BENCHMARKS.filter((b) => info.speed! < b.speed).slice(0, 2)
    : [];

  return (
    <div className={`flex items-center gap-3 p-2 rounded ${tierBg}`}>
      <div className="flex items-center gap-2 w-36">
        <PokemonSprite pokemon={info.pokemon} size="sm" />
        <span className="text-sm font-medium truncate">
          {toDisplayName(info.pokemon)}
        </span>
      </div>

      {/* Speed stat */}
      <div className={`w-12 text-center font-mono font-bold ${tierColor}`}>
        {speedDisplay}
      </div>

      {/* Modifier badges */}
      <div className="flex gap-1">
        {info.hasScarf && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                Scarf
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>With Choice Scarf: {info.modifiers?.scarf}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {info.hasTailwindAccess && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-400 rounded">
                TW
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Under Tailwind: {info.modifiers?.tailwind}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Speed relationships */}
      {info.speed !== null && (
        <div className="flex-1 text-xs text-muted-foreground">
          {benchmarksOutsped.length > 0 && (
            <span className="text-green-500">
              Outspeeds {benchmarksOutsped.map((b) => b.pokemon).join(", ")}
            </span>
          )}
          {benchmarksOutspedBy.length > 0 && benchmarksOutsped.length > 0 && (
            <span className="mx-1">|</span>
          )}
          {benchmarksOutspedBy.length > 0 && (
            <span className="text-red-400">
              Outsped by {benchmarksOutspedBy.map((b) => b.pokemon).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function SpeedControlBadges({
  control,
}: {
  control: ReturnType<typeof hasTeamSpeedControl>;
}) {
  const badges = [];

  if (control.hasTailwind) {
    badges.push(
      <span
        key="tw"
        className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded"
      >
        Tailwind
      </span>
    );
  }
  if (control.hasTrickRoom) {
    badges.push(
      <span
        key="tr"
        className="px-2 py-1 text-xs bg-pink-500/20 text-pink-400 rounded"
      >
        Trick Room
      </span>
    );
  }
  if (control.hasIcyWind) {
    badges.push(
      <span
        key="iw"
        className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded"
      >
        Icy Wind
      </span>
    );
  }
  if (control.hasElectroweb) {
    badges.push(
      <span
        key="ew"
        className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded"
      >
        Electroweb
      </span>
    );
  }
  if (control.hasThunderWave) {
    badges.push(
      <span
        key="twave"
        className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded"
      >
        Thunder Wave
      </span>
    );
  }

  if (badges.length === 0) {
    return (
      <span className="text-xs text-amber-500">No speed control detected</span>
    );
  }

  return <div className="flex flex-wrap gap-1">{badges}</div>;
}

export function SpeedTiers() {
  const { team, mode } = useTeamStore();

  const speedInfo = useMemo(() => {
    if (team.length === 0) return [];
    return analyzeTeamSpeed(team).sort((a, b) => {
      // Sort by speed descending, unknowns at bottom
      if (a.speed === null) return 1;
      if (b.speed === null) return -1;
      return b.speed - a.speed;
    });
  }, [team]);

  const speedControl = useMemo(() => {
    return hasTeamSpeedControl(team);
  }, [team]);

  if (team.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Speed Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Add Pokemon to see speed analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  const unknownCount = speedInfo.filter((s) => s.speed === null).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Speed Tiers</CardTitle>
        <p className="text-xs text-muted-foreground">
          Calculated stats at Level 50 (VGC standard)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Speed control summary */}
        <div className="pb-3 border-b">
          <p className="text-xs text-muted-foreground mb-2">Speed Control:</p>
          <SpeedControlBadges control={speedControl} />
        </div>

        {/* Team speed list */}
        <div className="space-y-2">
          {speedInfo.map((info, i) => (
            <SpeedRow key={i} info={info} />
          ))}
        </div>

        {unknownCount > 0 && (
          <p className="text-xs text-amber-500">
            Note: {unknownCount} Pokemon missing base stat data
          </p>
        )}

        {/* Legend */}
        <div className="pt-3 border-t space-y-2">
          <p className="text-xs text-muted-foreground font-medium">
            Speed Tiers (at Level 50):
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-emerald-500">150+ Very Fast</span>
            <span className="text-green-500">120-149 Fast</span>
            <span className="text-yellow-500">80-119 Medium</span>
            <span className="text-orange-500">50-79 Slow</span>
            <span className="text-red-500">&lt;50 Very Slow</span>
          </div>

          {mode === "vgc" && (
            <div className="text-xs text-muted-foreground mt-2">
              <p className="font-medium mb-1">VGC Speed Tips:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Under Tailwind, speed is doubled</li>
                <li>
                  Trick Room reverses speed order (slower moves first)
                </li>
                <li>Choice Scarf boosts speed by 50%</li>
                <li>Icy Wind/Electroweb drops target speed by 1 stage (~33%)</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
