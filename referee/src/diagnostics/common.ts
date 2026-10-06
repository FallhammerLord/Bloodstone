// What the diagnostics share: the twelve core pairings, the general styles, and one seeded brain bout.

import { standardBoulders } from '../arena.ts';
import { brainController, BRAIN_STYLES, type Skill } from '../brain.ts';
import { runBout } from '../bout.ts';
import { CORE_MORPHS, type CoreStone, type Morph } from '../hatch.ts';
import { seededRandom } from '../random.ts';
import { newBout, type Bout, type Event, type FighterSetup, type Side } from '../referee.ts';
import { PACE, type Rules } from '../rules.ts';

export const MORPHS: Morph[] = CORE_MORPHS;
export const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
export const PAIRINGS: FighterSetup[] = MORPHS.flatMap((m) => STONES.map((s) => ({ name: `${m}-${s}`, morph: m, stone: s })));
export const GENERAL = BRAIN_STYLES.filter((s) => !s.endsWith('-focus'));
export const label = (f: FighterSetup) => `${f.morph} + ${f.stone}`;

/**
 * One brain bout with random general styles, the subject on side A or B by seed. The subject is the
 * challenged dragon half the time, so timeouts don't favor it.
 */
export function play(subject: FighterSetup, opponent: FighterSetup, seed: number, rules: Rules, skill: Skill = 'master'): { bout: Bout; ev: Event[]; me: Side; them: Side; style: string } {
  const rng = seededRandom(seed + 1);
  const me: Side = seed % 2 ? 'A' : 'B';
  const them: Side = me === 'A' ? 'B' : 'A';
  const sides = { [me]: subject, [them]: opponent } as Record<Side, FighterSetup>;
  const style = GENERAL[Math.floor(rng() * GENERAL.length)];
  const theirStyle = GENERAL[Math.floor(rng() * GENERAL.length)];
  const arenaSeed = seed * 17 + 3;
  const bout = newBout(sides.A, sides.B, rules.START_SEPARATION / PACE, seed % 4 < 2 ? 'A' : 'B', { boulders: standardBoulders(arenaSeed, rules), seed: arenaSeed }, rules);
  const controllers = { [me]: brainController(style, skill, seed * 2 + 1), [them]: brainController(theirStyle, skill, seed * 2 + 2) } as Record<Side, ReturnType<typeof brainController>>;
  return { bout, ev: runBout(bout, controllers), me, them, style };
}

/** Adds numbers into a keyed tally. */
export const bump = (o: Record<string, number>, k: string, v = 1) => (o[k] = (o[k] ?? 0) + v);

/** Merges tallies from workers: numbers add, arrays (lists of samples) concatenate, objects merge key by key. */
export function merge<T>(parts: T[]): T {
  const into = (a: unknown, b: unknown): unknown => {
    if (typeof a === 'number' && typeof b === 'number') return a + b;
    if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b)) out[k] = k in out ? into(out[k], v) : v;
      return out;
    }
    return b ?? a;
  };
  return parts.reduce((acc, p) => into(acc, p) as T);
}
