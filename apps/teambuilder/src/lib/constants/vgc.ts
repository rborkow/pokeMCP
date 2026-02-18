/**
 * VGC-specific constants
 */

// Team preview rules
export const VGC_TEAM_SIZE = 6;
export const VGC_BRING_COUNT = 4;
export const VGC_MIN_TEAM_FOR_PREVIEW = 4;

// Tips shown in BringFourSelector when selection is complete
export const VGC_TEAM_PREVIEW_TIPS = [
    "Do your leads have good speed control options?",
    "Can you handle Trick Room if opponent sets it?",
    "Do you have Protect on key Pokemon for scouting?",
] as const;

// Tips shown in ThreatMatrix for VGC mode
export const VGC_THREAT_MATRIX_TIPS = [
    "In VGC, consider which 4 of your 6 Pokemon you'd bring vs these threats",
    "Lead matchups matter - can your leads handle common opposing leads?",
    "Speed control (Tailwind/Trick Room) can flip unfavorable matchups",
] as const;

// Tips shown in ThreatMatrix for Singles mode
export const SINGLES_THREAT_MATRIX_TIPS = [
    "Consider how your team handles these Pokemon defensively and offensively",
    "Entry hazards can wear down threats over time - Stealth Rock is key",
    "Pivoting moves help maintain momentum against checks",
] as const;
