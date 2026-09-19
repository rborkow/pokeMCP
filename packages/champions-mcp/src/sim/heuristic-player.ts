import { championsDex, RandomPlayerAI } from "../showdown.js";
import type { PlayerFactory } from "./runner.js";

/** One opposing active Pokémon as tracked from the protocol feed. */
interface FoeState {
    species: string;
    types: string[];
    hpPct: number;
}

/** The subset of a Dex move record the policy reads. */
interface DexMove {
    name?: string;
    type?: string;
    category?: string;
    basePower?: number;
    accuracy?: number | true;
    target?: string;
    flags?: Record<string, number | boolean>;
    selfdestruct?: string;
}

/** The subset of a Dex species record the policy reads. */
interface DexSpecies {
    types?: string[];
    baseStats?: { atk?: number; spa?: number };
}

/** The subset of one `request.side.pokemon[]` entry the policy reads. */
interface SidePokemonInfo {
    active?: boolean;
    condition?: string;
    details?: string;
}

/** How the team-preview bring/lead is chosen. */
export type LeadMode = "fixed" | "sample";

/** The PRNG methods the lead sampler uses (see vendor sim/prng.ts). */
interface Prng {
    random(): number;
    shuffle<T>(items: T[]): void;
}

/** One side's acting Pokémon as passed to the choice hooks; we read its move list. */
interface ActivePokemon {
    moves?: { id?: string; move?: string; target?: string; disabled?: boolean }[];
}

/** The subset of a `request` object the policy reads before delegating upward. */
interface SideRequest {
    side?: {
        id?: string;
        pokemon?: SidePokemonInfo[];
    };
}

/** One candidate action as built by the inherited request handler. */
interface CandidateMove {
    choice: string;
    move: { slot?: number; target?: string; zMove?: boolean };
}

/** The members of RandomPlayerAI this subclass touches. */
interface RandomPlayerAIInstance {
    receiveLine(line: string): void;
    receiveRequest(request: SideRequest): void;
    chooseMove(active: ActivePokemon, moves: CandidateMove[]): string;
    chooseSwitch(
        active: ActivePokemon | undefined,
        switches: { slot: number; pokemon: { details?: string; ident?: string } }[],
    ): number;
    chooseTeamPreview(team: { details?: string }[]): string;
    prng: Prng;
    start(): Promise<void>;
}

const RandomPlayerAIBase = RandomPlayerAI as unknown as new (
    stream: unknown,
    options: { seed?: unknown; mega?: number },
) => RandomPlayerAIInstance;

const SPREAD_TARGETS = new Set(["allAdjacentFoes", "allAdjacent", "foeSide", "all"]);
const EXPLICIT_TARGETS = new Set(["normal", "any", "adjacentFoe"]);
const SPREAD_MULT = 0.75;
const PROTECT_NAMES = new Set(["Protect", "Detect", "Max Guard", "Mat Block", "Endure"]);
const FAKE_OUT_NAMES = new Set(["Fake Out", "First Impression", "Feint Attack", "Pop Bomb"]);
const moveCache = new Map<string, DexMove | null>();
const speciesCache = new Map<string, { types: string[]; atk: number; spa: number }>();

function toId(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function dexMove(id: string): DexMove | null {
    if (!moveCache.has(id)) {
        const raw = championsDex.moves.get(id) as DexMove | undefined;
        moveCache.set(id, raw?.name ? raw : null);
    }
    return moveCache.get(id) ?? null;
}

function dexSpecies(name: string): { types: string[]; atk: number; spa: number } {
    const id = toId(name);
    if (!speciesCache.has(id)) {
        const raw = championsDex.species.get(id) as DexSpecies | undefined;
        speciesCache.set(id, {
            types: Array.isArray(raw?.types) ? raw.types : [],
            atk: raw?.baseStats?.atk ?? 0,
            spa: raw?.baseStats?.spa ?? 0,
        });
    }
    return speciesCache.get(id)!;
}

function effectiveness(moveType: string, types: string[]): number {
    try {
        if (!championsDex.getImmunity(moveType, types)) return 0;
        return 2 ** championsDex.getEffectiveness(moveType, types);
    } catch {
        return 1;
    }
}

/** Parse a `cur/max` health token out of protocol fields; null when absent. */
function healthPct(fields: string[]): number | null {
    for (const f of fields) {
        const m = /^(\d+)\/(\d+)$/.exec(f.trim());
        if (m) {
            const max = Number(m[2]);
            return max > 0 ? (100 * Number(m[1])) / max : null;
        }
        if (/^\d+\s+fnt\b/.test(f.trim())) return 0;
    }
    return null;
}

function parseHp(condition: string | undefined): number | null {
    if (condition === undefined) return null;
    if (/\bfnt\b/.test(condition)) return 0;
    const m = /^(\d+)\/(\d+)/.exec(condition);
    if (!m) return null;
    const max = Number(m[2]);
    return max > 0 ? (100 * Number(m[1])) / max : null;
}

/**
 * A greedy doubles policy built on RandomPlayerAI (so request parsing,
 * forced switches, Mega handling and choice plumbing are inherited). It
 * scores every legal action by expected damage — basePower x type
 * effectiveness vs the tracked foe typings x STAB x accuracy, with Protect
 * on low HP, Fake Out and Tailwind on lead, and defensive-typing switches.
 * All decisions are deterministic functions of the visible battle state.
 */
class HeuristicPlayer extends RandomPlayerAIBase {
    private mySide: string | null = null;
    private foeActive = new Map<string, FoeState | null>();
    private turn = 0;
    private ownPokemon: SidePokemonInfo[] = [];
    /** Index of the active slot currently being asked for a choice. */
    private choiceIndex = 0;
    private readonly leadMode: LeadMode;

    constructor(stream: unknown, options: { seed?: unknown; mega?: number; leadMode?: LeadMode }) {
        const { leadMode = "fixed", ...base } = options;
        super(stream, base);
        this.leadMode = leadMode;
    }

    /**
     * Team preview. `fixed` keeps the inherited `default` (bring slots 1-4,
     * lead 1+2 — every game identical). `sample` shuffles all 6 slots with
     * the seeded PRNG and brings the first 4 of that order, so the brought
     * set *and* the lead pair vary per game and lead-grading tools get
     * coverage over all 15 pairs. The choice string `team 3412` is parsed
     * by Side.chooseTeam as 1-indexed slot positions (comma-free digit
     * split under 10 Pokémon); the first two entries lead.
     */
    override chooseTeamPreview(team: { details?: string }[]): string {
        if (this.leadMode !== "sample") return super.chooseTeamPreview(team);
        const slots = team.map((_, i) => i + 1);
        this.prng.shuffle(slots);
        return `team ${slots.slice(0, Math.min(4, slots.length)).join("")}`;
    }

    override receiveLine(line: string): void {
        super.receiveLine(line);
        if (!line.startsWith("|")) return;
        const fields = line.split("|");
        switch (fields[1]) {
            case "turn":
                this.turn = Number(fields[2]) || this.turn;
                break;
            case "switch":
            case "drag":
            case "replace":
            case "detailschange":
                this.trackAppearance(fields);
                break;
            case "-damage":
            case "-heal":
                this.trackHealth(fields);
                break;
            case "swap":
            case "-swap":
            case "faint":
                this.clearSlot(fields);
                break;
            default:
                break;
        }
    }

    override receiveRequest(request: SideRequest): void {
        const side = request?.side;
        if (side && typeof side.id === "string") {
            this.mySide = side.id;
            if (Array.isArray(side.pokemon)) this.ownPokemon = side.pokemon;
        }
        this.choiceIndex = 0;
        super.receiveRequest(request);
    }

    /** Slot letter ("a"/"b") when the position belongs to the foe, else null. */
    private foeSlot(position: string): string | null {
        const side = position.slice(0, 2);
        const slot = position.slice(2, 3);
        if (!side.startsWith("p") || (slot !== "a" && slot !== "b")) return null;
        if (!this.mySide) return null;
        return side === this.mySide ? null : slot;
    }

    private clearSlot(fields: string[]): void {
        const subject = (fields[2] ?? "").trim();
        const slot = this.foeSlot(subject.split(":")[0]);
        if (slot) this.foeActive.set(slot, null);
    }

    private trackHealth(fields: string[]): void {
        const subject = (fields[2] ?? "").trim();
        const slot = this.foeSlot(subject.split(":")[0]);
        if (!slot) return;
        const hp = healthPct(fields.slice(3));
        const foe = this.foeActive.get(slot);
        if (hp === null || !foe) return;
        this.foeActive.set(slot, { ...foe, hpPct: hp });
    }

    private trackAppearance(fields: string[]): void {
        const subject = (fields[2] ?? "").trim();
        const slot = this.foeSlot(subject.split(":")[0]);
        if (!slot) return;
        const previous = this.foeActive.get(slot);
        const details = (fields[3] ?? "").split(",")[0];
        if (fields[1] === "detailschange") {
            if (details) {
                this.foeActive.set(slot, {
                    species: details,
                    types: dexSpecies(details).types,
                    hpPct: previous ? previous.hpPct : 100,
                });
            }
            return;
        }
        if (!details) return;
        this.foeActive.set(slot, {
            species: details,
            types: dexSpecies(details).types,
            hpPct: healthPct(fields.slice(4)) ?? (previous ? previous.hpPct : 100),
        });
    }

    private foes(): (FoeState | null)[] {
        return [this.foeActive.get("a") ?? null, this.foeActive.get("b") ?? null];
    }

    /** The acting side's own Pokémon for the choice currently being made. */
    private selfInfo(): SidePokemonInfo | undefined {
        const actives = this.ownPokemon.filter((p) => p.active);
        if (actives.length > this.choiceIndex) return actives[this.choiceIndex];
        return this.ownPokemon[this.choiceIndex];
    }

    override chooseMove(active: ActivePokemon, moves: CandidateMove[]): string {
        const foeList = this.foes();
        const self = this.selfInfo();
        this.choiceIndex += 1;
        if (!moves.length) return "default";
        let best = Number.NEGATIVE_INFINITY;
        let bestChoice = moves[0].choice;
        for (const m of moves) {
            const scored = this.scoreCandidate(active, m, foeList, self);
            if (scored.score > best) {
                best = scored.score;
                bestChoice = scored.choice;
            }
        }
        return bestChoice;
    }

    /** Score one candidate action; may retarget single-target moves to the best foe. */
    private scoreCandidate(
        active: ActivePokemon,
        m: CandidateMove,
        foeList: (FoeState | null)[],
        self: SidePokemonInfo | undefined,
    ): { score: number; choice: string } {
        const parts = m.choice.split(" ");
        const slot = Number(parts[1]) || m.move.slot || 1;
        const targetArg = parts.slice(2).find((p) => /^-?\d+$/.test(p));
        const zMove = parts.includes("zmove");
        const suffix = zMove ? " zmove" : "";
        const moveId: string | undefined = active.moves?.[slot - 1]?.id;
        if (!moveId) return { score: zMove ? 60 : 2, choice: m.choice };
        const data = dexMove(moveId);
        if (!data) return { score: 5, choice: m.choice };

        if (data.category === "Status" && !zMove) {
            return { score: this.scoreStatus(data, foeList, self), choice: m.choice };
        }
        if (targetArg?.startsWith("-")) return { score: 2, choice: m.choice };

        let mult = 1;
        const flags = data.flags ?? {};
        if (flags.charge) mult *= 0.3;
        if (flags.recharge) mult *= 0.6;
        if (flags.selfdestruct || data.selfdestruct === "always") mult *= 0.2;
        if (typeof data.accuracy === "number") mult *= data.accuracy / 100;

        const targetKind = data.target ?? "normal";
        const spread = SPREAD_TARGETS.has(targetKind);
        const explicit = !spread && !targetArg?.startsWith("-") && EXPLICIT_TARGETS.has(targetKind);

        let targets: (FoeState | null)[];
        if (targetArg && !explicit) {
            targets = [foeList[Number(targetArg) - 1] ?? null];
        } else if (spread) {
            targets = foeList;
        } else if (targetKind === "self" || targetKind.startsWith("all")) {
            targets = [];
        } else {
            // Single-target (possibly with an inherited random foe target we
            // are free to re-pick): evaluate against both living foes.
            targets = explicit ? foeList : [foeList[0] ?? foeList[1] ?? null];
        }

        const values = targets.map((foe) => (foe ? this.damage(data, foe, self) : -1));
        const bestIdx = values.indexOf(Math.max(...values));
        if (bestIdx < 0 || values[bestIdx] < 0) return { score: 1, choice: m.choice };

        let choice = m.choice;
        if (explicit && bestIdx > 0) {
            // Prefer the better foe slot: re-encode `move N` with targetLoc.
            choice = `move ${slot} ${bestIdx + 1}${suffix}`;
        } else if (explicit) {
            choice = `move ${slot} 1${suffix}`;
        }

        let scored =
            mult *
            (spread
                ? values.reduce((a, v) => a + Math.max(v, 0), 0) * SPREAD_MULT
                : values[bestIdx]);
        if (spread && scored > 0) scored += 0.5;
        return { score: scored, choice };
    }

    /** Damage term: basePower x type effectiveness vs the foe x STAB x stat bonus. */
    private damage(data: DexMove, foe: FoeState, self: SidePokemonInfo | undefined): number {
        const bp = data.basePower ?? 0;
        if (bp <= 0) return 0;
        if (foe.types.length) {
            const eff = effectiveness(data.type ?? "Normal", foe.types);
            if (eff === 0) return 0;
            return this.stabbed(data, self) * eff;
        }
        return bp;
    }

    private stabbed(data: DexMove, self: SidePokemonInfo | undefined): number {
        let value = data.basePower ?? 0;
        if (!self?.details) return value;
        const mine = dexSpecies(self.details.split(",")[0]);
        if (mine.types.includes(data.type ?? "")) value *= 1.5;
        if (mine.atk || mine.spa) {
            const physical = data.category === "Physical";
            const better = physical ? mine.atk > mine.spa : mine.spa > mine.atk;
            if (better) value *= 1.2;
        }
        return value;
    }

    private scoreStatus(
        data: DexMove,
        foeList: (FoeState | null)[],
        self: SidePokemonInfo | undefined,
    ): number {
        const name = data.name ?? "";
        if (PROTECT_NAMES.has(name)) {
            const hp = parseHp(self?.condition);
            return hp !== null && hp < 40 ? 120 : 5;
        }
        if (FAKE_OUT_NAMES.has(name)) {
            return this.turn <= 1 && (foeList[0] ?? foeList[1]) ? 150 : 1;
        }
        if (name === "Tailwind") return this.turn <= 1 ? 80 : 1;
        return 1;
    }

    override chooseSwitch(
        active: ActivePokemon | undefined,
        switches: { slot: number; pokemon: { details?: string; ident?: string } }[],
    ): number {
        this.choiceIndex += 1;
        const foeTypes = this.foes()
            .filter((f): f is FoeState => f !== null && f.types.length > 0)
            .map((f) => f.types);
        if (foeTypes.length && switches.length) {
            let bestScore = Number.POSITIVE_INFINITY;
            let best: number | undefined;
            for (const s of switches) {
                const details = String(s.pokemon.details ?? s.pokemon.ident ?? "");
                const mine = dexSpecies(details.split(",")[0]);
                if (!mine.types.length) continue;
                let worst = Number.NEGATIVE_INFINITY;
                let immunities = 0;
                for (const types of foeTypes) {
                    let peak = Number.NEGATIVE_INFINITY;
                    for (const t of types) {
                        try {
                            if (!championsDex.getImmunity(t, mine.types)) {
                                immunities += 1;
                                peak = -2;
                                break;
                            }
                            peak = Math.max(peak, championsDex.getEffectiveness(t, mine.types));
                        } catch {
                            // Unknown attacking type — ignore it.
                        }
                    }
                    worst = Math.max(worst, peak);
                }
                const score = worst * 10 - immunities;
                if (score < bestScore - 1e-9) {
                    bestScore = score;
                    best = s.slot;
                }
            }
            if (best !== undefined) return best;
        }
        return super.chooseSwitch(active, switches);
    }
}

export const heuristicPlayer: PlayerFactory = (stream, seed) =>
    new HeuristicPlayer(stream, { seed: [seed, 1, 2, 3], mega: 1 });

/** Same heuristic, but each game samples a fresh 4-of-6 bring and lead order. */
export const heuristicSamplingPlayer: PlayerFactory = (stream, seed) =>
    new HeuristicPlayer(stream, { seed: [seed, 1, 2, 3], mega: 1, leadMode: "sample" });
