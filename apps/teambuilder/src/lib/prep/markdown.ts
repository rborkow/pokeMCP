import type { PrepPlan } from "./schema";

export function battleCardToMarkdown(plan: PrepPlan): string {
    const card = plan.battleCard;
    const lines = [
        `# ${plan.ownTeam.name} into ${plan.opponentTeam.name}`,
        "",
        `Format: ${plan.format}`,
        `Mechanics version: ${plan.mechanicsVersion}`,
        "",
        "## Bring 4",
        "",
        card.bringFour.map((pokemon, index) => `${index + 1}. ${pokemon}`).join("\n"),
        "",
        "## Lead plans",
        "",
        ...card.leadPlans.flatMap((lead) => [
            `### ${lead.pokemon.join(" + ")}`,
            lead.purpose,
            `Use when: ${lead.useWhen}`,
            "",
        ]),
        "## Likely opposing lead",
        "",
        ...card.likelyOpponentLeads.map(
            (lead) => `- ${lead.pokemon.join(" + ")}: ${lead.purpose}`,
        ),
        "",
        "## Opening lines",
        "",
        ...card.openingLines.flatMap((line) => [
            `- **${line.lead.join(" + ")}**: ${line.primary}`,
            `  - Alternative: ${line.alternative}`,
        ]),
        "",
        "## Danger points",
        "",
        ...card.dangerPoints.flatMap((point) => [
            `- **${point.title}**: ${point.detail}`,
            `  - Response: ${point.response}`,
        ]),
        "",
        "## Practice checklist",
        "",
        ...card.practiceChecklist.map((item) => `- [${item.done ? "x" : " "}] ${item.label}`),
        "",
        "## Evidence",
        "",
        ...card.evidence.map((item) =>
            `- **${item.label}** (${item.kind}): ${item.detail}${item.sourceUrl ? ` — ${item.sourceUrl}` : ""}`,
        ),
    ];
    return lines.join("\n");
}
