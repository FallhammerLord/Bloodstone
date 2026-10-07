// What an imagined exchange produced, as features on the scales in archetypes.ts, and its value to an archetype.

import { inZone } from '../arena.ts';
import { flatLen } from '../geometry.ts';
import { other, type Bout, type Event, type Fighter, type Side } from '../referee.ts';
import * as R from '../rules.ts';
import { FEATURES, GOALS, PERCH_GROUNDED, SCALE, type Archetype, type Feature, type Goals } from './archetypes.ts';
import { bandOf, type Worth } from './probe.ts';

export interface Outcome {
  before: Bout;
  after: Bout;
  events: Event[];
  me: Side;
}

/** What a brain knows going in: both dragons' attack worth from each band, measured on the Referee. */
export interface Context {
  mine: Worth;
  theirs: Worth;
}

const sepOf = (b: Bout) => {
  const A = b.fighters.A.pos, B = b.fighters.B.pos;
  return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
};

/** Setups, held bonuses and chain links that pay off in a later slot. */
function tempo(b: Bout, f: Fighter, sep: number): number {
  const m = f.marks;
  let t = 0;
  if (m.advanced && sep <= R.CLOSE_EDGE + b.rules.BITE_LUNGE) t++; // the next Bite lunges
  if (m.strafed && sep <= b.rules.POUNCE_REACH + b.rules.CLAW_SIDE) t++; // the next Claw pounces
  if (m.ravener > 0 && sep <= R.CLOSE_EDGE + b.rules.BAND_MOVE) t++; // a Drake's window, a move from Close
  if (f.intimidateBonus) t++;
  if (m.ratchet > 0) t++;
  if (m.diveBonus) t++;
  if (m.charge) t++;
  return t + f.chain.links / 3;
}

/** Lasting harms waiting on a dragon next slot: statuses, debts and clinging ash. */
function burdens(f: Fighter): number {
  const p = f.pending;
  let n = [p.staggered, p.pinned, p.rattled, p.blinded, p.corroded, p.slowed, p.grounded].filter(Boolean).length;
  n += f.marks.staggerExtra + (f.marks.demoralized ? 1 : 0) + (f.marks.clamped ? 1 : 0) + (f.marks.snapDebt > 0 ? 1 : 0);
  n += (f.marks.ashStuck ? 1 : 0) + (f.marks.corrosion ? 1 : 0);
  return n;
}

/** Standing in the opponent's zones, or on the rim when the pulses come. */
function exposed(b: Bout, f: Fighter): number {
  let n = b.arena.zones.some((z) => z.owner !== f.side && z.lastSlot >= b.globalSlot && inZone(z, f.pos)) ? 1 : 0;
  const late = b.exchange >= b.rules.EXCHANGE_LIMIT - 3;
  if (late && flatLen(f.pos) >= b.rules.ARENA_RADIUS - b.rules.RIM_DEPTH) n++;
  return n;
}

/** A flier aloft over a grounded opponent within stoop reach holds the high ground. */
function perched(b: Bout, f: Fighter, opp: Fighter): number {
  if (f.sheet.aspect !== 'talons' || f.pos.z === 0 || opp.pos.z !== 0) return 0;
  return Math.hypot(f.pos.x - opp.pos.x, f.pos.y - opp.pos.y) <= b.rules.STOOP_RANGE ? 1 : 0;
}

export function features(o: Outcome, ctx: Context): Goals {
  const them = other(o.me);
  const me0 = o.before.fighters[o.me], op0 = o.before.fighters[them];
  const me1 = o.after.fighters[o.me], op1 = o.after.fighters[them];
  const sep = sepOf(o.after);
  const band = bandOf(sep);
  const mineHits = o.events.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit' && e.attacker === o.me);
  const misses = o.events.filter((e) => (e.kind === 'whiff' || e.kind === 'evade' || e.kind === 'nearMiss') && e.attacker === them).length;
  const full = (f: Fighter) => (f.meter >= R.METER_MAX ? 0.5 : 0);
  return {
    dealt: (op0.wounds - op1.wounds) / op0.sheet.wounds,
    taken: -(me0.wounds - me1.wounds) / me0.sheet.wounds,
    reach: ctx.mine.best[band],
    exposure: -ctx.theirs.best[band],
    misses,
    punish: mineHits.filter((h) => h.tags.includes('punish')).length,
    big: mineHits.filter((h) => h.damage >= op0.sheet.wounds / 5).length,
    tempo: tempo(o.after, me1, sep) - tempo(o.after, op1, sep),
    surge: (me1.meter - op1.meter) / R.METER_MAX + full(me1) - full(op1),
    status: burdens(op1) - burdens(me1),
    ground: exposed(o.after, op1) - exposed(o.after, me1),
    perch: perched(o.after, me1, op1) - perched(o.after, op1, me1),
  };
}

/** An archetype's value of an outcome: its goals over the features, plus winning or losing outright. */
export function value(style: Archetype, o: Outcome, ctx: Context): number {
  const f = features(o, ctx);
  const goals = GOALS[style];
  const me = o.after.fighters[o.me];
  // The challenged wins a timeout, so late in a bout the challenger needs damage and the challenged needs only to last.
  const late = o.after.exchange >= o.after.rules.EXCHANGE_LIMIT - 2;
  const challenger = o.after.challenged !== o.me;
  const urgency: Partial<Goals> = late ? (challenger ? { dealt: 1.5 } : { taken: 1.5 }) : {};
  let v = 0;
  for (const k of FEATURES) {
    const w = (k === 'perch' && !me.sheet.flies ? PERCH_GROUNDED : 1) * goals[k] * (urgency[k as Feature] ?? 1);
    v += w * SCALE[k] * f[k];
  }
  if (o.after.over) v += o.after.winner === o.me ? 2 : -2;
  return v;
}
