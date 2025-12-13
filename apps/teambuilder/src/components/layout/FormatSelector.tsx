"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FORMATS, type FormatId } from "@/types/pokemon";
import { useTeamStore } from "@/stores/team-store";

export function FormatSelector() {
  const { format, setFormat } = useTeamStore();

  return (
    <Select value={format} onValueChange={(value) => setFormat(value as FormatId)}>
      <SelectTrigger className="w-[180px] bg-card">
        <SelectValue placeholder="Select format" />
      </SelectTrigger>
      <SelectContent>
        {FORMATS.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
