/** A real analyze_team_types result, for the preview page and tests. */
import type { TypeChartData } from "./types.js";

export const TYPE_CHART_FIXTURE: TypeChartData = {
  "team": [
    {
      "name": "Incineroar",
      "types": [
        "Fire",
        "Dark"
      ]
    },
    {
      "name": "Kingambit",
      "types": [
        "Dark",
        "Steel"
      ]
    },
    {
      "name": "Sinistcha",
      "types": [
        "Grass",
        "Ghost"
      ]
    },
    {
      "name": "Garchomp",
      "types": [
        "Dragon",
        "Ground"
      ]
    },
    {
      "name": "Whimsicott",
      "types": [
        "Grass",
        "Fairy"
      ]
    },
    {
      "name": "Charizard-Mega-Y",
      "types": [
        "Fire",
        "Flying"
      ]
    }
  ],
  "notFound": [
    "Notamon"
  ],
  "matchups": [
    {
      "type": "Bug",
      "weak": [],
      "resist": [
        "Charizard-Mega-Y"
      ],
      "immune": []
    },
    {
      "type": "Dark",
      "weak": [
        "Sinistcha"
      ],
      "resist": [
        "Incineroar",
        "Kingambit",
        "Whimsicott"
      ],
      "immune": []
    },
    {
      "type": "Dragon",
      "weak": [
        "Garchomp"
      ],
      "resist": [
        "Kingambit"
      ],
      "immune": [
        "Whimsicott"
      ]
    },
    {
      "type": "Electric",
      "weak": [
        "Charizard-Mega-Y"
      ],
      "resist": [
        "Sinistcha",
        "Whimsicott"
      ],
      "immune": [
        "Garchomp"
      ]
    },
    {
      "type": "Fairy",
      "weak": [
        "Garchomp"
      ],
      "resist": [
        "Charizard-Mega-Y"
      ],
      "immune": []
    },
    {
      "type": "Fighting",
      "weak": [
        "Incineroar",
        "Kingambit"
      ],
      "resist": [
        "Whimsicott",
        "Charizard-Mega-Y"
      ],
      "immune": [
        "Sinistcha"
      ]
    },
    {
      "type": "Fire",
      "weak": [
        "Kingambit",
        "Sinistcha",
        "Whimsicott"
      ],
      "resist": [
        "Incineroar",
        "Garchomp",
        "Charizard-Mega-Y"
      ],
      "immune": []
    },
    {
      "type": "Flying",
      "weak": [
        "Sinistcha",
        "Whimsicott"
      ],
      "resist": [
        "Kingambit"
      ],
      "immune": []
    },
    {
      "type": "Ghost",
      "weak": [
        "Sinistcha"
      ],
      "resist": [
        "Incineroar",
        "Kingambit"
      ],
      "immune": []
    },
    {
      "type": "Grass",
      "weak": [],
      "resist": [
        "Incineroar",
        "Kingambit",
        "Sinistcha",
        "Whimsicott",
        "Charizard-Mega-Y"
      ],
      "immune": []
    },
    {
      "type": "Ground",
      "weak": [
        "Incineroar",
        "Kingambit"
      ],
      "resist": [
        "Sinistcha",
        "Whimsicott"
      ],
      "immune": [
        "Charizard-Mega-Y"
      ]
    },
    {
      "type": "Ice",
      "weak": [
        "Sinistcha",
        "Garchomp",
        "Whimsicott"
      ],
      "resist": [
        "Incineroar",
        "Kingambit"
      ],
      "immune": []
    },
    {
      "type": "Normal",
      "weak": [],
      "resist": [
        "Kingambit"
      ],
      "immune": [
        "Sinistcha"
      ]
    },
    {
      "type": "Poison",
      "weak": [
        "Whimsicott"
      ],
      "resist": [
        "Garchomp"
      ],
      "immune": [
        "Kingambit"
      ]
    },
    {
      "type": "Psychic",
      "weak": [],
      "resist": [],
      "immune": [
        "Incineroar",
        "Kingambit"
      ]
    },
    {
      "type": "Rock",
      "weak": [
        "Incineroar",
        "Charizard-Mega-Y"
      ],
      "resist": [
        "Kingambit",
        "Garchomp"
      ],
      "immune": []
    },
    {
      "type": "Steel",
      "weak": [
        "Whimsicott"
      ],
      "resist": [
        "Incineroar",
        "Kingambit",
        "Charizard-Mega-Y"
      ],
      "immune": []
    },
    {
      "type": "Water",
      "weak": [
        "Incineroar",
        "Charizard-Mega-Y"
      ],
      "resist": [
        "Sinistcha",
        "Whimsicott"
      ],
      "immune": []
    }
  ],
  "sharedWeaknesses": [
    "Fire",
    "Ice",
    "Fighting",
    "Flying",
    "Ground",
    "Rock",
    "Water"
  ],
  "unresisted": [],
  "suggestedTypes": [
    {
      "type": "Steel",
      "covers": [
        "Ice",
        "Flying",
        "Rock"
      ]
    },
    {
      "type": "Water",
      "covers": [
        "Fire",
        "Ice",
        "Water"
      ]
    },
    {
      "type": "Bug",
      "covers": [
        "Fighting",
        "Ground"
      ]
    },
    {
      "type": "Dragon",
      "covers": [
        "Fire",
        "Water"
      ]
    },
    {
      "type": "Fire",
      "covers": [
        "Fire",
        "Ice"
      ]
    }
  ]
}
;
