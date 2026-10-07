// What each attack is worth from each band, asked of the Referee itself: one probe slot per attack and band, against
// a target that holds. Every rule (Hardness, Affinity, the element wheel, pierce, Surge, Techniques) is in the answer,
// so the brains never carry a copy of the damage math.

import type { ActionName, ActionSpec } from '../actions.ts';
import { cloneBout, other, simulateSlot, type Bout, type Side } from '../referee.ts';
import * as R from '../rules.ts';

export type Band = 'melee' | 'close' | 'far' | 'veryFar';
export const bandOf = (sep: number): Band => (sep <= R.MELEE_EDGE ? 'melee' : sep <= R.CLOSE_EDGE ? 'close' : sep <= R.FAR_EDGE ? 'far' : 'veryFar');
/** The next band in, and out. */
export const closer: Record<Band, Band> = { melee: 'melee', close: 'melee', far: 'close', veryFar: 'far' };
export const farther: Record<Band, Band> = { melee: 'close', close: 'far', far: 'veryFar', veryFar: 'veryFar' };

/** Where each band is probed: mid-band, on open ground. */
const PROBE_SEP: Record<Exclude<Band, 'veryFar'>, number> = { melee: 2 * R.PACE, close: Math.floor(4.5 * R.PACE), far: Math.floor(7.5 * R.PACE) };
const ATTACKS: ActionSpec[] = [{ name: 'claw', sweep: 'left' }, { name: 'bite' }, { name: 'breath' }, { name: 'stomp' }];

export interface Worth {
  /** damage per landed attempt, as a fraction of the target's Wounds pool, by band and attack */
  attack: Record<Band, Partial<Record<ActionName, number>>>;
  /** the best of those, by band */
  best: Record<Band, number>;
}

/** What `att` deals the other dragon with each attack from each band, if it lands on a target that holds. */
export function worth(b: Bout, att: Side): Worth {
  const def = other(att);
  const attack = { melee: {}, close: {}, far: {}, veryFar: {} } as Worth['attack'];
  const best = { melee: 0, close: 0, far: 0, veryFar: 0 } as Worth['best'];
  for (const band of ['melee', 'close', 'far'] as const) {
    for (const a of ATTACKS) {
      const t = cloneBout(b);
      t.over = false;
      t.arena = { obstacles: [], zones: [] };
      const half = Math.floor(PROBE_SEP[band] / 2);
      t.fighters[att].pos = { x: -half, y: 0, z: 0 };
      t.fighters[def].pos = { x: PROBE_SEP[band] - half, y: 0, z: 0 };
      t.fighters[att].readyAt = {};
      t.fighters[att].marks = { ...t.fighters[att].marks, charge: null };
      t.fighters[def].marks = { ...t.fighters[def].marks, charge: null };
      const before = t.fighters[def].wounds;
      simulateSlot(t, { [att]: a, [def]: { name: 'hold' } } as Record<Side, ActionSpec>);
      const v = Math.max(0, before - t.fighters[def].wounds) / b.fighters[def].sheet.wounds;
      attack[band][a.name] = v;
      best[band] = Math.max(best[band], v);
    }
  }
  return { attack, best };
}
