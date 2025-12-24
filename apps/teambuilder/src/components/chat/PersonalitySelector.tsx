"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/stores/chat-store";
import { getAllPersonalities, getPersonality } from "@/lib/ai/personalities";

export function PersonalitySelector() {
  const { personality: personalityId, setPersonality } = useChatStore();
  const currentPersonality = getPersonality(personalityId);
  const personalities = getAllPersonalities();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
          <span className="text-base">{currentPersonality.avatar}</span>
          <span className="text-sm font-medium hidden sm:inline">
            {currentPersonality.name}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {personalities.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setPersonality(p.id)}
            className={`flex items-start gap-2 cursor-pointer py-2 ${
              p.id === personalityId ? "bg-accent" : ""
            }`}
          >
            <span className="text-lg mt-0.5">{p.avatar}</span>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.title}</span>
              <div className="flex gap-1 flex-wrap">
                {p.expertiseLabels.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 h-4 font-normal"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
