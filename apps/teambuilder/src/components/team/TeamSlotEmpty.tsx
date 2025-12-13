"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface TeamSlotEmptyProps {
  slot: number;
  onClick?: () => void;
}

export function TeamSlotEmpty({ slot: _slot, onClick }: TeamSlotEmptyProps) {
  return (
    <Card
      className="cursor-pointer border-dashed hover:border-primary/50 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col items-center justify-center gap-2 h-[152px]">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Plus className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Add Pokemon</p>
      </CardContent>
    </Card>
  );
}
