"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FORMATS, FORMAT_CATEGORIES, type FormatId, getFormatDisplayName } from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";
import { Swords, Users, ChevronDown } from "lucide-react";

// Primary format options for new users
const PRIMARY_FORMATS = [
  {
    id: "gen9ou" as FormatId,
    label: "Singles",
    description: "1v1 battles",
    icon: Swords,
  },
  {
    id: "gen9vgc2024regh" as FormatId,
    label: "Doubles",
    description: "2v2 VGC",
    icon: Users,
  },
];

export function FormatSelector() {
  const { format, setFormat } = useTeamStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Group formats by category for advanced dropdown
  const groupedFormats = FORMAT_CATEGORIES.map((category) => ({
    ...category,
    formats: FORMATS.filter((f) => f.category === category.id),
  }));

  // Check if current format is one of the primary options
  const isPrimaryFormat = PRIMARY_FORMATS.some((p) => p.id === format);

  return (
    <div className="flex flex-col gap-2">
      {/* Primary format buttons */}
      <div className="flex gap-2">
        {PRIMARY_FORMATS.map((primaryFormat) => {
          const Icon = primaryFormat.icon;
          const isSelected = format === primaryFormat.id;
          const formatName = getFormatDisplayName(primaryFormat.id);

          return (
            <button
              key={primaryFormat.id}
              onClick={() => setFormat(primaryFormat.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">{primaryFormat.label}</div>
                <div className="text-xs text-muted-foreground">
                  {isSelected ? formatName : primaryFormat.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Advanced format dropdown */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown
              className={`h-3 w-3 mr-1 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
            />
            {isPrimaryFormat ? "More formats" : getFormatDisplayName(format)}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Select value={format} onValueChange={(value) => setFormat(value as FormatId)}>
            <SelectTrigger className="w-full bg-card">
              <SelectValue placeholder="Select format">
                {getFormatDisplayName(format)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {groupedFormats.map((group) => (
                <SelectGroup key={group.id}>
                  <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                    {group.label}
                  </SelectLabel>
                  {group.formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
