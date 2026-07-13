export interface ChampionsCapability {
    id: `champions-${string}`;
    label: string;
    startsAt: string;
    supported: boolean;
    mechanicsVersion: string;
    incompleteMechanics: readonly string[];
}

export const CHAMPIONS_CAPABILITIES: readonly ChampionsCapability[] = [
    {
        id: "champions-regma",
        label: "Regulation M-A",
        startsAt: "2026-04-01",
        supported: true,
        mechanicsVersion: "champions-regma-2026-04",
        incompleteMechanics: ["VP-sensitive speed order"],
    },
    {
        id: "champions-regmb",
        label: "Regulation M-B",
        startsAt: "2026-07-01",
        supported: true,
        mechanicsVersion: "champions-regmb-2026-07-beta",
        incompleteMechanics: ["VP-sensitive speed order", "unreleased move interactions"],
    },
];

export function getDefaultChampionsCapability(): ChampionsCapability {
    const capability = CHAMPIONS_CAPABILITIES.filter((item) => item.supported).sort((a, b) =>
        b.startsAt.localeCompare(a.startsAt),
    )[0];
    if (!capability) throw new Error("No supported Champions regulation is configured.");
    return capability;
}

export const DEFAULT_CHAMPIONS_FORMAT = getDefaultChampionsCapability().id;
