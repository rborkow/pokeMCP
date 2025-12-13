"use client";

import { Button } from "@/components/ui/button";
import { SUGGESTED_PROMPTS } from "@/types/chat";
import { useTeamStore } from "@/stores/team-store";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SuggestedPrompts({ onSelect, disabled }: SuggestedPromptsProps) {
  const { team } = useTeamStore();

  // Filter prompts based on team state
  const availablePrompts = SUGGESTED_PROMPTS.filter((p) => {
    // "Rate my team" and "Optimize sets" only make sense with a team
    if (
      (p.label === "Rate my team" || p.label === "Optimize sets") &&
      team.length === 0
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 border-b">
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
