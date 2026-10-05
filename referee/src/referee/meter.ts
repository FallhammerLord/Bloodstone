// The Acumen meter [Proposed]: triggers fill it; full, the next landed Bite, Claw or Breath is true damage.

import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import type { Event } from './events.ts';
import { eff } from './riders.ts';
import type { Fighter } from './state.ts';

/** One Acumen trigger: Affinity + the base fill (9) into the meter, capped full [Proposed]. */
export function fillMeter(rules: Rules, f: Fighter, why: string, t: number, ev: Event[]) {
  if (f.meter >= R.METER_MAX) return;
  const amount = rules.METER_BASE_FILL + Math.max(0, eff(f, 'affinity', {}).value);
  f.meter = Math.min(R.METER_MAX, f.meter + amount);
  ev.push({ kind: 'note', tick: t, side: f.side, text: `Acumen meter +${amount} (${why}): ${f.meter}${f.meter >= R.METER_MAX ? ', full' : ''}.` });
}
