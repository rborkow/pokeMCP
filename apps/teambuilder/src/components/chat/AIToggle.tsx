"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatStore } from "@/stores/chat-store";
import type { AIProvider } from "@/types/chat";

export function AIToggle() {
  const { aiProvider, setAIProvider } = useChatStore();

  const toggleProvider = () => {
    const newProvider: AIProvider = aiProvider === "cloudflare" ? "claude" : "cloudflare";
    setAIProvider(newProvider);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleProvider}
          className="gap-2 text-xs"
        >
          {aiProvider === "cloudflare" ? (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              CF AI
            </>
          ) : (
            <>
              <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
              Claude
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {aiProvider === "cloudflare"
            ? "Using Cloudflare AI (free)"
            : "Using Claude API (premium)"}
        </p>
        <p className="text-xs text-muted-foreground">Click to switch</p>
      </TooltipContent>
    </Tooltip>
  );
}
