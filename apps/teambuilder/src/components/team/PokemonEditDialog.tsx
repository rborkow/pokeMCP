"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PokemonSprite } from "./PokemonSprite";
import type { TeamPokemon, BaseStats } from "@/types/pokemon";
import { TYPES, NATURES } from "@/types/pokemon";

interface PokemonEditDialogProps {
  pokemon: TeamPokemon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (pokemon: TeamPokemon) => void;
}

const DEFAULT_POKEMON: TeamPokemon = {
  pokemon: "",
  moves: ["", "", "", ""],
  ability: "",
  item: "",
  nature: "Hardy",
  teraType: "",
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  level: 100,
};

const STAT_LABELS: Record<keyof BaseStats, string> = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
};

export function PokemonEditDialog({
  pokemon,
  open,
  onOpenChange,
  onSave,
}: PokemonEditDialogProps) {
  const [editedPokemon, setEditedPokemon] = useState<TeamPokemon>(
    pokemon || DEFAULT_POKEMON
  );
  const [evTotal, setEvTotal] = useState(0);

  // Reset when pokemon changes
  useEffect(() => {
    if (pokemon) {
      setEditedPokemon({
        ...DEFAULT_POKEMON,
        ...pokemon,
        moves: [...(pokemon.moves || []), "", "", "", ""].slice(0, 4),
        evs: { ...DEFAULT_POKEMON.evs, ...pokemon.evs },
        ivs: { ...DEFAULT_POKEMON.ivs, ...pokemon.ivs },
      });
    } else {
      setEditedPokemon(DEFAULT_POKEMON);
    }
  }, [pokemon, open]);

  // Calculate EV total
  useEffect(() => {
    const total = Object.values(editedPokemon.evs || {}).reduce(
      (sum, val) => sum + (val || 0),
      0
    );
    setEvTotal(total);
  }, [editedPokemon.evs]);

  const updateField = <K extends keyof TeamPokemon>(
    field: K,
    value: TeamPokemon[K]
  ) => {
    setEditedPokemon((prev) => ({ ...prev, [field]: value }));
  };

  const updateMove = (index: number, move: string) => {
    const currentMoves = editedPokemon.moves || ["", "", "", ""];
    const newMoves = [...currentMoves];
    // Ensure array has at least 4 slots
    while (newMoves.length < 4) newMoves.push("");
    newMoves[index] = move;
    setEditedPokemon((prev) => ({ ...prev, moves: newMoves }));
  };

  // Safe access to moves array
  const getMoveValue = (index: number): string => {
    return editedPokemon.moves?.[index] || "";
  };

  const updateEV = (stat: keyof BaseStats, value: number) => {
    const currentTotal = evTotal - (editedPokemon.evs?.[stat] || 0);
    const newValue = Math.min(252, Math.max(0, value));

    // Don't allow total to exceed 508
    if (currentTotal + newValue > 508) {
      return;
    }

    setEditedPokemon((prev) => ({
      ...prev,
      evs: { ...prev.evs, [stat]: newValue },
    }));
  };

  const updateIV = (stat: keyof BaseStats, value: number) => {
    const newValue = Math.min(31, Math.max(0, value));
    setEditedPokemon((prev) => ({
      ...prev,
      ivs: { ...prev.ivs, [stat]: newValue },
    }));
  };

  const handleSave = () => {
    // Filter out empty moves
    const cleanedPokemon = {
      ...editedPokemon,
      moves: editedPokemon.moves.filter((m) => m.trim() !== ""),
    };
    onSave(cleanedPokemon);
    onOpenChange(false);
  };

  const isValid = editedPokemon.pokemon.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {editedPokemon.pokemon && (
              <PokemonSprite pokemon={editedPokemon.pokemon} size="md" />
            )}
            {pokemon ? `Edit ${pokemon.pokemon}` : "Add Pokemon"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure Pokemon species, moves, ability, item, nature, EVs and IVs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pokemon Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Pokemon</label>
            <Input
              value={editedPokemon.pokemon}
              onChange={(e) => updateField("pokemon", e.target.value)}
              placeholder="e.g. Garchomp, Landorus-Therian"
            />
          </div>

          {/* Nickname */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Nickname (optional)</label>
            <Input
              value={editedPokemon.nickname || ""}
              onChange={(e) => updateField("nickname", e.target.value)}
              placeholder="Optional nickname"
            />
          </div>

          {/* Item & Ability Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Item</label>
              <Input
                value={editedPokemon.item || ""}
                onChange={(e) => updateField("item", e.target.value)}
                placeholder="e.g. Life Orb"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Ability</label>
              <Input
                value={editedPokemon.ability || ""}
                onChange={(e) => updateField("ability", e.target.value)}
                placeholder="e.g. Rough Skin"
              />
            </div>
          </div>

          {/* Nature & Tera Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nature</label>
              <Select
                value={editedPokemon.nature || "Hardy"}
                onValueChange={(value) => updateField("nature", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(NATURES).map((nature) => (
                    <SelectItem key={nature} value={nature}>
                      {nature}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tera Type</label>
              <Select
                value={editedPokemon.teraType || "none"}
                onValueChange={(value) => updateField("teraType", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Moves */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Moves</label>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <Input
                  key={i}
                  value={getMoveValue(i)}
                  onChange={(e) => updateMove(i, e.target.value)}
                  placeholder={`Move ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* EVs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">EVs</label>
              <span
                className={`text-xs ${evTotal > 508 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {evTotal}/508
              </span>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {(Object.keys(STAT_LABELS) as (keyof BaseStats)[]).map((stat) => (
                <div key={stat} className="space-y-1">
                  <label className="text-xs text-muted-foreground text-center block">
                    {STAT_LABELS[stat]}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={252}
                    value={editedPokemon.evs?.[stat] || 0}
                    onChange={(e) => updateEV(stat, parseInt(e.target.value) || 0)}
                    className="text-center text-sm h-8 px-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* IVs */}
          <div className="space-y-2">
            <label className="text-sm font-medium">IVs</label>
            <div className="grid grid-cols-6 gap-2">
              {(Object.keys(STAT_LABELS) as (keyof BaseStats)[]).map((stat) => (
                <div key={stat} className="space-y-1">
                  <label className="text-xs text-muted-foreground text-center block">
                    {STAT_LABELS[stat]}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={31}
                    value={editedPokemon.ivs?.[stat] ?? 31}
                    onChange={(e) => updateIV(stat, parseInt(e.target.value) || 0)}
                    className="text-center text-sm h-8 px-1"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
