// Every number the Referee uses lives here. Each one is a dial.
// [Doc]      settled in dragon-duel-design.md
// [Proposed] marked [Proposed] in the design doc
// [Assumed]  placeholder chosen for this build; the numbers pass should replace it
//
// Units are fixed: the integer grid everything is measured on. Every other dial lives in DEFAULT_RULES, which each
// bout carries as bout.rules. Tests and diagnostics pass overrides (rulesWith) instead of editing the defaults.

// ---- Units ----
/** The baseline Wounds the hatch tables are written against; BASE_WOUNDS moves every pool by its difference. */
export const WOUNDS_TABLE_BASE = 36;
export const TICKS_PER_SLOT = 30; // [Doc] §4 Timeline: 30 ticks of 100 ms
export const SLOTS_PER_EXCHANGE = 3; // [Doc] §4 Exchange
export const HALF = 15; // [Doc] a crunch half runs 15 ticks
// Positions are whole numbers in a fine grain so all math stays in integers.
export const PACE = 300; // internal units per pace
export const NOTCH = PACE / 3; // ⅓ pace: one point of Accuracy's phantom band [Doc] §4 Hits
export const BAND = 3 * PACE; // [Doc] each range band is 3 paces deep
export const MELEE_EDGE = BAND;
export const CLOSE_EDGE = 2 * BAND;
export const FAR_EDGE = 3 * BAND;
export const PILLAR_HEIGHT = 1_000_000; // unbreakable and too tall to fly over
export const METER_MAX = 100;

export const DEFAULT_RULES = {
  // ---- Time ----
  BASE_WOUNDS: 36, // [Proposed] the baseline Wounds pool; morph swings and a disliked stone's −6 apply on top. Raise it to lengthen fights
  EXCHANGE_LIMIT: 8, // [Assumed] the doc estimates six to eight; the last three get rim pulses
  MIN_ACTIVE: 3, // [Proposed] the active window never drops below 3 ticks
  CHARGE_BONUS: 3, // [Assumed] a charged Bite or Breath hits for +3
  // ---- Space ----
  LEASH: 4 * BAND, // [Doc] separation can't exceed Very Far's outer edge (12 paces)
  ARENA_RADIUS: 12 * PACE, // [Doc] §5 radius equals the leash
  BODY_GAP: 1 * PACE, // [Assumed] closest two dragon centers can get
  RIM_DEPTH: 3 * PACE, // [Assumed] how far in from the wall the pillars' pulse reaches
  MAX_ALTITUDE: 3 * BAND, // [Assumed] arena ceiling: 9 paces
  BODY_RADIUS: PACE / 2, // [Assumed] for collisions with obstacles
  // ---- Obstacles ---- [Doc] §5: four unbreakable pillars at the quadrants; obstacles have 3, 6 or 9 Wounds by size
  PILLAR_INSET: Math.floor(1.5 * PACE), // [Assumed] pillars stand just inside the rim
  PILLAR_RADIUS: PACE, // [Assumed]
  BOULDERS: {
    small: { radius: PACE / 2, height: PACE, wounds: 3 }, // radius and height [Assumed]
    medium: { radius: PACE, height: 2 * PACE, wounds: 6 },
    large: { radius: Math.floor(1.5 * PACE), height: 3 * PACE, wounds: 9 },
  },
  BOULDER_CLEARANCE: 2 * PACE, // [Assumed] random boulders keep this far from starting spots
  START_SEPARATION: Math.floor(6.5 * PACE), // [Doc] Far, just outside Bite range
  // ---- Movement ----
  // Band moves [Proposed]: every primary move (Approach, Retreat, Strafe, Leap, Dive) carries one band (3 paces), for
  // every dragon; a Strafe's band is 3 paces of arc around the opponent. Evasion buys
  // where in that band it lands (± Evasion ÷ 6 paces, scripted short or long), how fast the move resolves
  // (72 ÷ Evasion ticks), and how long it counts as evading (2 × Evasion ticks of active window).
  BAND_MOVE: BAND,
  MOVE_DEPTH_DIVISOR: 6,
  MOVE_SPEED: 72,
  EVADE_TICKS_PER_POINT: 2,
  // ---- Damage ---- [Doc] §4 Damage, Modifiers
  INTIMIDATE_BONUS: 3,
  CHAIN_THIRD_LINK_BONUS: 3,
  PUNISH_BONUS: 3, // Acumen scaling of punishes not modeled yet
  MATCHUP: 3,
  DAMAGE_FLOOR: 1,
  STOMP_DAMAGE: 3,
  BITE_PIERCE: 3, // [Doc] Bite is piercing; [Assumed] it ignores 3 Scales
  // The True Dragon's Aspect, Stalwart [Proposed]: its own zones never harm it, and each charging slot widens its
  // released Breath by ½ pace. (A 3-tick faster Breath was tried and overshot.)
  STALWART_WIDEN: Math.floor(PACE / 2),
  // The Drake's Aspect, Ravener [Proposed]: an Approach or hop that moves primes a lunge for this many slots (across an
  // exchange); the first Bite in the window lunges, and while it's live the Bite tracks at Melee and Close.
  RAVENER_SLOTS: 3,
  // The Drake's hop [Proposed]: its Leap arcs this high and a full band forward, landing within the slot; it winds up
  // this many ticks slower and recovers as much faster.
  DRAKE_HOP_HEIGHT: BAND,
  DRAKE_HOP_WINDUP: 5,
  STALWART_OWN_ZONES: 1, // [Proposed] 1: a True Dragon's own zones never harm it; 0: they do, as anyone's (a measuring dial)
  // Between slots, separation snaps to the nearest ½ pace [Proposed]: where a dragon lands in a band matters only for
  // that action, and the edge cases of drift (2.96 paces against 3.04) clean up before the next.
  SNAP: Math.floor(PACE / 2),
  // Aim [Proposed]: an attack's aim tracks its target through the wind-up and settles (12 − Accuracy) ticks before the
  // strike, never less than 1 tick and never longer than the wind-up. Movement after that is what a shape must cover.
  AIM_SETTLE_BASE: 12,
  // ---- Guards ----
  GUARD_SCALES: 3, // [Assumed] Scales bonus while Guarding
  GUARD_AFFINITY: 3, // [Assumed] Affinity bonus while Guarding: presenting the hide to the elements
  DODGE_BONUS: 3, // [Assumed] Evasion bonus while dodging
  // ---- The Evasion test ---- [Proposed] pair-off dice
  // 1: a Bite or Claw against a moving or dodging target rolls its attack stat ÷ 3 in d6 against Evasion ÷ 3, pairs the
  // pools off high to low, and the first difference decides; an unbroken chain goes to the side with dice left, and
  // equal pools matched all the way down are the defender's, as a near miss. 0: Accuracy against Evasion, ties to Acumen.
  HIT_DICE: 1, // [Proposed] pair-off dice for the Evasion test (0: Accuracy against Evasion, ties to Acumen)
  DICE_UNIT: 3, // [Proposed] points per die, on both sides
  DICE_SCALES: 0, // [Proposed] 1: the defender rolls Evasion + Scales (a hide turns the blow aside); 0: Evasion alone
  // ---- Acumen ---- [Proposed] §4 Surge
  // The Surge [Proposed]: Affinity fuels it. It starts at Acumen (10 × age category, +3 for a Water-preferring dragon), and
  // each trigger (a near miss, a Guard or Dodge slot held to the end, a Breath charging slot, a landed Breath) adds
  // Affinity + 9, +3 more for an Air-preferring dragon.
  // Full, the next landed Bite, Claw or Breath deals true damage (no Scales or Affinity) and drains it. A miss spends nothing.
  METER_BASE_FILL: 9, // [Proposed] raised from 3 so low-Affinity stones still fill
  GRAVITY_DROP: BAND, // [Proposed] a flier that doesn't Leap during an exchange drops a band at its end
  DEMORALIZE: 3, // [Proposed] an Intimidate that reaches also takes 3 off the target's next Bite or Claw
  STOMP_SCALES_DIVISOR: { wyrmling: 3, adult: 3, venerable: 2 }, // Stomp deals 3 + Scales ÷ 3 (a Venerable's ÷ 2), and shatters boulders inside its radius
  METER_STEROID_DIVISOR: 3, // a full meter's hit also adds Affinity ÷ 3 [Proposed]
  AGE_BRACKET: { wyrmling: 1, adult: 3, venerable: 5 } as const, // of five: wyrmling, juvenile, adult, elder, venerable
  BOULDERS_PER_ARENA: { dice: 4, plus: 2 }, // [Proposed] standard arenas throw 1d4+2 boulders: never an open floor
  // ---- Statuses ---- [Doc] §4 Statuses
  RATTLED_WINDUP: 3,
  BLINDED_ACCURACY: 3,
  // ---- Breath damage by element ---- [Assumed]: harmless extras earn points, harmful extras cost them
  ELEMENT_BREATH_MOD: { water: 2, air: 0, earth: 1, fire: -2 }, // push, pull (Air's +2 nixed: the pull isn't harmless), corrode, burn
  // ---- Breath effects, wyrmling strength ---- [Doc] §3 element table; numbers [Assumed]
  WATER_PUSH: BAND, // [Proposed; was 1 pace] Water: the jet pushes the target back a whole band
  SLAM_DAMAGE: 3, // [Proposed] true damage when any forced movement drives a dragon into the wall or an obstacle
  WATER_OBSTACLE_PUSH: BAND, // [Proposed] the jet shoves a boulder it strikes instead of breaking it; pillars don't move
  SMOLDER_PUSH: PACE, // Smoldering Maw's lingering water still nudges 1 pace
  AIR_PULL: BAND, // [Proposed] Air: the vortex pulls the target a band toward the breather, fliers included (it lowers them, never grounds them)
  AIR_FLOOR: PACE, // a pulled flier stays at least this high (or where it was, if lower)
  SMOLDER_PULL: PACE, // Smoldering Maw's lingering air still tugs 1 pace
  ZONE_RADIUS: PACE, // Earth's corrosive pool (and Fire's burning zone when FIRE_LANE is 0)
  ZONE_SLOTS: 1, // a zone lingers through this many slots after the one it lands in, when ZONE_DURATION_DIVISOR is 0
  BURN_DAMAGE: 3, // [Proposed; was 1] true damage to a grounded dragon in a burning zone at slot's end, when BURN_DIVISOR is 0
  // Setting the world on fire [Proposed]: Fire's breath ignites a lane along its line through Close and Far (from the Melee
  // edge to the Far edge), as wide as the blast. Zones linger Potency ÷ 6 slots, plus an exchange per charging slot; each
  // dragon keeps at most ZONE_MAX, the oldest going out first. A burn deals Potency ÷ 4. Each is a dial: 0 restores the old rule.
  FIRE_LANE: 1, // [Proposed] 1: a lane through Close and Far; 0: a ZONE_RADIUS circle at the target
  ZONE_DURATION_DIVISOR: 6, // [Proposed] a floor zone lingers Potency ÷ this many slots after the one it lands in
  ZONE_CHARGE_SLOTS: 3, // [Proposed] and this many more per charging slot of the Breath that laid it
  ZONE_MAX: 2, // [Proposed] floor zones each dragon keeps at once; 0 for no cap
  BURN_DIVISOR: 4, // [Proposed] a burn deals the breather's Potency ÷ this (18 → 4, 15 → 3, 12 → 3)
  // The element wheel in every element contest [Proposed]: a target whose stone beats the breather's adds MATCHUP to its
  // Affinity against the verb or zone, and one whose stone it beats loses it. Earth smothers Fire's burn.
  ELEMENT_MATCHUP_CONTEST: 1, // [Proposed] 0: contests ignore the wheel
  ZONE_MATCHUP: 1, // [Proposed] a burn adds the matchup (±3) like the Breath that laid it, never below the damage floor; 0: off
  // Earth corrodes [Proposed]: a landed Earth Breath corrodes the target directly (no pool) for Potency ÷ 6 slots plus an
  // exchange per charging slot; a corroded dragon takes +Potency ÷ 4 from every hit, and each hit on it is an Acumen trigger.
  EARTH_CORRODES: 1, // [Proposed] 1: the debuff on the hit; 0: the old pool that lowers Scales
  CORRODE_DIVISOR: 4, // [Proposed] a corroded dragon takes +Potency ÷ this from each hit (12 → 3)
  CORRODE_METER: 1, // [Proposed] 1: landing a hit on a corroded dragon fills the attacker's Surge
  BURN_BLINDS: 0, // [Proposed] 1: a burn also Blinds for the next slot (−3 Accuracy). Off: a toggle for A:B runs
  CORRODE_SCALES: 3, // Scales lost next slot by a grounded dragon in a corrosive pool at slot's end
  EARTH_OBSTACLE_MULTIPLIER: 2, // Earth's slurry eats obstacles
  // ---- Aspects ---- [Doc] §2; numbers [Assumed]
  STOOP_RANGE: FAR_EDGE, // Wyvern Talons: a Claw from the air against a grounded target within Far is a stoop
  STOOP_CARRY: BAND, // [Doc] the stoop descends to the ground, carrying at most one band forward or back
  STOOP_TICKS_PER_PACE: 2, // [Doc] the descent takes time: the stoop's wind-up grows this many ticks per pace it falls
  TALONS_LEAP_BANDS: 2, // [Doc] Talons: a Wyvern's Leap climbs up to two bands
  STOOP_LANDING: Math.floor(1.5 * PACE), // [Assumed] it lands on the ground this far short of where the target stood
  // The Wyrm's Serpentine [Proposed]: its Strafe tests Evasion with Dodge's bonus, against Breath too (1; 0: Bite and Claw only).
  SERPENTINE_BREATH: 1,
  // Stomp catches movers [Proposed]: a Stomp that lands on a dragon whose slot is a move Staggers it this many slots (1: the usual one).
  STOMP_MOVER_STAGGER: 2,
  STAGGER_EVASION_TEST: 1, // [Proposed] 1: a Staggered dragon also tests half its Evasion (it already moves on half); 0: movement only
  STOOP_PACES_PER_POINT: 2, // [Proposed] a stoop deals +1 per 2 paces it falls (+3 from two bands), like a charge paying for its setup; 0: off
  // ---- Technique numbers ---- (dragonshards-technique.md gives most; these fill its gaps) [Assumed]
  TECHNIQUE_POINTS: 3, // Thornscale's spikes, Goading Roar's sting, Riposte's free claw, Smoldering Maw's linger
  SCYTHE_REACH: { wyrmling: PACE / 2, full: PACE }, // Scything widens the arc: one side, then both
  SMOLDER_RADIUS: { center: PACE, full: 2 * PACE }, // Smoldering Maw: the area's center, then all of it
  LANCE_WIDEN: PACE / 2, // Lance Throat Elder: the line's half-width grows this much by its end
  STOOPING_HEIGHT: { wyrmling: 6 * PACE, rest: 3 * PACE }, // Stooping Pinions: how high a dive must start
  // ---- Technique suite ---- Suite v0.3 locked the parity pass (technique-parity-pass-1.md); suite v0.4 (Ken's
  // 2026-10-07 notes) is the default now. 'base' is v0.2; SUITE_V03 and SUITE_V02 restore the older suites.
  TECH_SNAPPING_JAW: 'borrow_dmg' as 'base' | 'borrow' | 'borrow_dmg', // borrow: the snap's ticks come out of your next slot
  TECH_LOCKJAW: 'clamp' as 'base' | 'clamp' | 'recovery', // clamp: a Pin keeps the jaw shut; your next slot can't Bite
  TECH_RATCHET_CLAWS: 'escalate' as 'base' | 'escalate', // escalate: each landed Claw link adds +1 to the next Claw
  TECH_THORNSCALE: 'free' as 'base' | 'window' | 'free', // window: thorns cost the guard's last ticks; free (v0.4): no cost
  TECH_BELLOWS_CHEST: 'mobile' as 'base' | 'mobile', // mobile: a Breath charge on the move
  TECH_MANTLE_WINGS: 'mantle' as 'base' | 'verbguard' | 'mantle', // verbguard: Guard also blocks a Breath's verb; mantle (v0.4): Elemental Mantle, +3 Affinity while Guarding, no cost
  TECH_SAPPING_BELLOW: 'reset' as 'base' | 'gland' | 'reset', // gland: the bellow rides the Breath; reset (v0.4): the Intimidate resets the opponent's chain
  TECH_LANCE_THROAT: 'pierce3' as 'base' | 'pierce' | 'pierce3', // pierce: a verbless line that pierces Affinity; pierce3 (v0.4): 3 at every grade and range
  TECH_SMOLDERING_MAW: 'linger' as 'base' | 'linger', // linger: ground lingers longer; a groundless breath lays its verb as ground
  TECH_STOOPING_PINIONS: 'nostack' as 'base' | 'nostack', // nostack: the dive's +3 never adds to a stoop or a hard landing
  TECH_ASH_GLAND: 'ashbreath' as 'pulled' | 'cloud' | 'ashbreath', // cloud: the blinding ash cloud; ashbreath (v0.4): a landed Breath Blinds for Affinity ÷ 3 slots
  TECH_BALEFUL_EYE: 'back' as 'pulled' | 'back', // pulled: cut in parity pass 1; back (v0.4): in the pool, keeping the Intimidate's +3
  TECH_ELEMENTAL_JAWS: 'on' as 'pulled' | 'on', // Elemental Jaws (v0.4): Bite + Affinity ÷ 3; a landed Bite readies Breath; Breath cooldown +1
  INTIMIDATE_TECH_BONUS: 1, // (v0.4) 1: Intimidate Techniques keep the Intimidate's +3; 0: they trade it away
  ATTR_SHARD_BONUS: 1, // (v0.4) every Body and Bloodstone shard's base points +1 (Wyrmling +2, Juvenile +3, Adult and up +4)
  ASH_CLOUD_RADIUS: PACE, // Ash Gland's Wyrmling cloud radius, a measuring dial
  ASH_CLOUD_EXCHANGES: 0, // [Proposed] how many exchanges an ash cloud hangs once it falls; 0: the rest of the bout
  // ---- Attack shapes ----
  // Measured from the attacker along its aim ("forward") and away from the aim line in any direction ("off-axis").
  // Reach is in whole range bands [Doc]; widths and radii are paces, tuned by attributes.
  BITE_REACH: CLOSE_EDGE, // Bite reaches through Close [Doc]: Melee into Close
  BITE_HALF_WIDTH: PACE / 2, // [Assumed] narrow: how far off the aim line it still catches
  CLAW_REACH: MELEE_EDGE + NOTCH, // Claw's arc reaches Melee's edge forward [Doc], from the ground or the air
  CLAW_SIDE: MELEE_EDGE + Math.floor(1.5 * PACE), // [Proposed] and sweeps half into Close at the sides, to catch a full-band strafe
  CLAW_BACK: PACE, // [Proposed] the arc wraps a pace behind the shoulders (was ½)
  STOMP_RADIUS: { wyrmling: CLOSE_EDGE, adult: FAR_EDGE, venerable: FAR_EDGE }, // Stomp quakes whole bands [Doc]: Close, then Far
  BREATH: {
    line: { reach: 9 * PACE, halfWidth: PACE / 2 }, // Water: high-pressure jet
    narrowCone: { reach: FAR_EDGE }, // Earth: through Far; half-width grows ¼ pace per pace, plus ¼ pace
    vortex: { maxCenter: Math.floor(8.5 * PACE), radius: Math.floor(0.5 * PACE) }, // [Proposed] Air: a ranged vortex centered on the target, 1 pace across (cut from 2); its edge reaches Far
    blast: { maxCenter: FAR_EDGE - Math.floor(0.75 * PACE), radius: Math.floor(0.75 * PACE) }, // Fire: lands on the target; radius 1.5 → 0.5 (Round 2) → 0.75 (once aim settled late)
  }, // all [Assumed]; every breath stays within Far [Doc]
  // ---- Attack roles ---- [Proposed]
  // Claw catches strafes; Bite catches retreats and armor; Breath catches dodges; Stomp catches burrows and the grounded.
  // A charge earns CHARGE_BONUS only when held a second slot (Bellows Chest restores it on a one-slot Breath charge).
  BITE_LUNGE: PACE, // a Bite right after an Approach that moved carries the dragon 1 pace forward during its wind-up
  POUNCE_REACH: BAND, // a Claw right after a Strafe that moved pounces: it carries up to one band, stopping at the stoop's landing distance
  POUNCE_PIERCE: 3, // like Bite's piercing
};

export type Rules = typeof DEFAULT_RULES;

/** Technique parity pass 1: every TECH_ key at its first variant. `--rule TECH_PASS_1=on` applies it. */
export const TECH_PASS_1: Partial<Rules> = {
  TECH_SNAPPING_JAW: 'borrow', TECH_LOCKJAW: 'clamp', TECH_RATCHET_CLAWS: 'escalate', TECH_THORNSCALE: 'window',
  TECH_BELLOWS_CHEST: 'mobile', TECH_MANTLE_WINGS: 'verbguard', TECH_SAPPING_BELLOW: 'gland', TECH_LANCE_THROAT: 'pierce',
  TECH_SMOLDERING_MAW: 'linger', TECH_STOOPING_PINIONS: 'nostack', TECH_ASH_GLAND: 'cloud',
  TECH_BALEFUL_EYE: 'pulled', TECH_ELEMENTAL_JAWS: 'pulled', INTIMIDATE_TECH_BONUS: 0, ATTR_SHARD_BONUS: 0,
};

/** Suite v0.3: the locked parity pass, before the v0.4 notes. `--rule SUITE_V03=on` applies it. */
export const SUITE_V03: Partial<Rules> = {
  TECH_SNAPPING_JAW: 'borrow_dmg', TECH_LOCKJAW: 'clamp', TECH_RATCHET_CLAWS: 'escalate', TECH_THORNSCALE: 'window',
  TECH_BELLOWS_CHEST: 'mobile', TECH_MANTLE_WINGS: 'verbguard', TECH_SAPPING_BELLOW: 'base', TECH_LANCE_THROAT: 'pierce',
  TECH_SMOLDERING_MAW: 'linger', TECH_STOOPING_PINIONS: 'nostack', TECH_ASH_GLAND: 'cloud',
  TECH_BALEFUL_EYE: 'pulled', TECH_ELEMENTAL_JAWS: 'pulled', INTIMIDATE_TECH_BONUS: 0, ATTR_SHARD_BONUS: 0,
};

/** Suite v0.2: every TECH_ key at its pre-lock rule. `--rule SUITE_V02=on` applies it. */
export const SUITE_V02: Partial<Rules> = {
  TECH_SNAPPING_JAW: 'base', TECH_LOCKJAW: 'base', TECH_RATCHET_CLAWS: 'base', TECH_THORNSCALE: 'base',
  TECH_BELLOWS_CHEST: 'base', TECH_MANTLE_WINGS: 'base', TECH_SAPPING_BELLOW: 'base', TECH_LANCE_THROAT: 'base',
  TECH_SMOLDERING_MAW: 'base', TECH_STOOPING_PINIONS: 'base', TECH_ASH_GLAND: 'pulled',
  TECH_BALEFUL_EYE: 'pulled', TECH_ELEMENTAL_JAWS: 'pulled', INTIMIDATE_TECH_BONUS: 0, ATTR_SHARD_BONUS: 0,
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** The default rules with some dials changed; nested objects merge. */
export function rulesWith(overrides: DeepPartial<Rules>, base: Rules = DEFAULT_RULES): Rules {
  const merge = (a: unknown, b: unknown): unknown =>
    b && typeof b === 'object' && a && typeof a === 'object'
      ? Object.fromEntries(Object.keys({ ...a, ...b }).map((k) => [k, merge((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])]))
      : b === undefined ? a : b;
  return merge(base, overrides) as Rules;
}
