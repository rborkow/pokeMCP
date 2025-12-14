"use client";

import { Button } from "@/components/ui/button";
import { SUGGESTED_PROMPTS, QUICKSTART_PROMPT } from "@/types/chat";
import { useTeamStore } from "@/stores/team-store";
import { Sparkles } from "lucide-react";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  const { team } = useTeamStore();
  const hasTeam = team.length > 0;

  // Filter prompts based on team state
  const availablePrompts = SUGGESTED_PROMPTS.filter((p) => {
    // Skip prompts that require a team when there's no team
    if (p.requiresTeam && !hasTeam) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-b">
      {/* Show Quickstart button prominently when no team */}
      {!hasTeam && (
        <Button
          variant="default"
          size="sm"
          className="text-xs h-7 bg-primary hover:bg-primary/90"
          onClick={() => onSelect(QUICKSTART_PROMPT.prompt)}
          disabled={disabled}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          {QUICKSTART_PROMPT.label}
        </Button>
      )}
      {availablePrompts.map(({ label, prompt }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => onSelect(prompt)}
          disabled={disabled}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
