// What a brain has learned of the opponent's defenses: how much of each of its attacks actually got through, against
// what the Referee says a clean hit on a dragon that holds would deal. Read from the public record only: the Wounds
// each slot began on, and which attacks landed. A Guard raised against it, an Affinity that held a verb, or a Surge
// reversal all show up as hits that dealt less than they should.

import type { ActionName } from '../actions.ts';
import type { View } from '../bout.ts';
import { bandOf, type Worth } from './probe.ts';

/** Before it has seen anything, it trusts the board: as if two hits had each dealt exactly their worth. */
const PRIOR_HITS = 2;
const ATTACKS: ActionName[] = ['bite', 'claw', 'breath', 'stomp'];

/** For each attack, the share of its clean-hit worth that has been getting through (1: all of it). */
export function discover(view: View, mine: Worth): Partial<Record<ActionName, number>> {
  const me = view.side;
  const them = view.opp.side;
  const pool = view.opp.sheet.wounds;
  const seen: Partial<Record<ActionName, { got: number; worth: number }>> = {};
  view.record.forEach((r, i) => {
    const a = r.actions[me];
    if (!ATTACKS.includes(a) || !r.landed[me]) return;
    const expected = (mine.attack[bandOf(r.separation)][a] ?? 0) * pool;
    if (expected <= 0) return;
    const after = i + 1 < view.record.length ? view.record[i + 1].wounds[them] : view.opp.wounds;
    const got = Math.max(0, r.wounds[them] - after);
    const s = (seen[a] ??= { got: 0, worth: 0 });
    s.got += got;
    s.worth += expected;
  });
  const out: Partial<Record<ActionName, number>> = {};
  for (const a of ATTACKS) {
    const s = seen[a];
    const unit = (mine.attack.melee[a] || mine.attack.close[a] || mine.attack.far[a] || 0) * pool;
    out[a] = s && unit > 0 ? (s.got + PRIOR_HITS * unit) / (s.worth + PRIOR_HITS * unit) : 1;
  }
  return out;
}
