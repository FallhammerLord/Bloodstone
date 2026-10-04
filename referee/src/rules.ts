// Every number the Referee uses lives here. Each one is a dial.
// [Doc]      settled in dragon-duel-design.md
// [Proposed] marked [Proposed] in the design doc
// [Assumed]  placeholder chosen for this build; the numbers pass should replace it

// ---- Time ----
export const TICKS_PER_SLOT = 30; // [Doc] §4 Timeline: 30 ticks of 100 ms
export const SLOTS_PER_EXCHANGE = 3; // [Doc] §4 Exchange
export const EXCHANGE_LIMIT = 8; // [Assumed] the doc estimates six to eight; the last three get rim pulses
export const MIN_ACTIVE = 3; // [Proposed] the active window never drops below 3 ticks
export const HALF = 15; // [Doc] a crunch half runs 15 ticks
export const CHARGE_BONUS = 3; // [Assumed] a charged Bite or Breath hits for +3

// ---- Space ----
// Positions are whole numbers in a fine grain so all math stays in integers.
export const PACE = 300; // internal units per pace
export const NOTCH = PACE / 3; // ⅓ pace: one point of Accuracy's phantom band [Doc] §4 Hits
export const BAND = 3 * PACE; // [Doc] each range band is 3 paces deep
export const MELEE_EDGE = BAND;
export const CLOSE_EDGE = 2 * BAND;
export const FAR_EDGE = 3 * BAND;
export const LEASH = 4 * BAND; // [Doc] separation can't exceed Very Far's outer edge (12 paces)
export const ARENA_RADIUS = 12 * PACE; // [Doc] §5 radius equals the leash
export const BODY_GAP = 1 * PACE; // [Assumed] closest two dragon centers can get
export const RIM_DEPTH = 3 * PACE; // [Assumed] how far in from the wall the pillars' pulse reaches
export const MAX_ALTITUDE = 3 * BAND; // [Assumed] arena ceiling: 9 paces
export const BODY_RADIUS = BODY_GAP / 2; // [Assumed] for collisions with obstacles

// ---- Obstacles ---- [Doc] §5: four unbreakable pillars at the quadrants; obstacles have 3, 6 or 9 Wounds by size
export const PILLAR_RING = ARENA_RADIUS - Math.floor(1.5 * PACE); // [Assumed] pillars stand just inside the rim
export const PILLAR_RADIUS = PACE; // [Assumed]
export const PILLAR_HEIGHT = 1_000_000; // unbreakable and too tall to fly over
export const BOULDERS = {
  small: { radius: PACE / 2, height: PACE, wounds: 3 }, // radius and height [Assumed]
  medium: { radius: PACE, height: 2 * PACE, wounds: 6 },
  large: { radius: Math.floor(1.5 * PACE), height: 3 * PACE, wounds: 9 },
};
export const BOULDER_CLEARANCE = 2 * PACE; // [Assumed] random boulders keep this far from starting spots
export const START_SEPARATION = Math.floor(6.5 * PACE); // [Doc] Far, just outside Bite range

// ---- Movement ----
export const MOVE_CAP = BAND; // [Proposed] a move carries at most one band
export const EVASION_STEP = NOTCH; // [Assumed] each point of Evasion moves ⅓ pace (Evasion 9 = one band)

// ---- Damage ---- [Doc] §4 Damage, Modifiers
export const INTIMIDATE_BONUS = 3;
export const CHAIN_THIRD_LINK_BONUS = 3;
export const PUNISH_BONUS = 3; // Acumen scaling of punishes not modeled yet
export const GRAZE_PENALTY = 3;
export const MATCHUP = 3;
export const DAMAGE_FLOOR = 1;
export const STOMP_DAMAGE = 3;
export const BITE_PIERCE = 3; // [Doc] Bite is piercing; [Assumed] it ignores 3 Hardness
export const TRUE_DRAGON_WOUNDS = 9; // the True Dragon's Aspect: a flat +9 Wounds (3 Wounds)

// ---- Guards ----
export const SCALES_HARDNESS = 3; // [Assumed] Hardness bonus while guarding with Scales
export const SCALES_AFFINITY = 3; // [Assumed] Affinity bonus while guarding with Scales: presenting the hide to the elements
export const DODGE_BONUS = 3; // [Assumed] Evasion bonus while dodging

// ---- Acumen ---- [Proposed] §4 Acumen meter
export const ACUMEN_START = 10; // [Assumed] starting Acumen for every hatchling
export const NEAR_MISS_STEP = 10;
export const METER_MAX = 100;

// ---- Statuses ---- [Doc] §4 Statuses
export const RATTLED_WINDUP = 3;
export const BLINDED_ACCURACY = 3;

// ---- Breath damage by element ---- [Assumed]: harmless extras earn points, harmful extras cost them
export const ELEMENT_BREATH_MOD = { water: 2, air: 2, earth: 1, fire: -2 }; // push, shove, corrode, burn

// ---- Breath effects, wyrmling strength ---- [Doc] §3 element table; numbers [Assumed]
export const WATER_PUSH = BAND; // [Proposed; was 1 pace] Water: the jet pushes the target back a whole band
export const WATER_SLAM = 3; // [Proposed] true damage when the push drives the target into the wall or an obstacle
export const WATER_OBSTACLE_PUSH = BAND; // [Proposed] the jet shoves a boulder it strikes instead of breaking it; pillars don't move
export const SMOLDER_PUSH = PACE; // Smoldering Maw's lingering water still nudges 1 pace
export const AIR_SHOVE = PACE; // Air: the gust shoves the target sideways
export const ZONE_RADIUS = PACE; // Fire's burning zone and Earth's corrosive pool
export const ZONE_SLOTS = 1; // a zone lingers through this many slots after the one it lands in
export const BURN_DAMAGE = 3; // [Proposed; was 1] true damage to a grounded dragon in a burning zone at slot's end
export const CORRODE_HARDNESS = 3; // Hardness lost next slot by a grounded dragon in a corrosive pool at slot's end
export const EARTH_OBSTACLE_MULTIPLIER = 2; // Earth's slurry eats obstacles

// ---- Aspects ---- [Doc] §2; numbers [Assumed]
export const STOOP_RANGE = FAR_EDGE; // Wyvern Talons: a Claw from the air stoops on a grounded target anywhere within Far
export const STOOP_LANDING = Math.floor(1.5 * PACE); // [Assumed] it lands on the ground this far short of where the target stood
export const WYVERN_GROUND_CLAW_REACH = 2 * PACE; // [Assumed] forelimbs are wings, so its Claw from the ground is short

// ---- Technique numbers ---- (dragonshards-technique.md gives most; these fill its gaps) [Assumed]
export const TECHNIQUE_POINTS = 3; // Thornscale's spikes, Goading Roar's sting, Riposte's free claw, Smoldering Maw's linger
export const SCYTHE_REACH = { wyrmling: PACE / 2, full: PACE }; // Scything widens the arc: one side, then both
export const SMOLDER_RADIUS = { center: PACE, full: 2 * PACE }; // Smoldering Maw: the area's center, then all of it
export const LANCE_WIDEN = PACE / 2; // Lance Throat Elder: the line's half-width grows this much by its end
export const STOOPING_HEIGHT = { wyrmling: 6 * PACE, rest: 3 * PACE }; // Stooping Pinions: how high a dive must start

// ---- Attack shapes ----
// Measured from the attacker along its aim ("forward") and away from the aim line in any direction ("off-axis").
export const BITE_REACH = 5 * PACE; // [Assumed] Melee into Close; starts just outside at Far
export const BITE_HALF_WIDTH = PACE / 2; // [Assumed] narrow: how far off the aim line it still catches
export const CLAW_REACH = Math.floor((10 * PACE) / 3); // [Assumed] arc edge reaches just into Close
export const CLAW_BACK = PACE / 2; // [Assumed] arc wraps slightly behind the shoulders
export const STOMP_RADIUS = { wyrmling: 2 * PACE, adult: 3 * PACE, venerable: 4 * PACE }; // [Assumed] contact + 1/2/3 paces
export const BREATH = {
  line: { reach: 9 * PACE, halfWidth: PACE / 2 }, // Water: high-pressure jet
  narrowCone: { reach: 7 * PACE }, // Earth: half-width grows ¼ pace per pace, plus ¼ pace
  wideCone: { reach: 9 * PACE }, // Air: half-width equals distance; reaches Far like the others
  blast: { maxCenter: Math.floor(7.5 * PACE), radius: Math.floor(0.5 * PACE) }, // Fire: lands on the target; radius cut from 1.5 to 0.5
}; // all [Assumed]; every breath stays within Far [Doc]

// ---- Attack-role variants ---- [Proposed] Switched on for testing, one per run: REFEREE_VARIANT=charge,mandatory,lunge,pounce
// Claw catches strafes; Bite catches retreats and armor; Breath catches dodges; Stomp catches burrows and the grounded.
const variantEnv = (typeof process !== 'undefined' ? process.env.REFEREE_VARIANT ?? '' : '').split(',');
export const VARIANT = {
  breathCharge: variantEnv.includes('charge'), // a charge earns +3 only on its second slot (Bellows Chest restores it for Breath)
  breathMandatory: variantEnv.includes('mandatory'), // Breath must charge: a plain Breath is read as a one-slot charge
  biteLunge: variantEnv.includes('lunge'), // a Bite right after an Approach carries the dragon 1 pace forward during its wind-up
  clawPounce: variantEnv.includes('pounce'), // a Claw right after a Strafe advances through its active window and pierces
};
export const BITE_LUNGE = PACE;
export const POUNCE_REACH = BAND; // a pounce carries up to one band, stopping at the stoop's landing distance
export const POUNCE_PIERCE = 3; // like Bite's piercing
