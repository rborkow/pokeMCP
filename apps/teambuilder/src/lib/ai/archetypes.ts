/**
 * Team archetypes for guided team generation
 */

export type FormatType = "singles" | "doubles" | "both";

export interface TeamArchetype {
    id: string;
    name: string;
    description: string;
    icon: string; // emoji for display
    prompt: string;
    keyFeatures: string[];
    formats: FormatType; // Which formats this archetype works in
}

// Singles-focused archetypes
const SINGLES_ARCHETYPES: TeamArchetype[] = [
    {
        id: "hyper-offense",
        name: "Hyper Offense",
        description:
            "Fast, aggressive teams that aim to overwhelm opponents before they can set up",
        icon: "⚡",
        formats: "singles",
        prompt: `Build a Hyper Offense team for SINGLES. This archetype focuses on:
- A suicide lead that sets hazards (Stealth Rock, Spikes) and possibly screens
- Multiple fast, hard-hitting sweepers with high Attack/Special Attack and Speed
- Setup sweepers (Swords Dance, Dragon Dance, Nasty Plot users)
- Prioritize offensive pressure over defensive pivoting
- Include priority moves (Extreme Speed, Sucker Punch, Ice Shard) to pick off weakened threats
- Minimal defensive investment - every Pokemon should threaten KOs

The win condition is overwhelming the opponent with continuous offensive pressure, not trading blows.`,
        keyFeatures: ["Hazard lead", "Setup sweepers", "Priority moves", "High speed"],
    },
    {
        id: "bulky-offense",
        name: "Bulky Offense",
        description: "Balanced attackers with natural bulk that can take hits while dealing damage",
        icon: "🛡️",
        formats: "singles",
        prompt: `Build a Bulky Offense team for SINGLES. This archetype focuses on:
- Pokemon with naturally high stats that don't need full offensive investment
- Pivot moves (U-turn, Volt Switch, Flip Turn) to maintain momentum
- At least one reliable defensive backbone that can check common threats
- Hazard control (setter + removal)
- A mix of physical and special attackers for coverage
- Pokemon that can take a hit and hit back hard

The win condition is using superior bulk to outlast offensive teams while maintaining enough firepower to break through defensive cores.`,
        keyFeatures: ["Pivots", "Natural bulk", "Hazard control", "Balanced coverage"],
    },
    {
        id: "balance",
        name: "Balance",
        description: "Well-rounded teams with answers to most threats and multiple win conditions",
        icon: "⚖️",
        formats: "singles",
        prompt: `Build a Balance team for SINGLES. This archetype focuses on:
- A solid defensive core (2-3 Pokemon) that covers each other's weaknesses
- At least one reliable win condition (setup sweeper or wallbreaker)
- Hazard setter AND hazard removal
- Status absorbers or clerics
- Mixed offensive presence (physical + special)
- Good type synergy and defensive pivoting

The win condition is playing the long game - removing threats one by one, keeping hazards up, and eventually sweeping with your preserved win condition.`,
        keyFeatures: ["Defensive core", "Hazards both ways", "Status control", "Long game"],
    },
    {
        id: "stall",
        name: "Stall",
        description: "Defensive teams that win through residual damage and PP stalling",
        icon: "🧱",
        formats: "singles",
        prompt: `Build a Stall team for SINGLES. This archetype focuses on:
- Multiple defensive walls covering physical and special attacks
- Reliable recovery on most Pokemon (Recover, Roost, Wish, Regenerator)
- Hazard stacking (Stealth Rock + Spikes + Toxic Spikes ideally)
- Status spreading (Toxic, Will-O-Wisp, Thunder Wave)
- A phazer or two (Roar, Whirlwind, Dragon Tail) to rack up hazard damage
- Cleric support (Heal Bell, Aromatherapy) if possible

The win condition is NOT attacking - it's wearing down the opponent through:
1. Entry hazard damage from repeated switches
2. Poison/burn residual damage
3. Eventually PP stalling their answers

Include a way to handle common wallbreakers and setup sweepers in your metagame.`,
        keyFeatures: ["Recovery", "Hazard stack", "Status spread", "Phazing"],
    },
];

// Doubles/VGC-focused archetypes
const DOUBLES_ARCHETYPES: TeamArchetype[] = [
    {
        id: "goodstuffs",
        name: "Goodstuffs",
        description: "The best individual Pokemon that work well together without a gimmick",
        icon: "⭐",
        formats: "doubles",
        prompt: `Build a Goodstuffs team for VGC/DOUBLES. This archetype focuses on:
- Picking the strongest, most versatile Pokemon in the format
- No reliance on specific combos or weather - each Pokemon is independently strong
- Strong spread moves (Earthquake, Rock Slide, Heat Wave, Dazzling Gleam)
- Mix of offensive threats and support Pokemon
- Good speed tiers that can outspeed common threats
- Protect on most Pokemon for scouting and blocking

Key elements:
- 2-3 strong offensive threats with complementary coverage
- 1-2 support Pokemon (Intimidate, Follow Me, Tailwind)
- Flexible team preview options - no auto-loss matchups

The win condition is outplaying the opponent with superior individual Pokemon quality and flexibility.`,
        keyFeatures: ["Top threats", "Spread moves", "Protect", "Flexible leads"],
    },
    {
        id: "trick-room-doubles",
        name: "Trick Room",
        description: "Slow, powerful Pokemon that dominate under reversed speed",
        icon: "🔮",
        formats: "doubles",
        prompt: `Build a Trick Room team for VGC/DOUBLES. This archetype focuses on:
- 2 reliable Trick Room setters (you NEED backup in Doubles)
- Multiple slow, powerful attackers with MINIMUM Speed (0 IVs, negative nature)
- Pokemon with base Speed under 50 are ideal
- Strong spread moves that hit both opponents
- Consider Fake Out support to guarantee TR setup
- Mental Herb or redirection (Follow Me) to protect setters

Key Pokemon traits:
- 0 Speed IVs on ALL TR attackers
- Brave (physical) or Quiet (special) natures for attackers
- Bulky setters like Porygon2, Dusclops, Hatterene

IMPORTANT FOR DOUBLES:
- Protect is essential on slow attackers
- Consider Wide Guard for spread move protection
- Have 1-2 Pokemon that work outside of TR as backup

The win condition is setting Trick Room and overwhelming with powerful slow attackers before TR ends.`,
        keyFeatures: ["Dual TR setters", "0 Speed IVs", "Fake Out", "Spread moves"],
    },
    {
        id: "tailwind",
        name: "Tailwind",
        description: "Fast teams that use Tailwind for speed control and offensive pressure",
        icon: "💨",
        formats: "doubles",
        prompt: `Build a Tailwind team for VGC/DOUBLES. This archetype focuses on:
- 1-2 reliable Tailwind setters (Whimsicott, Tornadus, Talonflame, Murkrow)
- Fast attackers that become blazing fast under Tailwind
- Priority Tailwind (Prankster) is valuable but not required
- Strong offensive threats that can sweep under Tailwind
- Consider Fake Out to protect Tailwind setup

Team composition:
- Lead with Tailwind setter + offensive threat or Fake Out user
- Include Pokemon at different speed tiers to optimize Tailwind usage
- Have a backup plan if Tailwind is prevented (priority moves, naturally fast mons)

IMPORTANT FOR DOUBLES:
- Protect to stall Trick Room turns if opponent sets it
- Consider speed control counterplay (your own TR setter as option)
- Spread moves to pressure both opponents

The win condition is setting Tailwind and sweeping with doubled speed before it expires.`,
        keyFeatures: ["Tailwind setter", "Fast attackers", "Prankster", "4-turn window"],
    },
    {
        id: "sun-doubles",
        name: "Sun",
        description: "Drought-based teams with Chlorophyll sweepers and boosted Fire moves",
        icon: "☀️",
        formats: "doubles",
        prompt: `Build a Sun team for VGC/DOUBLES. This archetype focuses on:
- Drought setter (Torkoal is most common, Koraidon if legal)
- Chlorophyll sweepers that outspeed under Sun (Venusaur, Lilligant)
- Fire-types with boosted STAB (1.5x Fire moves in Sun)
- Consider Helping Hand to boost damage further

Key synergies:
- Torkoal + Venusaur is the classic core
- Sleep Powder under Sun (Chlorophyll + fast)
- Eruption in Sun is devastating

Team building tips:
- 1-2 Pokemon that work independently of Sun
- Answers to opposing weather (Rock Slide for Rain setters)
- Protect on most Pokemon

IMPORTANT FOR DOUBLES:
- Watch for Rain teams that can override your weather
- Flash Fire Pokemon can absorb opposing Fire moves
- Consider Wide Guard for Earthquake/Rock Slide

The win condition is maintaining Sun and sweeping with boosted Chlorophyll users and Fire-types.`,
        keyFeatures: ["Drought", "Chlorophyll", "Eruption", "Sleep Powder"],
    },
    {
        id: "rain-doubles",
        name: "Rain",
        description: "Drizzle-based teams with Swift Swim sweepers and 100% accurate Thunder",
        icon: "🌧️",
        formats: "doubles",
        prompt: `Build a Rain team for VGC/DOUBLES. This archetype focuses on:
- Drizzle setter (Pelipper, Politoed, Kyogre if legal)
- Swift Swim sweepers that outspeed everything in Rain
- Water-types with boosted STAB (1.5x Water moves in Rain)
- Thunder users (100% accuracy in Rain, hits both foes with Discharge)

Key synergies:
- Pelipper + Swift Swim attacker is the core
- Hurricane becomes 100% accurate in Rain
- Water Spout in Rain is extremely powerful

Team building tips:
- Mix of Swift Swim and naturally fast Pokemon
- Grass-types wall your Water moves - have coverage
- Consider Helping Hand for extra damage

IMPORTANT FOR DOUBLES:
- Weather wars are common - have backup plans
- Lightning Rod can redirect Electric moves from your Water-types
- Wide Guard blocks spread Water moves from opponents

The win condition is maintaining Rain and overwhelming with Swift Swim speed + boosted Water damage.`,
        keyFeatures: ["Drizzle", "Swift Swim", "Thunder", "Water Spout"],
    },
    {
        id: "sand-doubles",
        name: "Sand",
        description: "Sandstorm teams with Sand Rush sweepers and specially defensive boost",
        icon: "🏜️",
        formats: "doubles",
        prompt: `Build a Sand team for VGC/DOUBLES. This archetype focuses on:
- Sand Stream setter (Tyranitar, Hippowdon, Gigalith)
- Sand Rush sweepers (Excadrill is the premier choice)
- Rock/Ground/Steel types immune to Sand damage
- 1.5x Special Defense boost for Rock-types in Sand

Key synergies:
- Tyranitar + Excadrill is the classic core
- High Horsepower/Earthquake with partner protection
- Assault Vest + Sand SpDef boost makes Rock-types very bulky

Team building tips:
- Steel-types are immune to Sand and resist many types
- Have answers to Fighting and Ground (common Sand weaknesses)
- Excadrill can use Protect while partner sets up

IMPORTANT FOR DOUBLES:
- Be careful with Earthquake - don't hit your partner
- Consider partner immunities (Levitate, Flying, Air Balloon)
- Wide Guard blocks opposing Earthquakes

The win condition is maintaining Sand for chip damage + Sand Rush speed while tanking special hits.`,
        keyFeatures: ["Sand Stream", "Sand Rush", "SpDef boost", "Ground immunity"],
    },
];

// Goblin Mode - Wolfe Glick-inspired creative/unorthodox teams
const GOBLIN_MODE: TeamArchetype = {
    id: "goblin-mode",
    name: "Goblin Mode",
    description: "Unorthodox, creative teams that catch opponents off-guard with unexpected tech",
    icon: "🎨", // Smeargle energy - anything goes
    formats: "both",
    prompt: `Build a GOBLIN MODE team - an unorthodox, creative team inspired by Wolfe Glick's World Championship-winning teams that use unexpected strategies and tech choices.

Goblin Mode principles:
- USE POKEMON THAT AREN'T COMMON IN THE META but have untapped potential
- UNEXPECTED MOVE CHOICES - moves people won't see coming (Ally Switch, Instruct, After You, Role Play, Skill Swap)
- SURPRISE ITEM CHOICES - Eject Button, Room Service, Eject Pack, Adrenaline Orb
- ABILITY MIND GAMES - Intimidate switches, Defiant/Competitive punishes, Prankster nonsense
- UNORTHODOX EV SPREADS - Speed creep, survival benchmarks, weird offensive investments
- ANTI-META PICKS - specifically counter what's popular with uncommon answers

Creative tech to consider:
- Smeargle (can learn ANY move - Transform, Spore, Fake Out, Dark Void, etc.)
- Ditto (transforms into opponent's biggest threat)
- Zoroark (Illusion mindgames)
- Indeedee or Oranguru (Psychic Terrain + Instruct/Expanding Force)
- Shedinja (Wonder Guard vs unprepared teams)
- Assist/Copycat shenanigans
- Beat Up + Justified combos
- Rage Powder + redirection bait
- Perish Song trap teams
- Self-Swagger with Own Tempo/Contrary

The goal is to make your opponent think "WHAT?!" every turn. Win by confusion and superior preparation for your own weird strategy.

DO NOT just pick standard meta Pokemon with standard sets. The whole point is catching people off-guard with creativity and deep game knowledge.`,
    keyFeatures: ["Surprise tech", "Anti-meta", "Mind games", "Uncommon picks"],
};

// Weather archetype for Singles (different considerations)
const WEATHER_SINGLES: TeamArchetype = {
    id: "weather-singles",
    name: "Weather",
    description: "Teams built around Sun, Rain, Sand, or Snow to boost specific attackers",
    icon: "🌦️",
    formats: "singles",
    prompt: `Build a Weather team for SINGLES. Choose ONE weather and commit to it:

For Sun: Drought setter + Chlorophyll sweepers + Fire-types that abuse sun
For Rain: Drizzle setter + Swift Swim sweepers + Water-types + Thunder users
For Sand: Sand Stream setter + Sand Rush sweepers + Rock/Ground/Steel immunities
For Snow: Snow Warning setter + Slush Rush or Aurora Veil support

Include:
- Primary weather setter (ability preferred over manual move)
- 2-3 Pokemon that directly abuse the weather ability
- 1-2 Pokemon that function independently if weather is removed
- Consider a backup weather setter

Key Singles considerations:
- Entry hazards matter more - include Stealth Rock
- Pivoting with U-turn/Volt Switch maintains weather momentum
- Individual Pokemon need to handle more threats (no partner support)

The win condition is establishing weather and sweeping with speed-boosted or power-boosted attackers.`,
    keyFeatures: ["Weather setter", "Speed/Power boost", "Independent backup", "Hazards"],
};

// Combine all archetypes
export const TEAM_ARCHETYPES: TeamArchetype[] = [
    ...SINGLES_ARCHETYPES.slice(0, 2), // Hyper Offense, Bulky Offense
    ...DOUBLES_ARCHETYPES.slice(0, 2), // Goodstuffs, Trick Room
    WEATHER_SINGLES,
    DOUBLES_ARCHETYPES[2], // Tailwind
    GOBLIN_MODE, // Wolfe-style creative teams
    ...SINGLES_ARCHETYPES.slice(2), // Balance, Stall
    ...DOUBLES_ARCHETYPES.slice(3), // Sun, Rain, Sand
];

/**
 * Check if format is a doubles format
 */
export function isDoublesFormat(format: string): boolean {
    const doublesFormats = ["vgc", "doubles", "battlestadium", "bsd", "bss"];
    const lowerFormat = format.toLowerCase();
    return doublesFormats.some((f) => lowerFormat.includes(f));
}

/**
 * Get archetypes filtered by format
 */
export function getArchetypesForFormat(format: string): TeamArchetype[] {
    const isDoubles = isDoublesFormat(format);
    return TEAM_ARCHETYPES.filter(
        (a) =>
            a.formats === "both" ||
            (isDoubles && a.formats === "doubles") ||
            (!isDoubles && a.formats === "singles"),
    );
}

export function getArchetype(id: string): TeamArchetype | undefined {
    return TEAM_ARCHETYPES.find((a) => a.id === id);
}

export function getArchetypePrompt(id: string, format: string): string {
    const archetype = getArchetype(id);
    const isDoubles = isDoublesFormat(format);
    const teamSize = isDoubles ? 6 : 6; // VGC brings 6, picks 4

    if (!archetype) {
        return `Build me a competitive ${teamSize} Pokemon team for ${format.toUpperCase()}. ${
            isDoubles
                ? "This is a DOUBLES format - include Protect on most Pokemon, use spread moves, and consider speed control options."
                : "This is a SINGLES format - include entry hazards, pivot moves, and reliable recovery where appropriate."
        }`;
    }

    const formatNote = isDoubles
        ? `\n\nDOUBLES FORMAT REQUIREMENTS:
- Most Pokemon should have Protect
- Include spread moves (Earthquake, Rock Slide, Heat Wave, etc.)
- Speed control is essential (Tailwind, Trick Room, Icy Wind, Electroweb)
- Consider redirection (Follow Me, Rage Powder) or Fake Out support
- Team preview matters - have flexible lead combinations`
        : `\n\nSINGLES FORMAT REQUIREMENTS:
- Include entry hazards (Stealth Rock at minimum)
- Have hazard removal (Defog, Rapid Spin, or Magic Bounce)
- Pivot moves (U-turn, Volt Switch, Flip Turn) are valuable
- Recovery moves are important for longevity
- Consider status moves (Toxic, Will-O-Wisp, Thunder Wave)`;

    return `${archetype.prompt}${formatNote}

Build a complete ${teamSize} Pokemon team for ${format.toUpperCase()}. For EACH Pokemon, provide the full competitive set using the modify_team tool with:
- Optimal moves from the meta (4 moves each)
- Competitive ability
- Held item
- Nature that complements the set
- Full EV spread (508-510 total)
- Tera type that provides defensive or offensive utility

Before building, briefly explain your team's strategy and how the Pokemon work together.`;
}
