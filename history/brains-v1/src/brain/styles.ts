// Brain styles and skill: each style's tastes, leanings and focus, and what each skill level can imagine.

import { ACTIONS, type ActionName, type ActionSpec } from '../actions.ts';
import type { Fighter } from '../referee.ts';
import * as R from '../rules.ts';

export type BrainStyle =
  | 'swarmer' | 'out-boxer' | 'slugger' | 'counterpuncher' | 'boxer-puncher' | 'aerialist' | 'reader'
  | 'claw-focus' | 'bite-focus' | 'breath-focus' | 'meter-focus' | 'charge-focus' | 'kite-focus';
export const BRAIN_STYLES: readonly BrainStyle[] = [
  'swarmer', 'out-boxer', 'slugger', 'counterpuncher', 'boxer-puncher', 'aerialist', 'reader',
  'claw-focus', 'bite-focus', 'breath-focus', 'meter-focus', 'charge-focus', 'kite-focus',
];

/**
 * Each style's taste for each attack [Proposed]. With the dragon's own attacks it sets the style's ideal band:
 * Claw wants Melee, Bite wants Close, Breath wants Far. A swarmer with an Earth Bite wants Close; an out-boxer
 * with a Fire Breath wants Far.
 */
export const TASTE: Record<BrainStyle, { claw: number; bite: number; breath: number }> = {
  swarmer: { claw: 1.2, bite: 1.2, breath: 0.6 },
  'out-boxer': { claw: 0.4, bite: 0.6, breath: 1.5 },
  slugger: { claw: 0.8, bite: 1.5, breath: 0.8 },
  counterpuncher: { claw: 1, bite: 1, breath: 1 },
  'boxer-puncher': { claw: 1, bite: 1, breath: 1 },
  aerialist: { claw: 1.3, bite: 0.7, breath: 1 },
  reader: { claw: 1, bite: 1, breath: 1 },
  'claw-focus': { claw: 1, bite: 0, breath: 0 },
  'bite-focus': { claw: 0, bite: 1, breath: 0 },
  'breath-focus': { claw: 0, bite: 0, breath: 1 },
  'meter-focus': { claw: 0.8, bite: 1, breath: 1.2 },
  'charge-focus': { claw: 0.6, bite: 1.1, breath: 1.3 },
  'kite-focus': { claw: 0.3, bite: 0.5, breath: 1.5 },
};

/** How much each style values forcing the opponent to miss (a whiff, near miss or evade) [Proposed]. */
export const MISS_TASTE: Partial<Record<BrainStyle, number>> = { 'out-boxer': 1.5, counterpuncher: 1.5, 'kite-focus': 2, reader: 1, 'boxer-puncher': 1, aerialist: 1, swarmer: 0.3, slugger: 0.3 };

/**
 * What each band is worth to a dragon: the best rough damage per attempt (by land rate, times the style's taste)
 * among the attacks that reach it, by the current rules. Claw reaches Melee and just into Close; Bite reaches
 * through Close, Melee included; Breath reaches to Far's edge, but at Melee it is lost to any hit before it resolves.
 */
export function bandWorth(f: Fighter, taste: { claw: number; bite: number; breath: number }): Record<Band, number> {
  const claw = Math.max(1, f.sheet.claw - 4) * 0.68 * taste.claw;
  const bite = Math.max(1, f.sheet.bite - 1) * 0.45 * taste.bite;
  const breath = Math.max(1, f.sheet.breath - 6) * 0.5 * taste.breath;
  return { melee: Math.max(claw, bite, 0.5 * breath), close: Math.max(bite, breath, 0.3 * claw), far: breath, veryFar: 0 };
}

/** The bands a dragon wants: every band worth at least 90% of its best. A biter is at home at Melee and Close alike. */
export function idealBands(f: Fighter, taste: { claw: number; bite: number; breath: number }): Band[] {
  const worth = bandWorth(f, taste);
  const best = Math.max(...Object.values(worth));
  return (Object.keys(worth) as Band[]).filter((b) => worth[b] >= 0.9 * best);
}

/**
 * Focus brains attack with one thing only: Claw at Melee, Bite at Close, or Breath at Far. Every move,
 * guard and Intimidate stays open to them, in service of landing that one attack.
 */
export const FOCUS: Partial<Record<BrainStyle, { attack: ActionName; band: 'melee' | 'close' | 'far' }>> = {
  'claw-focus': { attack: 'claw', band: 'melee' },
  'bite-focus': { attack: 'bite', band: 'close' },
  'breath-focus': { attack: 'breath', band: 'far' },
};

/** Whether this style may script this action: focus brains attack only with their focus. */
export function allowed(style: BrainStyle, a: ActionSpec): boolean {
  const focus = FOCUS[style];
  return !focus || ACTIONS[a.name].category !== 'attack' || a.name === focus.attack;
}

export type Skill = 'novice' | 'adept' | 'master';
export const SKILLS: readonly Skill[] = ['novice', 'adept', 'master'];

export interface SkillLevel {
  /** candidate scripts it imagines */
  candidates: number;
  /** opponent scripts it imagines each candidate against */
  guesses: number;
  /** how loosely it picks among good scripts: higher plays more often off its best */
  temperature: number;
  /** how quickly old habits fade from its read, per exchange */
  memory: number;
  /** how often its style's tell shows */
  tell: number;
  /** counter-scripts it builds against its likeliest guesses, slot by slot in the Referee */
  counters: number;
  /** exchanges it looks ahead: this one, then quick play-outs of the next */
  horizon: number;
  /** how many of its best scripts it plays forward past this exchange */
  lookahead: number;
}

export const SKILL: Record<Skill, SkillLevel> = {
  novice: { candidates: 8, guesses: 4, temperature: 0.08, memory: 0.5, tell: 0.9, counters: 0, horizon: 1, lookahead: 0 },
  adept: { candidates: 14, guesses: 6, temperature: 0.04, memory: 0.8, tell: 0.5, counters: 1, horizon: 2, lookahead: 4 },
  master: { candidates: 28, guesses: 12, temperature: 0.015, memory: 0.95, tell: 0.15, counters: 2, horizon: 3, lookahead: 6 },
};

/** Which actions each style reaches for first when imagining scripts, by range band. Others still get a look. */
export type Band = 'melee' | 'close' | 'far' | 'veryFar';
export const LEAN: Record<BrainStyle, Partial<Record<ActionName, number>> | ((band: Band, aloft: boolean, oppAloft: boolean) => Partial<Record<ActionName, number>>)> = {
  swarmer: (b) => (b === 'melee' ? { claw: 4, bite: 2, stomp: 1 } : b === 'close' ? { approach: 3, bite: 3, claw: 1 } : { approach: 4, breath: 1 }),
  'out-boxer': (b) => (b === 'melee' || b === 'close' ? { retreat: 3, strafe: 2, breath: 3, leap: 1 } : b === 'far' ? { breath: 4, strafe: 2, retreat: 1 } : { approach: 2, strafe: 2 }),
  slugger: (b) => (b === 'melee' ? { stomp: 3, bite: 2, intimidate: 2, claw: 1 } : b === 'close' ? { bite: 4, intimidate: 3 } : { approach: 3, intimidate: 1, breath: 2 }),
  counterpuncher: (b) => (b === 'melee' ? { scales: 3, dodge: 2, claw: 2 } : b === 'close' ? { scales: 3, dodge: 2, bite: 2, strafe: 1 } : { breath: 2, scales: 1, strafe: 2 }),
  'boxer-puncher': {},
  // A stoop carries only a band: from Far, close in aloft first; from Close, stoop.
  aerialist: (b, aloft, oppAloft) => (aloft && !oppAloft ? (b === 'far' || b === 'veryFar' ? { approach: 4, breath: 2, claw: 1 } : { claw: 4, breath: 2, approach: 1 }) : { leap: 4, breath: 2, dive: 1 }),
  reader: (b) => (b === 'far' || b === 'veryFar' ? { intimidate: 3, breath: 2, approach: 2 } : { intimidate: 3, scales: 2, bite: 2, claw: 2 }),
  'claw-focus': (b) => (b === 'melee' ? { claw: 5, dodge: 1, scales: 1, strafe: 1 } : { approach: 4, strafe: 1, dodge: 1 }),
  // Bite reaches through Close, Melee included: a biter stays and bites rather than backing out of Melee.
  'bite-focus': (b) => (b === 'close' ? { bite: 5, strafe: 1, scales: 1, intimidate: 1 } : b === 'melee' ? { bite: 5, dodge: 1, scales: 1, strafe: 1 } : { approach: 4, strafe: 1 }),
  // Kite-focus [Proposed]: a diagnostic. Position first: it backs off and slips sideways to hold Far, breathes from
  // there, and bites or claws only when caught. It measures whether kiting holds up.
  'kite-focus': (b) => (b === 'melee' ? { retreat: 4, strafe: 2, dodge: 1, claw: 1 } : b === 'close' ? { retreat: 3, breath: 2, strafe: 2 } : b === 'far' ? { breath: 4, strafe: 2, retreat: 1, scales: 1 } : { breath: 2, approach: 1, strafe: 1 }),
  // Meter-focus [Proposed]: a diagnostic. Any attack is open; it guards, dodges and breathes to fill the Acumen
  // meter, then lands its true-damage hit. If it beats the general styles, the meter loop is too strong.
  'meter-focus': (b) => (b === 'melee' ? { scales: 3, dodge: 2, bite: 2, claw: 1 } : b === 'close' ? { breath: 3, scales: 2, bite: 2, dodge: 1 } : b === 'far' ? { breath: 4, scales: 2, approach: 1 } : { approach: 3, breath: 1 }),
  // Charge-focus [Proposed]: a diagnostic. It plans two-slot charges of Breath and Bite and plays around their release.
  'charge-focus': (b) => (b === 'melee' ? { bite: 3, scales: 2, retreat: 2, claw: 1 } : b === 'close' ? { breath: 3, bite: 3, scales: 1, strafe: 1 } : b === 'far' ? { breath: 4, approach: 1, strafe: 1 } : { approach: 3 }),
  'breath-focus': (b) => (b === 'far' ? { breath: 5, strafe: 2, scales: 1 } : b === 'veryFar' ? { approach: 3, breath: 1 } : { retreat: 4, leap: 1, breath: 2, dodge: 1 }),
};

/** How readily each style imagines a charge, short (one slot) or long (two); others take it at 0.4 of their lean. */
export const CHARGE_LEAN: Partial<Record<BrainStyle, { short: number; long: number }>> = {
  'charge-focus': { short: 1.5, long: 3 },
  slugger: { short: 1, long: 1 },
  'out-boxer': { short: 1, long: 1 },
  'meter-focus': { short: 1, long: 1 },
};
export const CHARGE_LEAN_DEFAULT = 0.4;
/**
 * The action that fires each Technique. A brain carrying one imagines that action more often, so it plays its shards:
 * Riposte Talons wants Dodges, Thornscale and Mantle Wings want Scales, and so on.
 */
export const TRIGGERS: Record<string, ActionName> = {
  'snapping-jaw': 'bite', lockjaw: 'bite', 'gnashing-teeth': 'bite',
  'hamstring-hooks': 'claw', 'scything-forelimbs': 'claw', 'ratchet-claws': 'claw', 'raking-talons': 'claw',
  'lance-throat': 'breath', 'smoldering-maw': 'breath', 'bellows-chest': 'breath',
  'stooping-pinions': 'dive', 'sidewinder-spine': 'strafe', 'bounding-haunches': 'approach',
  thornscale: 'scales', 'riposte-talons': 'dodge', 'mantle-wings': 'scales',
  'sapping-bellow': 'intimidate', 'baleful-eye': 'intimidate', 'goading-roar': 'intimidate',
};
/** How much more a brain leans toward an action one of its Techniques fires on. */
export const SHARD_LEAN = 1.6;
/** A crunch, when a shard grants one, is worth a closer look. */
export const CRUNCH_LEAN = 1.5;

export const bandOf = (sep: number): Band => (sep <= R.MELEE_EDGE ? 'melee' : sep <= R.CLOSE_EDGE ? 'close' : sep <= R.FAR_EDGE ? 'far' : 'veryFar');
