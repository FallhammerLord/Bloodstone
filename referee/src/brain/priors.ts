// Which scripts a brain imagines: actions weighted by how well they serve its goals from where it will stand, using
// the Referee's attack worth. These only steer what gets imagined; the choice itself is made by playing it out.

import { ACTIONS, type ActionSpec } from '../actions.ts';
import * as R from '../rules.ts';
import { GOALS, woundsRisk, type Archetype } from './archetypes.ts';
import type { Context } from './features.ts';
import { legalActions, place, type Situation } from './options.ts';
import { closer, farther, type Band } from './probe.ts';
import { pick } from './read.ts';

/** How much a band is worth standing in: its own reach against the opponent's, by the archetype's goals. */
export function bandScore(style: Archetype, ctx: Context, band: Band): number {
  const g = GOALS[style];
  return g.reach * ctx.mine.best[band] - g.exposure * ctx.theirs.best[band];
}

/** What the script so far says about this slot: a Drake's open Ravener window, and the action just before. */
export interface ScriptContext {
  primed: boolean;
  prev: ActionSpec['name'] | null;
}
const EVASIVE = new Set(['strafe', 'dodge', 'retreat']);

/**
 * How readily an archetype imagines an action from a band. An attack that can't reach from here is barely imagined
 * (a gambit on an opponent stepping in rarely pays). Goals shape the rest: pursuit chases and won't back off; free
 * hits juke first and strike after.
 */
export function prior(style: Archetype, ctx: Context, band: Band, s: Situation, a: ActionSpec, sc: ScriptContext = { primed: false, prev: null }): number {
  const g = GOALS[style];
  const here = bandScore(style, ctx, band);
  const move = (to: Band) => Math.max(0.15, 1 + 8 * (bandScore(style, ctx, to) - here));
  let w: number;
  if (a.setup) w = (prior(style, ctx, band, s, { name: a.setup }, sc) + prior(style, ctx, band === 'veryFar' ? 'far' : band, s, { name: a.name }, { ...sc, prev: a.setup })) / 2;
  else if (ACTIONS[a.name].category === 'attack' && a.name !== 'intimidate') {
    const reach = ctx.mine.attack[band][a.name] ?? 0;
    w = reach > 0 ? 0.1 + 10 * reach * (g.dealt + 0.3 * g.big) : 0.02;
    // The heavy goal (the slugger): each attack by what has been getting through, against the heaviest here, curved by
    // the goal, so it leans hard on whichever attack the opponent's defenses let through best.
    if (g.heavy > 0 && reach > 0) {
      const through = (x: ActionSpec['name']) => (ctx.mine.attack[band][x] ?? 0) * (ctx.punch?.[x] ?? 1);
      const heaviest = Math.max(...(['bite', 'claw', 'breath', 'stomp'] as const).map(through));
      if (heaviest > 0) w *= (through(a.name) / heaviest) ** g.heavy;
    }
    // A Drake's open Ravener window: its next Bite lunges and tracks, so it reaches for the Bite.
    if (sc.primed && a.name === 'bite') w = 2 * w + 0.3 * g.payoff;
    // The strike after a juke (free hits), or after running the opponent down (pursuit).
    if (reach > 0 && sc.prev && EVASIVE.has(sc.prev)) w *= 1 + 0.4 * g.free;
    if (reach > 0 && sc.prev === 'approach') w *= 1 + 0.3 * g.pursuit;
    // Cashing in: with a full Surge or a held Intimidate, the next landed blow carries power.
    if (reach > 0 && a.name !== 'stomp' && (s.f.meter >= R.METER_MAX || s.f.intimidateBonus)) w *= 1 + 0.3 * g.power;
  } else if (a.name === 'approach' || (a.name === 'leap' && s.f.sheet.aspect === 'ravener')) w = move(closer[band]) * (1 + 0.6 * g.pursuit);
  else if (a.name === 'retreat') w = move(farther[band]) * Math.max(0.2, 1 - 0.3 * g.pursuit);
  else if (a.name === 'strafe') w = 0.4 + 0.5 * g.misses + 0.4 * g.free;
  else if (a.name === 'dodge') w = 0.2 + 5 * ctx.theirs.best[band] * g.taken * risk(style, s) + 0.5 * g.misses + 0.4 * g.free;
  // A Guard held to the end fills Surge: a Surge-chaser raises it to load up.
  else if (a.name === 'guard') w = 0.2 + 5 * ctx.theirs.best[band] * g.taken * risk(style, s) + 0.15 * (g.surge - 1) * surgeToGo(s);
  // An Intimidate backs the next blow with +3: worth more to a style that values power.
  else if (a.name === 'intimidate') w = 0.2 + 0.15 * (g.punish + g.big) + 0.2 * g.power;
  else if (a.name === 'leap' || a.name === 'dive') w = s.f.sheet.flies ? 0.6 : 0.2;
  else w = 0.3;
  // A charging Breath slot fills Surge: a Surge-chaser charges more readily while its meter has room.
  if (a.charge && a.name === 'breath') return 0.5 * w * (1 + Math.max(0, g.surge - 1) * surgeToGo(s));
  return a.charge ? 0.5 * w : a.crunch ? 1.3 * w : w;
}

/** Its own Wounds on the curve (archetypes.ts): a wounded dragon reaches for its defenses sooner. */
const risk = (style: Archetype, s: Situation) => woundsRisk(s.f.wounds / s.f.sheet.wounds, style);
/** How far its Surge has to go, 0 (full) to 1 (empty). */
const surgeToGo = (s: Situation) => 1 - Math.min(1, s.f.meter / R.METER_MAX);

/** Where a move leaves the separation, roughly: a band in or out, or nowhere. */
export function nextSep(sep: number, a: ActionSpec, s: Situation): number {
  if (a.name === 'approach' || (a.name === 'leap' && s.f.sheet.aspect === 'ravener') || a.setup === 'approach') return Math.max(s.rules.BODY_GAP, sep - s.rules.BAND_MOVE);
  if (a.name === 'retreat') return Math.min(s.rules.LEASH, sep + s.rules.BAND_MOVE);
  return sep;
}

/** One imagined script: slot by slot, each action drawn by its prior (or uniformly, to explore). */
export function sampleScript(style: Archetype, ctx: Context, s: Situation, sep: number, rng: () => number, styled: boolean, band: (sep: number) => Band): ActionSpec[] {
  const out: ActionSpec[] = [];
  // A Drake's Ravener window: open now, or opened by an Approach or hop earlier in this script; a Bite closes it.
  const drake = s.f.sheet.aspect === 'ravener';
  let primed = drake && s.f.marks.ravener > 0;
  let prev: ActionSpec['name'] | null = null;
  while (out.length < R.SLOTS_PER_EXCHANGE) {
    const legal = legalActions(s, rng);
    // Exploring scripts still mostly skip attacks that can't reach from here.
    const explore = (x: ActionSpec) => (ACTIONS[x.name].category === 'attack' && x.name !== 'intimidate' && !(ctx.mine.attack[band(sep)][x.name] ?? 0) ? 0.1 : 1);
    const a = pick(legal, legal.map((x) => (styled ? prior(style, ctx, band(sep), s, x, { primed, prev }) : explore(x))), rng);
    prev = a.name;
    // An Approach-then-Bite setup opens the window and spends it at once.
    if (a.name === 'bite') primed = false;
    else if (drake && (a.name === 'approach' || a.name === 'leap')) primed = true;
    sep = nextSep(sep, a, s);
    s = place(out, s, a);
  }
  return out.slice(0, R.SLOTS_PER_EXCHANGE);
}
