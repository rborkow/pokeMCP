"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMATS, FORMAT_CATEGORIES, type FormatId } from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";

export function FormatSelector() {
  const { format, setFormat } = useTeamStore();

  // Group formats by category
  const groupedFormats = FORMAT_CATEGORIES.map((category) => ({
    ...category,
    formats: FORMATS.filter((f) => f.category === category.id),
  }));

  // Get current format name for display
  const currentFormat = FORMATS.find((f) => f.id === format);

  return (
    <Select value={format} onValueChange={(value) => setFormat(value as FormatId)}>
      <SelectTrigger className="w-[200px] bg-card">
        <SelectValue placeholder="Select format">
          {currentFormat?.name || "Select format"}
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
  );
}
