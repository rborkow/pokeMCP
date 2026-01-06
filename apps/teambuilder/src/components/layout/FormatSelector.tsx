"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { FORMATS, FORMAT_CATEGORIES, type FormatId, getFormatDisplayName } from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";
import { Swords, Users, ChevronDown, Check } from "lucide-react";

// Quick access format options
const QUICK_FORMATS = [
  { id: "gen9ou" as FormatId, label: "Singles", sublabel: "OU", icon: Swords },
  { id: "gen9vgc2024regh" as FormatId, label: "Doubles", sublabel: "VGC", icon: Users },
];

export function FormatSelector() {
  const { format, setFormat } = useTeamStore();

  // Group formats by category
  const groupedFormats = FORMAT_CATEGORIES.map((category) => ({
    ...category,
    formats: FORMATS.filter((f) => f.category === category.id),
  }));

  // Get current format display info
  const currentFormatName = getFormatDisplayName(format);
  const isQuickFormat = QUICK_FORMATS.some((q) => q.id === format);
  const quickFormat = QUICK_FORMATS.find((q) => q.id === format);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 bg-card border-border hover:bg-muted"
        >
          {quickFormat ? (
            <>
              <quickFormat.icon className="h-4 w-4" />
              <span className="font-medium">{quickFormat.label}</span>
            </>
          ) : (
            <span className="font-medium max-w-[140px] truncate">{currentFormatName}</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Quick format options */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Quick Select
        </DropdownMenuLabel>
        {QUICK_FORMATS.map((quickFmt) => {
          const Icon = quickFmt.icon;
          const isSelected = format === quickFmt.id;
          return (
            <DropdownMenuItem
              key={quickFmt.id}
              onClick={() => setFormat(quickFmt.id)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              <span>{quickFmt.label}</span>
              <span className="text-muted-foreground text-xs">({quickFmt.sublabel})</span>
              {isSelected && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* All formats grouped by category */}
        {groupedFormats.map((group, idx) => (
          <DropdownMenuGroup key={group.id}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {group.label}
            </DropdownMenuLabel>
            {group.formats.map((f) => (
              <DropdownMenuItem
                key={f.id}
                onClick={() => setFormat(f.id as FormatId)}
                className="gap-2"
              >
                <span>{f.name}</span>
                {format === f.id && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
            ))}
            {idx < groupedFormats.length - 1 && <DropdownMenuSeparator />}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
