/** A real plan_matchup result (six full sets a side, no usage data), for the preview page and tests. */
import type { MatchupData } from "./types.js";

export const MATCHUP_FIXTURE: MatchupData = {
  "format": "champions-regmc",
  "formatName": "Pokémon Champions — Regulation M-C",
  "bring": {
    "indices": [
      0,
      1,
      2,
      4
    ],
    "score": -61,
    "reasons": [
      {
        "kind": "coverage",
        "subject": "Dragonite",
        "detail": "rank 1, weight 6 × best answer value -6",
        "points": -36
      },
      {
        "kind": "sweeper",
        "subject": "Dragonite",
        "detail": "4/4 lose; -30 × (4-2)",
        "points": -60
      },
      {
        "kind": "coverage",
        "subject": "Torkoal",
        "detail": "rank 2, weight 5 × best answer value 2",
        "points": 10
      },
      {
        "kind": "coverage",
        "subject": "Sneasler",
        "detail": "rank 3, weight 4 × best answer value 2",
        "points": 8
      },
      {
        "kind": "coverage",
        "subject": "Charizard-Mega-Y",
        "detail": "rank 4, weight 3 × best answer value 2",
        "points": 6
      },
      {
        "kind": "coverage",
        "subject": "Venusaur",
        "detail": "rank 5, weight 2 × best answer value 2",
        "points": 4
      },
      {
        "kind": "coverage",
        "subject": "Hatterene",
        "detail": "rank 6, weight 1 × best answer value 4",
        "points": 4
      },
      {
        "kind": "speedControl",
        "subject": "Talonflame",
        "detail": "Talonflame Tailwind: Incineroar vs Venusaur: Speed 80 vs 132: slower -> faster, conditional on setup",
        "points": 2
      },
      {
        "kind": "disruption",
        "subject": "Incineroar",
        "detail": "Incineroar Intimidate: Garchomp vs Sneasler: Attack stage 0 -> -1: Check -> Counter",
        "points": 1
      },
      {
        "kind": "member",
        "subject": "Incineroar",
        "points": 0,
        "detail": "slot 0: 1 Counters, 1 Checks; only selected answer to none; informational, already counted in coverage"
      },
      {
        "kind": "member",
        "subject": "Garchomp",
        "points": 0,
        "detail": "slot 1: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
      },
      {
        "kind": "member",
        "subject": "Rotom-Wash",
        "points": 0,
        "detail": "slot 2: 0 Counters, 2 Checks; only selected answer to none; informational, already counted in coverage"
      },
      {
        "kind": "member",
        "subject": "Talonflame",
        "points": 0,
        "detail": "slot 4: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
      }
    ],
    "pokemon": [
      "Incineroar",
      "Garchomp",
      "Rotom-Wash",
      "Talonflame"
    ]
  },
  "lead": {
    "indices": [
      0,
      4
    ],
    "opponent": [
      0,
      5
    ],
    "score": -2,
    "reasons": [
      {
        "kind": "leadCell",
        "subject": "Incineroar vs Charizard-Mega-Y",
        "detail": "likely OHKO 0, incoming OHKO 0, likely 2HKO 0, incoming 2HKO 0, Speed sign -1",
        "points": -1
      },
      {
        "kind": "leadCell",
        "subject": "Incineroar vs Dragonite",
        "detail": "likely OHKO 0, incoming OHKO 0, likely 2HKO 0, incoming 2HKO 0, Speed sign -1",
        "points": -1
      },
      {
        "kind": "leadCell",
        "subject": "Talonflame vs Charizard-Mega-Y",
        "detail": "likely OHKO 0, incoming OHKO 0, likely 2HKO 1, incoming 2HKO 1, Speed sign 1",
        "points": 1
      },
      {
        "kind": "leadCell",
        "subject": "Talonflame vs Dragonite",
        "detail": "likely OHKO 0, incoming OHKO 0, likely 2HKO 0, incoming 2HKO 1, Speed sign 1",
        "points": -1
      }
    ],
    "pokemon": [
      "Incineroar",
      "Talonflame"
    ]
  },
  "back": {
    "indices": [
      1,
      2
    ],
    "pokemon": [
      "Garchomp",
      "Rotom-Wash"
    ],
    "reasons": [
      {
        "kind": "back",
        "subject": "Remaining bring members",
        "detail": "4 selected minus 2 leads = 2 back members",
        "points": 0
      }
    ]
  },
  "threats": [
    {
      "opponent": 5,
      "pokemon": "Dragonite",
      "beats": 6,
      "outspeeds": 2,
      "answers": [],
      "trickRoomAnswers": [],
      "rank": 1,
      "weight": 6
    },
    {
      "opponent": 4,
      "pokemon": "Torkoal",
      "beats": 4,
      "outspeeds": 0,
      "answers": [
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 2,
          "pokemon": "Rotom-Wash",
          "verdict": "Check"
        }
      ],
      "trickRoomAnswers": [
        {
          "member": 2,
          "pokemon": "Rotom-Wash",
          "verdict": "Check"
        }
      ],
      "rank": 2,
      "weight": 5
    },
    {
      "opponent": 2,
      "pokemon": "Sneasler",
      "beats": 2,
      "outspeeds": 4,
      "answers": [
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 3,
          "pokemon": "Gardevoir",
          "verdict": "Check"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        }
      ],
      "trickRoomAnswers": [
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 2,
          "pokemon": "Rotom-Wash",
          "verdict": "Check"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        }
      ],
      "rank": 3,
      "weight": 4
    },
    {
      "opponent": 0,
      "pokemon": "Charizard-Mega-Y",
      "beats": 1,
      "outspeeds": 3,
      "answers": [
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 3,
          "pokemon": "Gardevoir",
          "verdict": "Check"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        }
      ],
      "trickRoomAnswers": [
        {
          "member": 0,
          "pokemon": "Incineroar",
          "verdict": "Check"
        },
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 2,
          "pokemon": "Rotom-Wash",
          "verdict": "Check"
        }
      ],
      "rank": 4,
      "weight": 3
    },
    {
      "opponent": 1,
      "pokemon": "Venusaur",
      "beats": 1,
      "outspeeds": 3,
      "answers": [
        {
          "member": 0,
          "pokemon": "Incineroar",
          "verdict": "Check"
        },
        {
          "member": 1,
          "pokemon": "Garchomp",
          "verdict": "Check"
        },
        {
          "member": 3,
          "pokemon": "Gardevoir",
          "verdict": "Check"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        }
      ],
      "trickRoomAnswers": [
        {
          "member": 0,
          "pokemon": "Incineroar",
          "verdict": "Check"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        },
        {
          "member": 5,
          "pokemon": "Kingambit",
          "verdict": "Check"
        }
      ],
      "rank": 5,
      "weight": 2
    },
    {
      "opponent": 3,
      "pokemon": "Hatterene",
      "beats": 1,
      "outspeeds": 0,
      "answers": [
        {
          "member": 0,
          "pokemon": "Incineroar",
          "verdict": "Counter"
        },
        {
          "member": 2,
          "pokemon": "Rotom-Wash",
          "verdict": "Check"
        },
        {
          "member": 3,
          "pokemon": "Gardevoir",
          "verdict": "Counter"
        },
        {
          "member": 4,
          "pokemon": "Talonflame",
          "verdict": "Check"
        },
        {
          "member": 5,
          "pokemon": "Kingambit",
          "verdict": "Counter"
        }
      ],
      "trickRoomAnswers": [
        {
          "member": 0,
          "pokemon": "Incineroar",
          "verdict": "Counter"
        },
        {
          "member": 3,
          "pokemon": "Gardevoir",
          "verdict": "Counter"
        },
        {
          "member": 5,
          "pokemon": "Kingambit",
          "verdict": "Counter"
        }
      ],
      "rank": 6,
      "weight": 1
    }
  ],
  "speedNotes": [
    {
      "provider": 0,
      "member": 1,
      "opponent": 2,
      "kind": "Intimidate",
      "detail": "Incineroar Intimidate: Garchomp vs Sneasler: Attack stage 0 -> -1: Check -> Counter"
    },
    {
      "provider": 0,
      "member": 2,
      "opponent": 0,
      "kind": "Fake Out",
      "detail": "Incineroar Fake Out: Rotom-Wash vs Charizard-Mega-Y: Trade -> Check if flinch grants partner first action; base Speed 106 vs 167"
    },
    {
      "provider": 0,
      "member": 2,
      "opponent": 2,
      "kind": "Fake Out",
      "detail": "Incineroar Fake Out: Rotom-Wash vs Sneasler: Trade -> Check if flinch grants partner first action; base Speed 106 vs 189"
    },
    {
      "provider": 0,
      "member": 2,
      "opponent": 2,
      "kind": "Intimidate",
      "detail": "Incineroar Intimidate: Rotom-Wash vs Sneasler: Attack stage 0 -> -1: Trade -> Counter"
    },
    {
      "provider": 0,
      "member": 4,
      "opponent": 2,
      "kind": "Intimidate",
      "detail": "Incineroar Intimidate: Talonflame vs Sneasler: Attack stage 0 -> -1: Check -> Counter"
    },
    {
      "provider": 0,
      "member": 5,
      "opponent": 1,
      "kind": "Fake Out",
      "detail": "Incineroar Fake Out: Kingambit vs Venusaur: Trade -> Check if flinch grants partner first action; base Speed 70 vs 132"
    },
    {
      "provider": 4,
      "member": 0,
      "opponent": 1,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Incineroar vs Venusaur: Speed 80 vs 132: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 0,
      "opponent": 5,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Incineroar vs Dragonite: Speed 80 vs 100: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 1,
      "opponent": 2,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Garchomp vs Sneasler: Speed 169 vs 189: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 2,
      "opponent": 0,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Rotom-Wash vs Charizard-Mega-Y: Speed 106 vs 167: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 2,
      "opponent": 1,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Rotom-Wash vs Venusaur: Speed 106 vs 132: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 2,
      "opponent": 2,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Rotom-Wash vs Sneasler: Speed 106 vs 189: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 5,
      "opponent": 1,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Kingambit vs Venusaur: Speed 70 vs 132: slower -> faster, conditional on setup"
    },
    {
      "provider": 4,
      "member": 5,
      "opponent": 5,
      "kind": "Tailwind",
      "detail": "Talonflame Tailwind: Kingambit vs Dragonite: Speed 70 vs 100: slower -> faster, conditional on setup"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Incineroar vs Charizard-Mega-Y: Speed 80 vs 167; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 1,
      "kind": "myTailwind",
      "detail": "Incineroar vs Venusaur: Speed 80 vs 132; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Incineroar vs Venusaur: Speed 80 vs 132; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Incineroar vs Sneasler: Speed 80 vs 189; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 3,
      "kind": "theirTailwind",
      "detail": "Incineroar vs Hatterene: Speed 80 vs 44; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Incineroar vs Hatterene: Speed 80 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Incineroar vs Torkoal: Speed 80 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 5,
      "kind": "myTailwind",
      "detail": "Incineroar vs Dragonite: Speed 80 vs 100; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 0,
      "member": 0,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Incineroar vs Dragonite: Speed 80 vs 100; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 0,
      "kind": "theirTailwind",
      "detail": "Garchomp vs Charizard-Mega-Y: Speed 169 vs 167; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Garchomp vs Charizard-Mega-Y: Speed 169 vs 167; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 1,
      "kind": "theirTailwind",
      "detail": "Garchomp vs Venusaur: Speed 169 vs 132; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Garchomp vs Venusaur: Speed 169 vs 132; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 2,
      "kind": "myTailwind",
      "detail": "Garchomp vs Sneasler: Speed 169 vs 189; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Garchomp vs Sneasler: Speed 169 vs 189; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Garchomp vs Hatterene: Speed 169 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Garchomp vs Torkoal: Speed 169 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 5,
      "kind": "theirTailwind",
      "detail": "Garchomp vs Dragonite: Speed 169 vs 100; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 1,
      "member": 1,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Garchomp vs Dragonite: Speed 169 vs 100; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 0,
      "kind": "myTailwind",
      "detail": "Rotom-Wash vs Charizard-Mega-Y: Speed 106 vs 167; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Charizard-Mega-Y: Speed 106 vs 167; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 1,
      "kind": "myTailwind",
      "detail": "Rotom-Wash vs Venusaur: Speed 106 vs 132; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Venusaur: Speed 106 vs 132; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 2,
      "kind": "myTailwind",
      "detail": "Rotom-Wash vs Sneasler: Speed 106 vs 189; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Sneasler: Speed 106 vs 189; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Hatterene: Speed 106 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Torkoal: Speed 106 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 5,
      "kind": "theirTailwind",
      "detail": "Rotom-Wash vs Dragonite: Speed 106 vs 100; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 2,
      "member": 2,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Rotom-Wash vs Dragonite: Speed 106 vs 100; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 0,
      "kind": "theirTailwind",
      "detail": "Gardevoir vs Charizard-Mega-Y: Speed 217 vs 167; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Charizard-Mega-Y: Speed 217 vs 167; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 1,
      "kind": "theirTailwind",
      "detail": "Gardevoir vs Venusaur: Speed 217 vs 132; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Venusaur: Speed 217 vs 132; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 2,
      "kind": "theirTailwind",
      "detail": "Gardevoir vs Sneasler: Speed 217 vs 189; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Sneasler: Speed 217 vs 189; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Hatterene: Speed 217 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Torkoal: Speed 217 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 3,
      "member": 3,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Gardevoir vs Dragonite: Speed 217 vs 100; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 0,
      "kind": "theirTailwind",
      "detail": "Talonflame vs Charizard-Mega-Y: Speed 195 vs 167; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Talonflame vs Charizard-Mega-Y: Speed 195 vs 167; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 1,
      "kind": "theirTailwind",
      "detail": "Talonflame vs Venusaur: Speed 195 vs 132; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Talonflame vs Venusaur: Speed 195 vs 132; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 2,
      "kind": "theirTailwind",
      "detail": "Talonflame vs Sneasler: Speed 195 vs 189; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Talonflame vs Sneasler: Speed 195 vs 189; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Talonflame vs Hatterene: Speed 195 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Talonflame vs Torkoal: Speed 195 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 5,
      "kind": "theirTailwind",
      "detail": "Talonflame vs Dragonite: Speed 195 vs 100; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 4,
      "member": 4,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Talonflame vs Dragonite: Speed 195 vs 100; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 0,
      "kind": "trickRoom",
      "detail": "Kingambit vs Charizard-Mega-Y: Speed 70 vs 167; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 1,
      "kind": "myTailwind",
      "detail": "Kingambit vs Venusaur: Speed 70 vs 132; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 1,
      "kind": "trickRoom",
      "detail": "Kingambit vs Venusaur: Speed 70 vs 132; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 2,
      "kind": "trickRoom",
      "detail": "Kingambit vs Sneasler: Speed 70 vs 189; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 3,
      "kind": "theirTailwind",
      "detail": "Kingambit vs Hatterene: Speed 70 vs 44; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 3,
      "kind": "trickRoom",
      "detail": "Kingambit vs Hatterene: Speed 70 vs 44; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 4,
      "kind": "theirTailwind",
      "detail": "Kingambit vs Torkoal: Speed 70 vs 36; faster -> slower under theirTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 4,
      "kind": "trickRoom",
      "detail": "Kingambit vs Torkoal: Speed 70 vs 36; faster -> slower under trickRoom (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 5,
      "kind": "myTailwind",
      "detail": "Kingambit vs Dragonite: Speed 70 vs 100; slower -> faster under myTailwind (hypothetical field, not a support bonus)"
    },
    {
      "provider": 5,
      "member": 5,
      "opponent": 5,
      "kind": "trickRoom",
      "detail": "Kingambit vs Dragonite: Speed 70 vs 100; slower -> faster under trickRoom (hypothetical field, not a support bonus)"
    }
  ],
  "matrix": [
    [
      {
        "member": 0,
        "opponent": 0,
        "pokemon": "Incineroar",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Charizard-Mega-Y",
          "move": "Knock Off",
          "minPercent": 33.33,
          "maxPercent": 39.87,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Incineroar",
          "move": "Air Slash",
          "minPercent": 28.71,
          "maxPercent": 34.16,
          "knockOut": "1.3% chance to 3HKO",
          "hits": 3,
          "likelyKoHits": null,
          "chancePercent": 1.34,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 80,
          "threat": 167,
          "normal": "slower",
          "myTailwind": "slower",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Trade",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 0,
        "opponent": 1,
        "pokemon": "Incineroar",
        "target": "Venusaur",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Venusaur",
          "move": "Flare Blitz",
          "minPercent": 116.13,
          "maxPercent": 136.77,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Incineroar",
          "move": "Earth Power",
          "minPercent": 47.52,
          "maxPercent": 56.44,
          "knockOut": "82.8% chance to 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 82.81
        },
        "speed": {
          "member": 80,
          "threat": 132,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 0,
        "opponent": 2,
        "pokemon": "Incineroar",
        "target": "Sneasler",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Sneasler",
          "move": "Flare Blitz",
          "minPercent": 74.19,
          "maxPercent": 87.74,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Incineroar",
          "move": "Close Combat",
          "minPercent": 110.89,
          "maxPercent": 131.68,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 80,
          "threat": 189,
          "normal": "slower",
          "myTailwind": "slower",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 0,
        "opponent": 3,
        "pokemon": "Incineroar",
        "target": "Hatterene",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Hatterene",
          "move": "Flare Blitz",
          "minPercent": 48.17,
          "maxPercent": 57.32,
          "knockOut": "92.6% chance to 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 92.58
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Incineroar",
          "move": "Dazzling Gleam",
          "minPercent": 22.28,
          "maxPercent": 26.73,
          "knockOut": "15.2% chance to 4HKO",
          "hits": 4,
          "likelyKoHits": 5,
          "chancePercent": 15.17
        },
        "speed": {
          "member": 80,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Counter",
        "trickRoomVerdict": "Counter"
      },
      {
        "member": 0,
        "opponent": 4,
        "pokemon": "Incineroar",
        "target": "Torkoal",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Torkoal",
          "move": "Knock Off",
          "minPercent": 27.12,
          "maxPercent": 32.2,
          "knockOut": "guaranteed 4HKO",
          "hits": 4,
          "likelyKoHits": 4,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Incineroar",
          "move": "Earth Power",
          "minPercent": 33.66,
          "maxPercent": 39.6,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 80,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 0,
        "opponent": 5,
        "pokemon": "Incineroar",
        "target": "Dragonite",
        "deals": {
          "attacker": "Incineroar",
          "defender": "Dragonite",
          "move": "Knock Off",
          "minPercent": 16.67,
          "maxPercent": 19.7,
          "knockOut": "guaranteed 6HKO",
          "hits": 6,
          "likelyKoHits": 6,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Incineroar",
          "move": "Dragon Claw",
          "minPercent": 41.58,
          "maxPercent": 49.5,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "speed": {
          "member": 80,
          "threat": 100,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ],
    [
      {
        "member": 1,
        "opponent": 0,
        "pokemon": "Garchomp",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Charizard-Mega-Y",
          "move": "Rock Slide",
          "minPercent": 101.96,
          "maxPercent": 122.88,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Garchomp",
          "move": "Solar Beam",
          "minPercent": 49.73,
          "maxPercent": 59.02,
          "knockOut": "99.6% chance to 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 99.61,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 169,
          "threat": 167,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 1,
        "opponent": 1,
        "pokemon": "Garchomp",
        "target": "Venusaur",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Venusaur",
          "move": "Dragon Claw",
          "minPercent": 52.26,
          "maxPercent": 61.94,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Garchomp",
          "move": "Energy Ball",
          "minPercent": 57.38,
          "maxPercent": 68.31,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 169,
          "threat": 132,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 1,
        "opponent": 2,
        "pokemon": "Garchomp",
        "target": "Sneasler",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Sneasler",
          "move": "Earthquake",
          "minPercent": 123.87,
          "maxPercent": 147.1,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Garchomp",
          "move": "Close Combat",
          "minPercent": 59.02,
          "maxPercent": 69.4,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 169,
          "threat": 189,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 1,
        "opponent": 3,
        "pokemon": "Garchomp",
        "target": "Hatterene",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Hatterene",
          "move": "Earthquake",
          "minPercent": 40.85,
          "maxPercent": 48.17,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Garchomp",
          "move": "Dazzling Gleam",
          "minPercent": 73.22,
          "maxPercent": 86.34,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 169,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 1,
        "opponent": 4,
        "pokemon": "Garchomp",
        "target": "Torkoal",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Torkoal",
          "move": "Earthquake",
          "minPercent": 55.37,
          "maxPercent": 65.54,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Garchomp",
          "move": "Eruption",
          "minPercent": 44.26,
          "maxPercent": 52.46,
          "knockOut": "22.3% chance to 2HKO",
          "hits": 2,
          "likelyKoHits": null,
          "chancePercent": 22.27,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 169,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 1,
        "opponent": 5,
        "pokemon": "Garchomp",
        "target": "Dragonite",
        "deals": {
          "attacker": "Garchomp",
          "defender": "Dragonite",
          "move": "Dragon Claw",
          "minPercent": 36.36,
          "maxPercent": 42.93,
          "knockOut": "97.3% chance to 3HKO after Leftovers recovery",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 97.29
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Garchomp",
          "move": "Dragon Claw",
          "minPercent": 88.52,
          "maxPercent": 104.92,
          "knockOut": "25% chance to OHKO",
          "hits": 1,
          "likelyKoHits": 2,
          "chancePercent": 25
        },
        "speed": {
          "member": 169,
          "threat": 100,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ],
    [
      {
        "member": 2,
        "opponent": 0,
        "pokemon": "Rotom-Wash",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Charizard-Mega-Y",
          "move": "Hydro Pump",
          "minPercent": 103.27,
          "maxPercent": 122.88,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Rotom-Wash",
          "move": "Solar Beam",
          "minPercent": 95.54,
          "maxPercent": 113.38,
          "knockOut": "75% chance to OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 75,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 106,
          "threat": 167,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Trade",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 2,
        "opponent": 1,
        "pokemon": "Rotom-Wash",
        "target": "Venusaur",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Venusaur",
          "move": "Hydro Pump",
          "minPercent": 29.03,
          "maxPercent": 34.19,
          "knockOut": "2.1% chance to 3HKO",
          "hits": 3,
          "likelyKoHits": 4,
          "chancePercent": 2.1
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Rotom-Wash",
          "move": "Energy Ball",
          "minPercent": 110.83,
          "maxPercent": 134.39,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 106,
          "threat": 132,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 2,
        "opponent": 2,
        "pokemon": "Rotom-Wash",
        "target": "Sneasler",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Sneasler",
          "move": "Hydro Pump",
          "minPercent": 69.68,
          "maxPercent": 81.94,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Rotom-Wash",
          "move": "Close Combat",
          "minPercent": 61.78,
          "maxPercent": 73.25,
          "knockOut": "guaranteed 2HKO after Leftovers recovery",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 106,
          "threat": 189,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Trade",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 2,
        "opponent": 3,
        "pokemon": "Rotom-Wash",
        "target": "Hatterene",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Hatterene",
          "move": "Hydro Pump",
          "minPercent": 53.05,
          "maxPercent": 62.8,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Rotom-Wash",
          "move": "Psychic",
          "minPercent": 53.5,
          "maxPercent": 63.06,
          "knockOut": "guaranteed 2HKO after Leftovers recovery",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 106,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 2,
        "opponent": 4,
        "pokemon": "Rotom-Wash",
        "target": "Torkoal",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Torkoal",
          "move": "Hydro Pump",
          "minPercent": 133.33,
          "maxPercent": 159.32,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Rotom-Wash",
          "move": "Eruption",
          "minPercent": 42.68,
          "maxPercent": 50.32,
          "knockOut": "guaranteed 3HKO after Leftovers recovery",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 106,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 2,
        "opponent": 5,
        "pokemon": "Rotom-Wash",
        "target": "Dragonite",
        "deals": {
          "attacker": "Rotom-Wash",
          "defender": "Dragonite",
          "move": "Thunderbolt",
          "minPercent": 18.18,
          "maxPercent": 21.72,
          "knockOut": "possible 6HKO",
          "hits": 6,
          "likelyKoHits": null,
          "chancePercent": null
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Rotom-Wash",
          "move": "Dragon Claw",
          "minPercent": 46.5,
          "maxPercent": 55.41,
          "knockOut": "15.6% chance to 2HKO after Leftovers recovery",
          "hits": 2,
          "likelyKoHits": null,
          "chancePercent": 15.63
        },
        "speed": {
          "member": 106,
          "threat": 100,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ],
    [
      {
        "member": 3,
        "opponent": 0,
        "pokemon": "Gardevoir",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Charizard-Mega-Y",
          "move": "Thunderbolt",
          "minPercent": 58.82,
          "maxPercent": 69.28,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Gardevoir",
          "move": "Heat Wave",
          "minPercent": 65.73,
          "maxPercent": 78.32,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 217,
          "threat": 167,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 3,
        "opponent": 1,
        "pokemon": "Gardevoir",
        "target": "Venusaur",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Venusaur",
          "move": "Psychic",
          "minPercent": 98.06,
          "maxPercent": 116.13,
          "knockOut": "87.5% chance to OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 87.5
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Gardevoir",
          "move": "Sludge Bomb",
          "minPercent": 114.69,
          "maxPercent": 136.36,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 217,
          "threat": 132,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 3,
        "opponent": 2,
        "pokemon": "Gardevoir",
        "target": "Sneasler",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Sneasler",
          "move": "Psychic",
          "minPercent": 234.84,
          "maxPercent": 278.71,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Gardevoir",
          "move": "Dire Claw",
          "minPercent": 135.66,
          "maxPercent": 160.84,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 217,
          "threat": 189,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 3,
        "opponent": 3,
        "pokemon": "Gardevoir",
        "target": "Hatterene",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Hatterene",
          "move": "Shadow Ball",
          "minPercent": 53.66,
          "maxPercent": 63.41,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Gardevoir",
          "move": "Dazzling Gleam",
          "minPercent": 35.66,
          "maxPercent": 42.66,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "speed": {
          "member": 217,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Counter",
        "trickRoomVerdict": "Counter"
      },
      {
        "member": 3,
        "opponent": 4,
        "pokemon": "Gardevoir",
        "target": "Torkoal",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Torkoal",
          "move": "Psychic",
          "minPercent": 56.5,
          "maxPercent": 66.67,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Gardevoir",
          "move": "Eruption",
          "minPercent": 88.81,
          "maxPercent": 104.9,
          "knockOut": "31.3% chance to OHKO",
          "hits": 1,
          "likelyKoHits": null,
          "chancePercent": 31.25,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 217,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 3,
        "opponent": 5,
        "pokemon": "Gardevoir",
        "target": "Dragonite",
        "deals": {
          "attacker": "Gardevoir",
          "defender": "Dragonite",
          "move": "Moonblast",
          "minPercent": 39.9,
          "maxPercent": 47.47,
          "knockOut": "guaranteed 3HKO after Leftovers recovery",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Gardevoir",
          "move": "Iron Head",
          "minPercent": 102.1,
          "maxPercent": 120.28,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 217,
          "threat": 100,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ],
    [
      {
        "member": 4,
        "opponent": 0,
        "pokemon": "Talonflame",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Charizard-Mega-Y",
          "move": "Brave Bird",
          "minPercent": 60.78,
          "maxPercent": 71.24,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Talonflame",
          "move": "Air Slash",
          "minPercent": 66.67,
          "maxPercent": 78.43,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 195,
          "threat": 167,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 4,
        "opponent": 1,
        "pokemon": "Talonflame",
        "target": "Venusaur",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Venusaur",
          "move": "Brave Bird",
          "minPercent": 113.55,
          "maxPercent": 135.48,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Talonflame",
          "move": "Sludge Bomb",
          "minPercent": 81.7,
          "maxPercent": 96.73,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 195,
          "threat": 132,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 4,
        "opponent": 2,
        "pokemon": "Talonflame",
        "target": "Sneasler",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Sneasler",
          "move": "Brave Bird",
          "minPercent": 144.52,
          "maxPercent": 171.61,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Talonflame",
          "move": "Dire Claw",
          "minPercent": 59.48,
          "maxPercent": 70.59,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 195,
          "threat": 189,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 4,
        "opponent": 3,
        "pokemon": "Talonflame",
        "target": "Hatterene",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Hatterene",
          "move": "Brave Bird",
          "minPercent": 48.17,
          "maxPercent": 57.32,
          "knockOut": "92.6% chance to 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 92.58
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Talonflame",
          "move": "Psychic",
          "minPercent": 77.12,
          "maxPercent": 90.85,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 195,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Check",
        "trickRoomVerdict": "Trade"
      },
      {
        "member": 4,
        "opponent": 4,
        "pokemon": "Talonflame",
        "target": "Torkoal",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Torkoal",
          "move": "Brave Bird",
          "minPercent": 32.2,
          "maxPercent": 37.85,
          "knockOut": "93.2% chance to 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 93.16
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Talonflame",
          "move": "Eruption",
          "minPercent": 62.75,
          "maxPercent": 73.86,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 195,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "faster",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 4,
        "opponent": 5,
        "pokemon": "Talonflame",
        "target": "Dragonite",
        "deals": {
          "attacker": "Talonflame",
          "defender": "Dragonite",
          "move": "Brave Bird",
          "minPercent": 19.7,
          "maxPercent": 23.74,
          "knockOut": "possible 6HKO",
          "hits": 6,
          "likelyKoHits": null,
          "chancePercent": null
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Talonflame",
          "move": "Dragon Claw",
          "minPercent": 66.67,
          "maxPercent": 78.43,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 195,
          "threat": 100,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ],
    [
      {
        "member": 5,
        "opponent": 0,
        "pokemon": "Kingambit",
        "target": "Charizard-Mega-Y",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Charizard-Mega-Y",
          "move": "Kowtow Cleave",
          "minPercent": 78.43,
          "maxPercent": 92.81,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Charizard-Mega-Y",
          "defender": "Kingambit",
          "move": "Heat Wave",
          "minPercent": 116.91,
          "maxPercent": 139.13,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 70,
          "threat": 167,
          "normal": "slower",
          "myTailwind": "slower",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 5,
        "opponent": 1,
        "pokemon": "Kingambit",
        "target": "Venusaur",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Venusaur",
          "move": "Kowtow Cleave",
          "minPercent": 74.19,
          "maxPercent": 87.74,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Venusaur",
          "defender": "Kingambit",
          "move": "Earth Power",
          "minPercent": 67.63,
          "maxPercent": 80.19,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "speed": {
          "member": 70,
          "threat": 132,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Trade",
        "trickRoomVerdict": "Check"
      },
      {
        "member": 5,
        "opponent": 2,
        "pokemon": "Kingambit",
        "target": "Sneasler",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Sneasler",
          "move": "Iron Head",
          "minPercent": 75.48,
          "maxPercent": 89.03,
          "knockOut": "guaranteed 2HKO",
          "hits": 2,
          "likelyKoHits": 2,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Sneasler",
          "defender": "Kingambit",
          "move": "Close Combat",
          "minPercent": 170.05,
          "maxPercent": 202.9,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100
        },
        "speed": {
          "member": 70,
          "threat": 189,
          "normal": "slower",
          "myTailwind": "slower",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 5,
        "opponent": 3,
        "pokemon": "Kingambit",
        "target": "Hatterene",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Hatterene",
          "move": "Iron Head",
          "minPercent": 98.78,
          "maxPercent": 117.07,
          "knockOut": "93.8% chance to OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 93.75
        },
        "takes": {
          "attacker": "Hatterene",
          "defender": "Kingambit",
          "move": "Dazzling Gleam",
          "minPercent": 32.37,
          "maxPercent": 38.16,
          "knockOut": "96.3% chance to 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 96.29
        },
        "speed": {
          "member": 70,
          "threat": 44,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Counter",
        "trickRoomVerdict": "Counter"
      },
      {
        "member": 5,
        "opponent": 4,
        "pokemon": "Kingambit",
        "target": "Torkoal",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Torkoal",
          "move": "Kowtow Cleave",
          "minPercent": 42.37,
          "maxPercent": 49.72,
          "knockOut": "guaranteed 3HKO",
          "hits": 3,
          "likelyKoHits": 3,
          "chancePercent": 100
        },
        "takes": {
          "attacker": "Torkoal",
          "defender": "Kingambit",
          "move": "Eruption",
          "minPercent": 157.49,
          "maxPercent": 186.47,
          "knockOut": "guaranteed OHKO",
          "hits": 1,
          "likelyKoHits": 1,
          "chancePercent": 100,
          "conditions": "Sun weather"
        },
        "speed": {
          "member": 70,
          "threat": 36,
          "normal": "faster",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "slower"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      },
      {
        "member": 5,
        "opponent": 5,
        "pokemon": "Kingambit",
        "target": "Dragonite",
        "deals": {
          "attacker": "Kingambit",
          "defender": "Dragonite",
          "move": "Kowtow Cleave",
          "minPercent": 25.76,
          "maxPercent": 30.81,
          "knockOut": "6.3% chance to 4HKO after Leftovers recovery",
          "hits": 4,
          "likelyKoHits": null,
          "chancePercent": 6.27
        },
        "takes": {
          "attacker": "Dragonite",
          "defender": "Kingambit",
          "move": "Dragon Claw",
          "minPercent": 15.94,
          "maxPercent": 18.84,
          "knockOut": "possible 6HKO",
          "hits": 6,
          "likelyKoHits": 6,
          "chancePercent": null
        },
        "speed": {
          "member": 70,
          "threat": 100,
          "normal": "slower",
          "myTailwind": "faster",
          "theirTailwind": "slower",
          "trickRoom": "faster"
        },
        "verdict": "Loses",
        "trickRoomVerdict": "Loses"
      }
    ]
  ],
  "alternatives": [
    {
      "indices": [
        1,
        2,
        3,
        4
      ],
      "score": -62,
      "reasons": [
        {
          "kind": "coverage",
          "subject": "Dragonite",
          "detail": "rank 1, weight 6 × best answer value -6",
          "points": -36
        },
        {
          "kind": "sweeper",
          "subject": "Dragonite",
          "detail": "4/4 lose; -30 × (4-2)",
          "points": -60
        },
        {
          "kind": "coverage",
          "subject": "Torkoal",
          "detail": "rank 2, weight 5 × best answer value 2",
          "points": 10
        },
        {
          "kind": "coverage",
          "subject": "Sneasler",
          "detail": "rank 3, weight 4 × best answer value 2",
          "points": 8
        },
        {
          "kind": "coverage",
          "subject": "Charizard-Mega-Y",
          "detail": "rank 4, weight 3 × best answer value 2",
          "points": 6
        },
        {
          "kind": "coverage",
          "subject": "Venusaur",
          "detail": "rank 5, weight 2 × best answer value 2",
          "points": 4
        },
        {
          "kind": "coverage",
          "subject": "Hatterene",
          "detail": "rank 6, weight 1 × best answer value 4",
          "points": 4
        },
        {
          "kind": "speedControl",
          "subject": "Talonflame",
          "detail": "Talonflame Tailwind: Garchomp vs Sneasler: Speed 169 vs 189: slower -> faster, conditional on setup",
          "points": 2
        },
        {
          "kind": "member",
          "subject": "Garchomp",
          "points": 0,
          "detail": "slot 1: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Rotom-Wash",
          "points": 0,
          "detail": "slot 2: 0 Counters, 2 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Gardevoir",
          "points": 0,
          "detail": "slot 3: 1 Counters, 3 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Talonflame",
          "points": 0,
          "detail": "slot 4: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
        }
      ],
      "pokemon": [
        "Garchomp",
        "Rotom-Wash",
        "Gardevoir",
        "Talonflame"
      ]
    },
    {
      "indices": [
        1,
        2,
        4,
        5
      ],
      "score": -62,
      "reasons": [
        {
          "kind": "coverage",
          "subject": "Dragonite",
          "detail": "rank 1, weight 6 × best answer value -6",
          "points": -36
        },
        {
          "kind": "sweeper",
          "subject": "Dragonite",
          "detail": "4/4 lose; -30 × (4-2)",
          "points": -60
        },
        {
          "kind": "coverage",
          "subject": "Torkoal",
          "detail": "rank 2, weight 5 × best answer value 2",
          "points": 10
        },
        {
          "kind": "coverage",
          "subject": "Sneasler",
          "detail": "rank 3, weight 4 × best answer value 2",
          "points": 8
        },
        {
          "kind": "coverage",
          "subject": "Charizard-Mega-Y",
          "detail": "rank 4, weight 3 × best answer value 2",
          "points": 6
        },
        {
          "kind": "coverage",
          "subject": "Venusaur",
          "detail": "rank 5, weight 2 × best answer value 2",
          "points": 4
        },
        {
          "kind": "coverage",
          "subject": "Hatterene",
          "detail": "rank 6, weight 1 × best answer value 4",
          "points": 4
        },
        {
          "kind": "speedControl",
          "subject": "Talonflame",
          "detail": "Talonflame Tailwind: Garchomp vs Sneasler: Speed 169 vs 189: slower -> faster, conditional on setup",
          "points": 2
        },
        {
          "kind": "member",
          "subject": "Garchomp",
          "points": 0,
          "detail": "slot 1: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Rotom-Wash",
          "points": 0,
          "detail": "slot 2: 0 Counters, 2 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Talonflame",
          "points": 0,
          "detail": "slot 4: 0 Counters, 4 Checks; only selected answer to none; informational, already counted in coverage"
        },
        {
          "kind": "member",
          "subject": "Kingambit",
          "points": 0,
          "detail": "slot 5: 1 Counters, 0 Checks; only selected answer to none; informational, already counted in coverage"
        }
      ],
      "pokemon": [
        "Garchomp",
        "Rotom-Wash",
        "Talonflame",
        "Kingambit"
      ]
    }
  ],
  "assumptions": [
    "Bring: for each opponent, weight = 7 - threat rank (rank by Loses count, then outspeeds count); add weight × best answer (Counter=4, Check=2, otherwise=-6), subtract 30 × (losses-2) when it beats >=3 selected members. Add at most 2 total for beneficial speed control and 1 total for beneficial disruption. Lead: sum over the 2×2 cells [4 × (my likely OHKO - their pessimistic OHKO) + 2 × (my likely 2HKO - their pessimistic 2HKO) + Speed sign (+1/0/-1)], plus at most 1 for conditional Fake Out that improves a verdict. Maximise the minimum over all 15 opponent pairs. Ties use input order.",
    "Exactly six per side. Species and Item Clause are not checked; use validate_team. Slot indices are zero-based.",
    "Level 50, full HP, single attacks in doubles, no screens, switching, move priority, accuracy or partner support in the base matrix; not a battle simulation. Spread attacks receive the doubles reduction.",
    "Each attacker uses its own entry weather/terrain; Speed uses a plain field. Unsupported attacks are omitted; null means no calculated damaging option, not proof of immunity to every move.",
    "Shared find_counters verdicts: Counter takes strictly under 50% and likely KOs in <=2 uses; Check KOs first (fewer hits, or as many while moving first); Trade has equal counts or a potentially winning Speed tie; otherwise Loses. My KOs require >=50% probability; unproven incoming KOs use the earliest possible count. Display ranges never supply KO counts.",
    "Smogon does not publish doubles lead frequency: evaluate all 15 opposing lead pairs. Lead score counts pairwise OHKO and 2HKO opportunities, not coordinated targeting or a turn simulation.",
    "Support bonuses are conditional on successful setup, never guaranteed: Tailwind/Trick Room/one Speed drop must improve an order; Fake Out must improve a partner verdict if the target flinches; Intimidate must improve a partner verdict after its Attack drop. Bonuses are capped by category, not stacked. Opposing support, redirection, Protect, switching and setup reliability are not simulated.",
    "Base cost is at most 288 move calculations (36 pairs × four moves × two directions). Intimidate adds at most 288 cached calculations (both directions, since a lower Attack also weakens moves like Foul Play); subsets and leads never recalculate damage.",
    "Missing nature/stat points are filled independently from the usage spread, preserving supplied fields; missing usage falls back to resolveSet defaults. Usage components may not co-occur. Missing moves use the four most-used moves, including status moves."
  ],
  "team": [
    {
      "pokemon": "Incineroar",
      "nature": "Careful",
      "statPoints": {
        "hp": 32,
        "atk": 0,
        "def": 0,
        "spa": 0,
        "spd": 32,
        "spe": 0
      },
      "ability": "Intimidate",
      "item": "Sitrus Berry",
      "stats": {
        "hp": 202,
        "atk": 135,
        "def": 110,
        "spa": 90,
        "spd": 156,
        "spe": 80
      },
      "moves": [
        "Flare Blitz",
        "Knock Off",
        "Fake Out",
        "Parting Shot"
      ]
    },
    {
      "pokemon": "Garchomp",
      "nature": "Jolly",
      "statPoints": {
        "hp": 0,
        "atk": 32,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 32
      },
      "ability": "Rough Skin",
      "item": "Lum Berry",
      "stats": {
        "hp": 183,
        "atk": 182,
        "def": 115,
        "spa": 90,
        "spd": 105,
        "spe": 169
      },
      "moves": [
        "Earthquake",
        "Dragon Claw",
        "Rock Slide",
        "Protect"
      ]
    },
    {
      "pokemon": "Rotom-Wash",
      "nature": "Modest",
      "statPoints": {
        "hp": 32,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 0
      },
      "ability": "Levitate",
      "item": "Leftovers",
      "stats": {
        "hp": 157,
        "atk": 76,
        "def": 127,
        "spa": 172,
        "spd": 127,
        "spe": 106
      },
      "moves": [
        "Hydro Pump",
        "Thunderbolt",
        "Will-O-Wisp",
        "Protect"
      ]
    },
    {
      "pokemon": "Gardevoir",
      "nature": "Timid",
      "statPoints": {
        "hp": 0,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 32
      },
      "ability": "Trace",
      "item": "Choice Scarf",
      "stats": {
        "hp": 143,
        "atk": 76,
        "def": 85,
        "spa": 177,
        "spd": 135,
        "spe": 145
      },
      "moves": [
        "Moonblast",
        "Psychic",
        "Shadow Ball",
        "Thunderbolt"
      ]
    },
    {
      "pokemon": "Talonflame",
      "nature": "Jolly",
      "statPoints": {
        "hp": 0,
        "atk": 32,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 32
      },
      "ability": "Gale Wings",
      "item": "Focus Sash",
      "stats": {
        "hp": 153,
        "atk": 133,
        "def": 91,
        "spa": 84,
        "spd": 89,
        "spe": 195
      },
      "moves": [
        "Brave Bird",
        "Flare Blitz",
        "Tailwind",
        "Protect"
      ]
    },
    {
      "pokemon": "Kingambit",
      "nature": "Adamant",
      "statPoints": {
        "hp": 32,
        "atk": 32,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 0
      },
      "ability": "Defiant",
      "item": "Black Glasses",
      "stats": {
        "hp": 207,
        "atk": 205,
        "def": 140,
        "spa": 72,
        "spd": 105,
        "spe": 70
      },
      "moves": [
        "Kowtow Cleave",
        "Iron Head",
        "Sucker Punch",
        "Protect"
      ]
    }
  ],
  "opponent": [
    {
      "pokemon": "Charizard-Mega-Y",
      "nature": "Timid",
      "statPoints": {
        "hp": 0,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 32
      },
      "ability": "Drought",
      "item": "Charizardite Y",
      "stats": {
        "hp": 153,
        "atk": 111,
        "def": 98,
        "spa": 211,
        "spd": 135,
        "spe": 167
      },
      "moves": [
        "Heat Wave",
        "Solar Beam",
        "Air Slash",
        "Protect"
      ]
    },
    {
      "pokemon": "Venusaur",
      "nature": "Modest",
      "statPoints": {
        "hp": 0,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 32
      },
      "ability": "Chlorophyll",
      "item": "Life Orb",
      "stats": {
        "hp": 155,
        "atk": 91,
        "def": 103,
        "spa": 167,
        "spd": 120,
        "spe": 132
      },
      "moves": [
        "Sludge Bomb",
        "Energy Ball",
        "Earth Power",
        "Protect"
      ]
    },
    {
      "pokemon": "Sneasler",
      "nature": "Jolly",
      "statPoints": {
        "hp": 0,
        "atk": 32,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 32
      },
      "ability": "Unburden",
      "item": "White Herb",
      "stats": {
        "hp": 155,
        "atk": 182,
        "def": 80,
        "spa": 54,
        "spd": 100,
        "spe": 189
      },
      "moves": [
        "Close Combat",
        "Dire Claw",
        "Fake Out",
        "Protect"
      ]
    },
    {
      "pokemon": "Hatterene",
      "nature": "Quiet",
      "statPoints": {
        "hp": 32,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 0
      },
      "ability": "Magic Bounce",
      "item": "Mental Herb",
      "stats": {
        "hp": 164,
        "atk": 110,
        "def": 115,
        "spa": 206,
        "spd": 123,
        "spe": 44
      },
      "moves": [
        "Dazzling Gleam",
        "Psychic",
        "Trick Room",
        "Protect"
      ]
    },
    {
      "pokemon": "Torkoal",
      "nature": "Quiet",
      "statPoints": {
        "hp": 32,
        "atk": 0,
        "def": 0,
        "spa": 32,
        "spd": 0,
        "spe": 0
      },
      "ability": "Drought",
      "item": "Charcoal",
      "stats": {
        "hp": 177,
        "atk": 105,
        "def": 160,
        "spa": 150,
        "spd": 90,
        "spe": 36
      },
      "moves": [
        "Eruption",
        "Heat Wave",
        "Earth Power",
        "Protect"
      ]
    },
    {
      "pokemon": "Dragonite",
      "nature": "Adamant",
      "statPoints": {
        "hp": 32,
        "atk": 32,
        "def": 0,
        "spa": 0,
        "spd": 0,
        "spe": 0
      },
      "ability": "Multiscale",
      "item": "Leftovers",
      "stats": {
        "hp": 198,
        "atk": 204,
        "def": 115,
        "spa": 108,
        "spd": 120,
        "spe": 100
      },
      "moves": [
        "Extreme Speed",
        "Dragon Claw",
        "Iron Head",
        "Protect"
      ]
    }
  ]
};
