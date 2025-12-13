"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHistoryStore, type HistoryEntry } from "@/stores/history-store";
import { useTeamStore } from "@/stores/team-store";
import { Clock, Undo2, Bot, User, Upload } from "lucide-react";
import { PokemonSprite } from "@/components/team/PokemonSprite";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

const SOURCE_ICONS = {
  user: User,
  ai: Bot,
  import: Upload,
};

interface HistoryEntryCardProps {
  entry: HistoryEntry;
  previousEntry?: HistoryEntry;
  onRestore: () => void;
}

function HistoryEntryCard({ entry, previousEntry, onRestore }: HistoryEntryCardProps) {
  const { calculateDiff } = useHistoryStore();
  const SourceIcon = SOURCE_ICONS[entry.source];

  // Calculate diff from previous entry
  const diff = previousEntry
    ? calculateDiff(previousEntry.team, entry.team)
    : null;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SourceIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{entry.reason}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(new Date(entry.timestamp))}
          </span>
          <Button variant="ghost" size="sm" onClick={onRestore}>
            <Undo2 className="h-3 w-3 mr-1" />
            Restore
          </Button>
        </div>
      </div>

      {/* Show diff if available */}
      {diff && (diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {diff.added.map((p) => (
            <Badge key={p.pokemon} variant="outline" className="text-green-500 border-green-500">
              + {p.pokemon}
            </Badge>
          ))}
          {diff.removed.map((p) => (
            <Badge key={p.pokemon} variant="outline" className="text-red-500 border-red-500">
              - {p.pokemon}
            </Badge>
          ))}
          {diff.modified.map((m) => (
            <Badge key={m.after.pokemon} variant="outline" className="text-yellow-500 border-yellow-500">
              ~ {m.after.pokemon} ({m.changes.join(", ")})
            </Badge>
          ))}
        </div>
      )}

      {/* Show team preview */}
      <div className="flex gap-1">
        {entry.team.slice(0, 6).map((p, i) => (
          <div key={`${p.pokemon}-${i}`} className="w-8 h-8">
            <PokemonSprite pokemon={p.pokemon} size="sm" />
          </div>
        ))}
        {entry.team.length === 0 && (
          <span className="text-xs text-muted-foreground">Empty team</span>
        )}
      </div>
    </div>
  );
}

export function TeamHistory() {
  const { entries, clearHistory } = useHistoryStore();

  const handleRestore = (entry: HistoryEntry) => {
    // Restore the team from this entry
    const teamStore = useTeamStore.getState();
    teamStore.clearTeam();
    entry.team.forEach((pokemon, index) => {
      teamStore.setPokemon(index, pokemon);
    });
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              No history yet. Changes to your team will appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Team History</CardTitle>
        <Button variant="ghost" size="sm" onClick={clearHistory}>
          Clear
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {entries.map((entry, index) => (
            <HistoryEntryCard
              key={entry.id}
              entry={entry}
              previousEntry={entries[index + 1]}
              onRestore={() => handleRestore(entry)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
