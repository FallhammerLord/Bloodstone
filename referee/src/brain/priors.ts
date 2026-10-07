// Which scripts a brain imagines: actions weighted by how well they serve its goals from where it will stand, using
// the Referee's attack worth. These only steer what gets imagined; the choice itself is made by playing it out.

import { ACTIONS, type ActionSpec } from '../actions.ts';
import * as R from '../rules.ts';
import { GOALS, type Archetype } from './archetypes.ts';
import type { Context } from './features.ts';
import { legalActions, place, type Situation } from './options.ts';
import { closer, farther, type Band } from './probe.ts';
import { pick } from './read.ts';

/** How much a band is worth standing in: its own reach against the opponent's, by the archetype's goals. */
export function bandScore(style: Archetype, ctx: Context, band: Band): number {
  const g = GOALS[style];
  return g.reach * ctx.mine.best[band] - g.exposure * ctx.theirs.best[band];
}

/** How readily an archetype imagines an action from a band. */
export function prior(style: Archetype, ctx: Context, band: Band, s: Situation, a: ActionSpec, primed = false): number {
  const g = GOALS[style];
  const here = bandScore(style, ctx, band);
  const move = (to: Band) => Math.max(0.15, 1 + 8 * (bandScore(style, ctx, to) - here));
  let w: number;
  if (a.setup) w = (prior(style, ctx, band, s, { name: a.setup }) + prior(style, ctx, band === 'veryFar' ? 'far' : band, s, { name: a.name })) / 2;
  else if (ACTIONS[a.name].category === 'attack' && a.name !== 'intimidate') {
    w = 0.1 + 10 * (ctx.mine.attack[band][a.name] ?? 0) * (g.dealt + 0.3 * g.big);
    // A Drake's open Ravener window: its next Bite lunges and tracks, so it reaches for the Bite.
    if (primed && a.name === 'bite') w = 2 * w + 0.3 * g.payoff;
  } else if (a.name === 'approach' || (a.name === 'leap' && s.f.sheet.aspect === 'ravener')) w = move(closer[band]) * (1 + 0.25 * g.pursuit);
  else if (a.name === 'retreat') w = move(farther[band]);
  else if (a.name === 'strafe') w = 0.4 + 0.3 * g.misses + 0.2 * g.free;
  else if (a.name === 'dodge') w = 0.2 + 5 * ctx.theirs.best[band] * g.taken + 0.3 * g.misses + 0.2 * g.free;
  else if (a.name === 'scales') w = 0.2 + 5 * ctx.theirs.best[band] * g.taken;
  else if (a.name === 'intimidate') w = 0.2 + 0.15 * (g.punish + g.big);
  else if (a.name === 'leap' || a.name === 'dive') w = s.f.sheet.flies ? 0.6 : 0.2;
  else w = 0.3;
  return a.charge ? 0.5 * w : a.crunch ? 1.3 * w : w;
}

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
  while (out.length < R.SLOTS_PER_EXCHANGE) {
    const legal = legalActions(s, rng);
    const a = pick(legal, legal.map((x) => (styled ? prior(style, ctx, band(sep), s, x, primed) : 1)), rng);
    // An Approach-then-Bite setup opens the window and spends it at once.
    if (a.name === 'bite') primed = false;
    else if (drake && (a.name === 'approach' || a.name === 'leap')) primed = true;
    sep = nextSep(sep, a, s);
    s = place(out, s, a);
  }
  return out.slice(0, R.SLOTS_PER_EXCHANGE);
}
