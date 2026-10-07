// The boxing archetypes: each is a set of goals over what an exchange produces, and nothing else. How a brain plays
// follows from its goals and from the Referee's own numbers, never from tables of habits.

import type { Fighter } from '../referee.ts';
import { findShard } from '../shards.ts';

export type Archetype = 'swarmer' | 'out-boxer' | 'slugger' | 'counterpuncher' | 'boxer-puncher';
export const ARCHETYPES: readonly Archetype[] = ['swarmer', 'out-boxer', 'slugger', 'counterpuncher', 'boxer-puncher'];

/** What an imagined exchange produces, each on its own scale (see features.ts). */
export const FEATURES = ['dealt', 'taken', 'reach', 'exposure', 'misses', 'punish', 'big', 'free', 'pursuit', 'tempo', 'payoff', 'ready', 'surge', 'status', 'ground', 'perch'] as const;
export type Feature = (typeof FEATURES)[number];
export type Goals = Record<Feature, number>;

/**
 * How much each feature is worth in units of a Wounds pool. These put the features on one scale; the archetypes
 * then weigh them. A whole pool dealt is 1; a forced miss is worth about a twentieth of a typical hit.
 */
export const SCALE: Goals = {
  dealt: 1, // fraction of the opponent's Wounds pool dealt
  taken: 1, // fraction of its own pool taken
  reach: 0.3, // its best hit from where it stands, as a fraction of the opponent's pool
  exposure: 0.3, // the opponent's best hit from where it stands, as a fraction of its own pool
  misses: 0.03, // per opponent attack it made miss
  punish: 0.03, // per punish it landed
  big: 0.04, // per hit of a fifth of the opponent's pool or more
  free: 0.04, // per hit landed in a slot where it took nothing back
  pursuit: 0.05, // the opponent backed off and it kept (or improved) its reach; lost it, the same against
  tempo: 0.03, // per open setup, held Intimidate or chain link, net of the opponent's
  payoff: 0.05, // per setup cashed: a lunging Bite or a pouncing Claw that lands
  ready: 0.03, // its Breath (1) and Stomp (½) off cooldown when the exchange ends, net of the opponent's: a wasted swing costs
  surge: 0.1, // Surge lead, as a fraction of a full meter (a full one counts half again)
  status: 0.03, // per lasting status or debt on the opponent, net of its own
  ground: 0.05, // standing clear of the opponent's zones and, late, the rim; net of the opponent
  perch: 0.05, // a flier aloft over a grounded opponent within stoop reach, net of the opponent
};

/**
 * Each archetype's goals, as multipliers on SCALE (1 is the boxer-puncher's even keel).
 *   swarmer         presses in, builds chains and setups, cashes them, and accepts hits to land its own
 *   out-boxer       holds the range where it hits and isn't hit back, and makes the opponent miss
 *   slugger         runs the opponent down for big hits, and won't let it back off
 *   counterpuncher  jukes and maneuvers to make the opponent miss, then takes the free hit
 *   boxer-puncher   even on everything: the baseline
 */
export const GOALS: Record<Archetype, Goals> = {
  swarmer: { dealt: 1, taken: 0.7, reach: 1.4, exposure: 0.3, misses: 0.3, punish: 0.6, big: 0.6, free: 0.6, pursuit: 0.8, tempo: 1.6, payoff: 1.3, ready: 1, surge: 0.8, status: 1, ground: 1, perch: 1 },
  'out-boxer': { dealt: 0.9, taken: 1.4, reach: 0.7, exposure: 1.6, misses: 1.6, punish: 0.8, big: 0.4, free: 1.2, pursuit: 0, tempo: 0.5, payoff: 0.8, ready: 1, surge: 1, status: 1, ground: 1.2, perch: 1 },
  slugger: { dealt: 1.2, taken: 0.7, reach: 1.2, exposure: 0.4, misses: 0.1, punish: 1.3, big: 2, free: 0.5, pursuit: 2.2, tempo: 0.6, payoff: 1, ready: 1, surge: 1, status: 1, ground: 0.8, perch: 1 },
  counterpuncher: { dealt: 0.9, taken: 1, reach: 0.8, exposure: 0.9, misses: 2, punish: 1.6, big: 0.6, free: 2.2, pursuit: 0.2, tempo: 0.6, payoff: 0.8, ready: 1, surge: 1.2, status: 1, ground: 1, perch: 1 },
  'boxer-puncher': { dealt: 1, taken: 1, reach: 1, exposure: 1, misses: 1, punish: 1, big: 1, free: 1, pursuit: 1, tempo: 1, payoff: 1, ready: 1, surge: 1, status: 1, ground: 1, perch: 1 },
};

/** The aerial overlay: on a winged dragon every archetype values the high ground in full; grounded, only the threat. */
export const PERCH_GROUNDED = 0.5;

export type Skill = 'novice' | 'adept' | 'master';
export const SKILLS: readonly Skill[] = ['novice', 'adept', 'master'];

export interface SkillLevel {
  /** candidate scripts it imagines */
  candidates: number;
  /** opponent scripts it imagines each candidate against */
  guesses: number;
  /** best answers it builds to its likeliest guesses */
  counters: number;
  /** exchanges it imagines ahead (1: this one only) */
  horizon: number;
  /** candidates it plays forward through the horizon */
  lookahead: number;
  /** how loosely it picks among good scripts: higher plays more often off its best */
  temperature: number;
  /** how much of an exchange-old habit its read keeps */
  memory: number;
}

export const SKILL: Record<Skill, SkillLevel> = {
  novice: { candidates: 8, guesses: 3, counters: 0, horizon: 1, lookahead: 0, temperature: 0.08, memory: 0.5 },
  adept: { candidates: 14, guesses: 5, counters: 1, horizon: 2, lookahead: 4, temperature: 0.04, memory: 0.8 },
  master: { candidates: 24, guesses: 8, counters: 2, horizon: 3, lookahead: 6, temperature: 0.015, memory: 0.95 },
};

/** Skill from the dragon itself, for now its shard pips (Lineages later): none novice, a pip or two adept, a full array master. */
export function skillOf(f: Fighter): Skill {
  const pips = f.loadout.names.reduce((n, name) => {
    try {
      return n + findShard(name).pips;
    } catch {
      return n + 1; // a Technique's name needs its grade to look up; every Wyrmling Technique here is one pip or two
    }
  }, 0);
  return pips === 0 ? 'novice' : pips < 3 ? 'adept' : 'master';
}
