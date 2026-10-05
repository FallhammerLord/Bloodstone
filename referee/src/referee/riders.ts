// Attributes as they stand right now: the compiled sheet plus shard riders whose condition holds.

import { matchup } from '../hatch.ts';
import { type Attr, type Condition } from '../shards.ts';
import * as R from '../rules.ts';
import type { Fighter } from './state.ts';

export interface RiderContext {
  opp?: Fighter;
  scales?: boolean;
  link?: number;
  sep?: number;
}

export function riderHolds(c: Condition, f: Fighter, ctx: RiderContext): boolean {
  switch (c) {
    case 'halfWounds': return f.wounds * 2 <= f.sheet.wounds;
    case 'aloft': return f.pos.z > 0;
    case 'scales': return ctx.scales === true;
    case 'altitudeDiff': return ctx.opp !== undefined && ctx.opp.pos.z !== f.pos.z;
    case 'chainFinal': return ctx.link === 3;
    case 'crunchedDifferent': return false; // crunch isn't built yet
    case 'targetFar': return ctx.sep !== undefined && ctx.sep > R.CLOSE_EDGE && ctx.sep <= R.FAR_EDGE;
    case 'beatsMyStone': return ctx.opp !== undefined && matchup(ctx.opp.sheet.stone, f.sheet.stone) === 1;
  }
}

/** An attribute as it stands right now: the compiled sheet plus any shard riders whose condition holds. */
export function eff(f: Fighter, attr: Attr, ctx: RiderContext): { value: number; note: string } {
  let value = f.sheet[attr];
  let bonus = 0;
  for (const r of f.loadout.riders) {
    if (r.attr === attr && riderHolds(r.condition, f, ctx)) bonus += r.points;
  }
  value += bonus;
  return { value, note: bonus ? ` (+${bonus} shard rider)` : '' };
}
