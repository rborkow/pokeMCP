"use client";

import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface MovesSectionProps {
	moves: string[];
	pokemonName: string;
	popularMoves: string[];
	onMoveChange: (index: number, move: string) => void;
	getMoveValue: (index: number) => string;
}

export function MovesSection({
	moves: _moves,
	pokemonName,
	popularMoves,
	onMoveChange,
	getMoveValue,
}: MovesSectionProps) {
	return (
		<div className="space-y-2">
			<label className="text-sm font-medium">
				Moves
				{popularMoves.length > 0 && (
					<span className="text-xs text-muted-foreground ml-2">
						(showing popular moves for {pokemonName})
					</span>
				)}
			</label>
			<div className="grid grid-cols-2 gap-2">
				{[0, 1, 2, 3].map((i) =>
					popularMoves.length > 0 ? (
						<Select
							key={i}
							value={getMoveValue(i) || "none"}
							onValueChange={(value) =>
								onMoveChange(i, value === "none" ? "" : value)
							}
						>
							<SelectTrigger>
								<SelectValue placeholder={`Move ${i + 1}`} />
							</SelectTrigger>
							<SelectContent className="max-h-60">
								<SelectItem value="none">None</SelectItem>
								{popularMoves.map((move) => (
									<SelectItem key={move} value={move}>
										{move}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : (
						<Input
							key={i}
							value={getMoveValue(i)}
							onChange={(e) => onMoveChange(i, e.target.value)}
							placeholder={`Move ${i + 1}`}
						/>
					),
				)}
			</div>
		</div>
	);
}
