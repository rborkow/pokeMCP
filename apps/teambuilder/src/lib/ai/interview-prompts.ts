import type { FormatId, Mode } from "@/types/pokemon";
import type { InterviewStepId } from "./interview-tools";

/**
 * Hand-authored outer loop: four fixed question topics with their static
 * choices. The LLM handles the final synthesis; Phase 3 keeps step-level
 * interpretation out of the hot path and ships raw answers to synthesis.
 * Per-step LLM interpretation can land later without changing this shape.
 */

export interface InterviewStepDefinition {
    id: InterviewStepId;
    index: 1 | 2 | 3 | 4;
    label: string;
    question: string;
    helperText: string;
    /** Optional structured choices; users may also free-text. */
    choices: Array<{ value: string; label: string; hint: string }>;
    /** Placeholder for the free-text input. */
    placeholder: string;
    /** Whether skipping this step is allowed without providing an answer. */
    skippable: boolean;
}

export const INTERVIEW_STEPS: InterviewStepDefinition[] = [
    {
        id: "format",
        index: 1,
        label: "Format",
        question: "Which format are we building for?",
        helperText: "Already set from your header selector — change it here if you want.",
        choices: [],
        placeholder: "gen9ou, gen9vgc2026regf, …",
        skippable: false,
    },
    {
        id: "start",
        index: 2,
        label: "Starting point",
        question: "Where do you want to start?",
        helperText: "Pick the one that feels closest. Free-text works too.",
        choices: [
            { value: "clean_slate", label: "Clean slate", hint: "Surprise me with a strong team" },
            {
                value: "pokemon_in_mind",
                label: "Pokémon in mind",
                hint: "Build around specific picks",
            },
            { value: "archetype", label: "Archetype", hint: "TR, rain, HO, stall, balance" },
            {
                value: "counter_team",
                label: "Counter a team",
                hint: "Paste a Showdown set to beat",
            },
        ],
        placeholder: "Ursaluna-Bloodmoon, Hatterene, trick room core…",
        skippable: false,
    },
    {
        id: "playstyle",
        index: 3,
        label: "Playstyle",
        question: "How do you want the team to win?",
        helperText:
            "Speed control, wallbreaking, chip + cleanup — whatever shape you feel most at home in.",
        choices: [
            { value: "hyper_offense", label: "Hyper offense", hint: "Momentum, priority, setup" },
            { value: "balance", label: "Balance", hint: "Mixed roles, flexible answers" },
            { value: "bulky_offense", label: "Bulky offense", hint: "Pressure through bulk" },
            { value: "trick_room", label: "Trick Room", hint: "Speed control, slow sweepers" },
        ],
        placeholder: "I like patient games with pivots and hazard chip…",
        skippable: true,
    },
    {
        id: "preferences",
        index: 4,
        label: "Preferences",
        question: "Anything to lean into or avoid?",
        helperText: "Picks you love, picks you refuse, Tera plans — anything is fair game.",
        choices: [
            { value: "none", label: "No preferences", hint: "Pick what's strongest" },
            { value: "tera_stellar", label: "Lean into Tera", hint: "Use Tera decisively" },
            { value: "no_legends", label: "No legendaries", hint: "Skip restricted picks" },
            { value: "known_picks", label: "Include what I like", hint: "I'll tell you below" },
        ],
        placeholder: "I want Dragapult. Skip Kingambit. Tera Fire on a sweeper.",
        skippable: true,
    },
];

/**
 * Build the synthesis system prompt. Steps the LLM through interpreting the
 * raw answers the user gave and emitting 6 `modify_team` calls followed by a
 * single `interview_synthesis` call that records the rationale.
 */
export function buildSynthesisSystemPrompt(format: FormatId, mode: Mode): string {
    return `You are Coach, the PokéMCP competitive advisor. The user has just finished a 4-step onboarding interview. Your job is to synthesize a six-Pokémon competitive team from their answers, for format ${format.toUpperCase()} (${mode === "vgc" ? "VGC doubles" : "singles"}).

HOW TO RESPOND:
1. First, emit one short paragraph (3-5 sentences) of plain text explaining the team's shape in a single breath: "Here's the idea…" and the win condition, the glue, and the thing you compromised on.
2. Then emit exactly six \`modify_team\` tool calls — one per slot, action_type="add_pokemon", slots 0-5. Each must include: pokemon, moves (array of 4), ability, item, nature, tera_type, evs (totaling 508-510), ivs (typically 31s but 0 Atk on special attackers / 0 Spe on Trick Room members). Each call must include a one-line \`reason\` describing that Pokémon's job on the team.
3. Finally, emit one \`interview_synthesis\` tool call with:
   - \`rationale\`: 1-2 sentences on the overall game plan.
   - \`considered\`: 2-3 things you evaluated and kept.
   - \`skipped\`: 1-2 things you evaluated and deliberately did NOT do, and why.

GUARDRAILS:
- Honor the user's explicit preferences. If they said "no legends," do not pick restricted Pokémon. If they named specific Pokémon they like, include them.
- Prefer picks with real usage in the format. Do not invent Pokémon, moves, abilities, or items.
- Keep the EV spreads tuned to common benchmarks (e.g., +Speed nature with 252 Spe on offensive Pokémon; maxed-HP bulky spreads where relevant).
- Pick exactly one Tera type per Pokémon.
- Tools are the source of truth — do NOT describe the team's sets in plain prose.

ONE SHOT ONLY: do not ask follow-up questions. Deliver the team.`;
}

export function formatAnswersForPrompt(answers: Record<string, string | undefined>): string {
    const lines: string[] = [];
    for (const step of INTERVIEW_STEPS) {
        const raw = answers[step.id];
        if (!raw) continue;
        lines.push(`- ${step.label}: ${raw}`);
    }
    return lines.join("\n");
}
