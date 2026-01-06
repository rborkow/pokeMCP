"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FORMATS, FORMAT_CATEGORIES, type FormatId, getFormatDisplayName } from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";
import { Swords, Users, ChevronDown, Check } from "lucide-react";

// Quick access format options
const QUICK_FORMATS = [
  { id: "gen9ou" as FormatId, label: "Singles", sublabel: "OU", icon: Swords },
  { id: "gen9vgc2024regh" as FormatId, label: "Doubles", sublabel: "VGC", icon: Users },
];

// IDs to exclude from grouped list (already in quick select)
const QUICK_FORMAT_IDS = new Set(QUICK_FORMATS.map((q) => q.id));

export function FormatSelector() {
  const { format, setFormat, team } = useTeamStore();
  const [pendingFormat, setPendingFormat] = useState<FormatId | null>(null);

  // Group formats by category, excluding quick formats to avoid duplicates
  const groupedFormats = FORMAT_CATEGORIES.map((category) => ({
    ...category,
    formats: FORMATS.filter((f) => f.category === category.id && !QUICK_FORMAT_IDS.has(f.id)),
  })).filter((group) => group.formats.length > 0); // Remove empty groups

  // Get current format display info
  const currentFormatName = getFormatDisplayName(format);
  const quickFormat = QUICK_FORMATS.find((q) => q.id === format);

  const handleFormatChange = (newFormat: FormatId) => {
    if (newFormat === format) return; // No change

    // If team has Pokemon, show confirmation
    if (team.length > 0) {
      setPendingFormat(newFormat);
    } else {
      setFormat(newFormat);
    }
  };

  const confirmFormatChange = () => {
    if (pendingFormat) {
      setFormat(pendingFormat);
      setPendingFormat(null);
    }
  };

  return (
    <>
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
              onClick={() => handleFormatChange(quickFmt.id)}
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
                onClick={() => handleFormatChange(f.id as FormatId)}
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

    <AlertDialog open={pendingFormat !== null} onOpenChange={(open) => !open && setPendingFormat(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change format?</AlertDialogTitle>
          <AlertDialogDescription>
            You have {team.length} Pokémon in your team. Changing to{" "}
            <span className="font-medium text-foreground">
              {pendingFormat ? getFormatDisplayName(pendingFormat) : ""}
            </span>{" "}
            may affect team legality — some Pokémon, moves, or items might not be allowed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmFormatChange}>Change format</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
