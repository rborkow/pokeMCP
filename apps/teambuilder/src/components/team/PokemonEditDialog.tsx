"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePokemonData } from "@/hooks/usePokemonData";
import { usePokemonEditState } from "@/hooks/usePokemonEditState";
import { COMMON_ITEMS } from "@/lib/data/items";
import { useTeamStore } from "@/stores/team-store";
import type { TeamPokemon } from "@/types/pokemon";
import { NATURES, TYPES } from "@/types/pokemon";
import { EVSection } from "./edit/EVSection";
import { IVSection } from "./edit/IVSection";
import { MovesSection } from "./edit/MovesSection";
import { PokemonSprite } from "./PokemonSprite";

interface PokemonEditDialogProps {
	pokemon: TeamPokemon | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (pokemon: TeamPokemon) => void;
}

export function PokemonEditDialog({
	pokemon,
	open,
	onOpenChange,
	onSave,
}: PokemonEditDialogProps) {
	const { format } = useTeamStore();
	const {
		editedPokemon,
		updateField,
		updateMove,
		getMoveValue,
		updateEV,
		updateIV,
		evTotal,
		handleSave: getCleanedPokemon,
	} = usePokemonEditState(pokemon, open);

	const { validAbilities, popularMoves, popularItems } = usePokemonData(
		editedPokemon.pokemon,
		format,
		open,
	);

	const handleSave = () => {
		onSave(getCleanedPokemon());
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
							<Select
								value={editedPokemon.item || "none"}
								onValueChange={(value) =>
									updateField("item", value === "none" ? "" : value)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select item" />
								</SelectTrigger>
								<SelectContent className="max-h-60">
									<SelectItem value="none">None</SelectItem>
									{popularItems.length > 0 && (
										<>
											<SelectItem
												value="__popular_header__"
												disabled
												className="text-xs font-semibold text-muted-foreground"
											>
												Popular for {editedPokemon.pokemon}
											</SelectItem>
											{popularItems.map((item) => (
												<SelectItem key={`popular-${item}`} value={item}>
													⭐ {item}
												</SelectItem>
											))}
											<SelectItem
												value="__all_header__"
												disabled
												className="text-xs font-semibold text-muted-foreground border-t mt-1 pt-1"
											>
												All Items
											</SelectItem>
										</>
									)}
									{COMMON_ITEMS.filter((i) => !popularItems.includes(i)).map(
										(item) => (
											<SelectItem key={item} value={item}>
												{item}
											</SelectItem>
										),
									)}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Ability</label>
							{validAbilities.length > 0 ? (
								<Select
									value={editedPokemon.ability || "none"}
									onValueChange={(value) =>
										updateField("ability", value === "none" ? "" : value)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select ability" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">None</SelectItem>
										{validAbilities.map((ability) => (
											<SelectItem key={ability} value={ability}>
												{ability}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<Input
									value={editedPokemon.ability || ""}
									onChange={(e) => updateField("ability", e.target.value)}
									placeholder="Enter Pokemon first"
								/>
							)}
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
								onValueChange={(value) =>
									updateField("teraType", value === "none" ? "" : value)
								}
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
					<MovesSection
						moves={editedPokemon.moves}
						pokemonName={editedPokemon.pokemon}
						popularMoves={popularMoves}
						onMoveChange={updateMove}
						getMoveValue={getMoveValue}
					/>

					{/* EVs */}
					<EVSection
						evs={editedPokemon.evs}
						evTotal={evTotal}
						onEVChange={updateEV}
					/>

					{/* IVs */}
					<IVSection ivs={editedPokemon.ivs} onIVChange={updateIV} />

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
