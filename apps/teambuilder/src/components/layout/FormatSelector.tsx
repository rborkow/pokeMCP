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
import {
  FORMAT_CATEGORIES,
  type FormatId,
  getFormatDisplayName,
  getFormatsForMode,
} from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";
import { ChevronDown, Check } from "lucide-react";

export function FormatSelector() {
  const { mode, format, setFormat, team } = useTeamStore();
  const [pendingFormat, setPendingFormat] = useState<FormatId | null>(null);

  // Get formats for current mode
  const availableFormats = getFormatsForMode(mode);

  // Group formats by category (only categories relevant to current mode)
  const groupedFormats = FORMAT_CATEGORIES.map((category) => ({
    ...category,
    formats: availableFormats.filter((f) => f.category === category.id),
  })).filter((group) => group.formats.length > 0);

  // Get current format display info
  const currentFormatName = getFormatDisplayName(format);

  const handleFormatChange = (newFormat: FormatId) => {
    if (newFormat === format) return;

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
            <span className="font-medium max-w-[160px] truncate">{currentFormatName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {groupedFormats.map((group, idx) => (
            <DropdownMenuGroup key={group.id}>
              {groupedFormats.length > 1 && (
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {group.label}
                </DropdownMenuLabel>
              )}
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

      <AlertDialog
        open={pendingFormat !== null}
        onOpenChange={(open) => !open && setPendingFormat(null)}
      >
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
