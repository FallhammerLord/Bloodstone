// 3. Values: how each style scores an imagined outcome.

import { inZone, obstacleAt } from '../arena.ts';
import { matchup } from '../hatch.ts';
import { add, flat, flatLen, scaleTo, sub } from '../geometry.ts';
import type { Bout, Event, Fighter, Side } from '../referee.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import { type Band, type BrainStyle, MISS_TASTE, TASTE, bandOf, idealBands } from './styles.ts';

export interface Outcome {
  before: Bout;
  after: Bout;
  events: Event[];
  me: Side;
}

/**
 * What every style reads, whatever it values most [Proposed]. Damage is in fractions of a Wounds pool, so a weight
 * of 0.03 is worth about 3% of a dragon's Wounds.
 */
export const SHARED = {
  /** a target with a wall or obstacle within a band behind it can be slammed and can't retreat; the reverse for you */
  pinned: 0.03,
  /** breaking the opponent's charge denies its setup */
  chargeBroken: 0.04,
  /** each point of your own meter filled brings a true-damage hit, or a guard reversal, closer */
  meterGain: 0.0015,
  /** each point of the opponent's meter filled is worth denying */
  oppMeterGain: 0.0008,
  /**
   * a full meter held: the next landed hit deals true damage, and Scales or Dodge reverses an attack onto its owner;
   * an opponent's full meter is the same threat against you, so Breath and Bite into its guard are a risk
   */
  fullMeter: 0.03,
  /** Snapping Jaw (borrow): per tick of wind-up a dragon owes its next slot */
  snapDebt: 0.002,
  /** Ratchet Claws (escalate): per point the next Claw is ratcheted up */
  ratchet: 0.006,
  /** Lockjaw (clamp): a jaw clamped shut can't Bite next slot */
  clamped: 0.01,
  /** Ash Gland (cloud): ending a slot in an enemy cloud means a Blinded next slot, as a fraction of Wounds */
  ashThreat: 0.03,
  /** Ash Gland (cloud): ash clinging to a dragon Blinds it through the exchange, then falls as a cloud where it stands */
  ashStuck: 0.02,
  /** a pending Intimidate bonus, yours or theirs, still counts when the slot ends */
  intimidatePending: 0.03,
  /** a pending demoralize on either side */
  demoralizePending: 0.03,
  /** a setup on the board: the next Bite lunges or the next Claw pounces */
  setupPending: 0.02,
  /** ending in your own ideal band */
  idealBand: 0.04,
  /** per band away from your ideal */
  offBand: 0.015,
  /** keeping the opponent out of its ideal band */
  denyBand: 0.015,
  /** per forced miss (whiff, near miss or evade), times the style's MISS_TASTE */
  forcedMiss: 0.02,
  /** MISS_TASTE for a style that doesn't name one */
  missTasteDefault: 0.6,
  /**
   * ending a slot in an enemy's live floor zone: about one more burn (or a corrosion) unless it steps out, as a
   * fraction of its Wounds; an opponent standing in yours counts the other way
   */
  zoneStanding: 1,
  /** a Staggered opponent, per slot left (it moves and tests Evasion on half); being Staggered, the reverse */
  staggerPending: 0.02,
  /** a Wyvern ending aloft within a stoop's reach of a grounded opponent (a band's carry plus Claw): this share of the stoop it threatens next exchange */
  stoopPending: 0.5,
  /** a corroded opponent: about one more hit's bonus (and its Acumen) before it wears off; being corroded, the reverse */
  corrodedPending: 1,
  /** a corrosive pool's threat (the old pool rule), in burn-equivalent points per slot (it costs Hardness, not Wounds) */
  corrosionThreat: 1.5,
  /** standing on the outer rim when the pulses come */
  rim: -0.15,
};

/**
 * Each style's own values [Proposed]: how much damage taken hurts against damage dealt (always 1), where it wants
 * the fight, and what else it counts. Unlisted terms are 0.
 */
interface StyleWeights {
  /** damage taken, against damage dealt at 1 */
  taken: number;
  /** ending the slot in each band */
  band?: Partial<Record<Band, number>>;
  /** per link of its current chain */
  chain?: number;
  /** per hit of 9 or more */
  big?: number;
  /** per forced miss, on top of the shared term */
  misses?: number;
  /** per punish landed */
  punishes?: number;
  /** holding an Intimidate bonus */
  intimidateHeld?: number;
  /** aloft within a stoop's reach of a grounded opponent */
  perch?: number;
  /** the opponent can't revise next exchange (Ash Gland) */
  revisionLocked?: number;
  /** a Baleful Eye reveal pending */
  eye?: number;
  /** per charged hit released */
  released?: number;
  /** holding a charge on the board */
  charging?: number;
  /** per point of its own meter filled, on top of the shared term */
  meterGain?: number;
  /** per true-damage hit spent */
  spent?: number;
}

const WEIGHTS: Record<BrainStyle, StyleWeights> = {
  // presses in and builds chains
  swarmer: { taken: 0.8, band: { melee: 0.08, close: 0.04, far: -0.04, veryFar: -0.04 }, chain: 0.04 },
  // fights from Far and hates being hit
  'out-boxer': { taken: 1.3, band: { far: 0.08, close: 0, melee: -0.1, veryFar: -0.02 } },
  // trades for big hits and punishes, behind an Intimidate
  slugger: { taken: 0.8, big: 0.05, punishes: 0.05, intimidateHeld: 0.04 },
  // makes them miss, then punishes
  counterpuncher: { taken: 1.4, misses: 0.04, punishes: 0.06 },
  // even trades, nothing else: the baseline
  'boxer-puncher': { taken: 1 },
  // takes the high ground over a grounded opponent
  aerialist: { taken: 1, perch: 0.06 },
  // denies the opponent its revision and reads its slot 3
  reader: { taken: 1, revisionLocked: 0.05, eye: 0.03 },
  // diagnostic: holds Far and makes them chase
  'kite-focus': { taken: 1.2, band: { far: 0.08, close: 0, melee: -0.08, veryFar: 0.02 }, misses: 0.05 },
  // diagnostic: plays two-slot charges
  'charge-focus': { taken: 1, released: 0.06, charging: 0.03 },
  // diagnostic: fills the meter and spends it
  'meter-focus': { taken: 1, meterGain: 0.004, spent: 0.06 },
  // diagnostics: being at the focus range is worth a little; landing the focus attack is the point
  'claw-focus': { taken: 1, band: { melee: 0.08, close: 0, far: -0.06, veryFar: -0.06 } },
  'bite-focus': { taken: 1, band: { close: 0.08, melee: 0.08, far: 0, veryFar: -0.06 } }, // Bite reaches through Close, Melee included
  'breath-focus': { taken: 1, band: { far: 0.08, close: 0, veryFar: 0, melee: -0.06 } },
};

/** How a style scores an imagined outcome. Damage is in fractions of a Wounds pool. */
export function value(style: BrainStyle, o: Outcome): number {
  const them: Side = o.me === 'A' ? 'B' : 'A';
  const me0 = o.before.fighters[o.me];
  const me1 = o.after.fighters[o.me];
  const op0 = o.before.fighters[them];
  const op1 = o.after.fighters[them];
  const dealt = (op0.wounds - Math.max(0, op1.wounds)) / op0.sheet.wounds;
  const taken = (me0.wounds - Math.max(0, me1.wounds)) / me0.sheet.wounds;
  if (o.after.over) return o.after.winner === o.me ? 10 + dealt : -10 - taken;
  // The clock: at the exchange limit the bout times out, and the challenged dragon wins [Doc].
  if (o.after.exchange >= o.after.rules.EXCHANGE_LIMIT) return o.after.challenged === o.me ? 10 + dealt : -10 - taken;

  const sep = Math.hypot(me1.pos.x - op1.pos.x, me1.pos.y - op1.pos.y, me1.pos.z - op1.pos.z);
  const band = bandOf(sep);
  const myHits = o.events.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit' && e.attacker === o.me);
  const big = myHits.filter((h) => h.damage >= 9).length;
  const punishes = myHits.filter((h) => h.tags.includes('punish')).length;
  const theirMisses = o.events.filter((e) => (e.kind === 'whiff' || e.kind === 'nearMiss' || e.kind === 'evade') && e.attacker === them).length;
  const late = o.after.exchange >= o.after.rules.EXCHANGE_LIMIT - 3 && flatLen(me1.pos) >= o.after.rules.ARENA_RADIUS - o.after.rules.RIM_DEPTH;
  const rim = late ? SHARED.rim : 0;

  // Leverage, the meter, what's pending when the slot ends, position and forced misses: every style reads these.
  const W = SHARED;
  const leverage = (pinned(o.after, op1, me1) ? W.pinned : 0) - (pinned(o.after, me1, op1) ? W.pinned : 0)
    + W.chargeBroken * o.events.filter((e) => e.kind === 'note' && e.side === them && e.tag === 'charge-broken').length
    + W.meterGain * Math.max(0, me1.meter - me0.meter) - W.oppMeterGain * Math.max(0, op1.meter - op0.meter)
    + (me1.meter >= R.METER_MAX ? W.fullMeter : 0) - (op1.meter >= R.METER_MAX ? W.fullMeter : 0)
    + techniqueCarryOver(me1, op1)
    + (me1.intimidateBonus ? W.intimidatePending : 0) - (op1.intimidateBonus ? W.intimidatePending : 0)
    + (op1.marks.demoralized ? W.demoralizePending : 0) - (me1.marks.demoralized ? W.demoralizePending : 0)
    // A setup counts while its follow-up can reach: a lunging Bite from Close, a pouncing Claw from a band past its arc.
    + ((me1.marks.advanced && sep <= R.CLOSE_EDGE + o.after.rules.BITE_LUNGE) || (me1.marks.strafed && sep <= o.after.rules.POUNCE_REACH + o.after.rules.CLAW_REACH) ? W.setupPending : 0)
    + W.zoneStanding * (zoneThreat(o.after, op1) - zoneThreat(o.after, me1))
    + W.staggerPending * (staggerLeft(op1) - staggerLeft(me1))
    + W.stoopPending * (stoopThreat(o.after, me1, op1) - stoopThreat(o.after, op1, me1))
    + W.corrodedPending * ((op1.marks.corrosion?.bonus ?? 0) / op1.sheet.wounds - (me1.marks.corrosion?.bonus ?? 0) / me1.sheet.wounds)
    + positionValue(style, band, me1, op1)
    + W.forcedMiss * (MISS_TASTE[style] ?? W.missTasteDefault) * theirMisses;
  return leverage + styleValue(style, o, { dealt, taken, band, sep, me1, op1, big, punishes, theirMisses, rim });
}

export const BAND_ORDER: Band[] = ['melee', 'close', 'far', 'veryFar'];
export function positionValue(style: BrainStyle, band: Band, me: Fighter, op: Fighter): number {
  const at = BAND_ORDER.indexOf(band);
  const away = Math.min(...idealBands(me, TASTE[style]).map((b) => Math.abs(at - BAND_ORDER.indexOf(b))));
  const theirs = idealBands(op, { claw: 1, bite: 1, breath: 1 });
  return (away === 0 ? SHARED.idealBand : -SHARED.offBand * away) + (theirs.includes(band) ? 0 : SHARED.denyBand);
}

/** Slots of Stagger still ahead of a dragon. */
const staggerLeft = (f: Fighter) => (f.pending.staggered ? 1 : 0) + f.marks.staggerExtra;

/**
 * Whether a Wyvern aloft could stoop on a grounded target next: the stoop carries at most a band, then claws, so the
 * target must be within a band plus Claw's reach across the floor. A Wyvern hovering at Far can't; at Close it can.
 */
export function inStoopReach(rules: Rules, f: Fighter, target: Fighter): boolean {
  if (f.sheet.aspect !== 'talons' || f.pos.z === 0 || target.pos.z !== 0) return false;
  if (Math.hypot(f.pos.x - target.pos.x, f.pos.y - target.pos.y, f.pos.z) > rules.STOOP_RANGE) return false;
  return Math.hypot(f.pos.x - target.pos.x, f.pos.y - target.pos.y) <= rules.STOOP_CARRY + rules.CLAW_REACH;
}

/** The stoop a Wyvern aloft threatens a grounded target in reach next exchange, as a fraction of the target's Wounds. */
function stoopThreat(b: Bout, f: Fighter, target: Fighter): number {
  if (!inStoopReach(b.rules, f, target)) return 0;
  const hit = f.sheet.claw + (b.rules.STOOP_PACES_PER_POINT ? Math.floor(f.pos.z / (R.PACE * b.rules.STOOP_PACES_PER_POINT)) : 0) - target.sheet.hardness;
  return Math.max(b.rules.DAMAGE_FLOOR, hit) / target.sheet.wounds;
}

/** What the enemy's live floor zones threaten a dragon standing where it is: its next slot's burn, as a fraction of its Wounds. */
export function zoneThreat(b: Bout, f: Fighter): number {
  let worst = 0;
  for (const z of b.arena.zones) {
    // A hanging smolder is the old Smoldering Maw; verb ground (linger) and ash clouds count.
    if (z.owner === f.side || (z.kind === 'smolder' && !z.floor) || z.lastSlot < b.globalSlot || !inZone(z, f.pos)) continue;
    if (z.kind === 'ash') {
      worst = Math.max(worst, SHARED.ashThreat * f.sheet.wounds);
      continue;
    }
    if (z.kind === 'smolder') {
      worst = Math.max(worst, b.rules.TECHNIQUE_POINTS);
      continue;
    }
    const wheel = b.rules.ZONE_MATCHUP ? matchup(b.fighters[z.owner].sheet.stone, f.sheet.stone) * b.rules.MATCHUP : 0;
    worst = Math.max(worst, z.kind === 'burning' ? Math.max(b.rules.DAMAGE_FLOOR, (z.damage ?? b.rules.BURN_DAMAGE) + wheel) : SHARED.corrosionThreat);
  }
  return worst / f.sheet.wounds;
}

/** A wall or obstacle within a band behind this dragon, measured away from the other one. */
export function pinned(b: Bout, f: Fighter, from: Fighter): boolean {
  const back = flat(sub(f.pos, from.pos));
  if (flatLen(back) === 0) return false;
  for (let k = 1; k <= R.BAND / R.PACE; k++) {
    const p = add(f.pos, scaleTo(back, k * R.PACE));
    if (flatLen(p) > b.rules.ARENA_RADIUS || obstacleAt(b.arena, p, b.rules)) return true;
  }
  return false;
}

export interface Scored {
  dealt: number;
  taken: number;
  band: Band;
  sep: number;
  me1: Fighter;
  op1: Fighter;
  big: number;
  punishes: number;
  theirMisses: number;
  rim: number;
}

export /** A style's own terms, from its WEIGHTS. The terms add in a fixed order, so every style's sum is reproducible. */
function styleValue(style: BrainStyle, o: Outcome, { dealt, taken, band, sep, me1, op1, big, punishes, theirMisses, rim }: Scored): number {
  const w = WEIGHTS[style];
  const count = (test: (e: Event) => boolean) => o.events.filter(test).length;
  const me0 = o.before.fighters[o.me];
  return dealt - w.taken * taken
    + (w.band?.[band] ?? 0)
    + (w.chain ? w.chain * me1.chain.links : 0)
    + (w.big ? w.big * big : 0)
    + (w.misses ? w.misses * theirMisses : 0)
    + (w.punishes ? w.punishes * punishes : 0)
    + (w.intimidateHeld && me1.intimidateBonus ? w.intimidateHeld : 0)
    + (w.perch && inStoopReach(o.after.rules, me1, op1) ? w.perch : 0)
    + (w.revisionLocked && op1.marks.revisionLockedFor > o.after.exchange ? w.revisionLocked : 0)
    + (w.eye && me1.marks.eye !== null ? w.eye : 0)
    + (w.released ? w.released * count((e) => e.kind === 'hit' && e.attacker === o.me && e.tags.includes('charged')) : 0)
    + (w.charging && me1.marks.charge ? w.charging : 0)
    + (w.meterGain ? w.meterGain * Math.max(0, me1.meter - me0.meter) : 0)
    + (w.spent ? w.spent * count((e) => e.kind === 'note' && e.side === o.me && e.tag === 'meter-spent') : 0)
    + rim;
}

/** Technique carry-overs the look-ahead's last slot can't see play out (technique parity pass 1): debt owed, ratchet held, a clamped jaw. */
export function techniqueCarryOver(me: Fighter, op: Fighter): number {
  const W = SHARED;
  return -W.snapDebt * (me.marks.snapDebt - op.marks.snapDebt)
    + W.ratchet * (me.marks.ratchet - op.marks.ratchet)
    - W.clamped * ((me.marks.clamped ? 1 : 0) - (op.marks.clamped ? 1 : 0))
    - W.ashStuck * ((me.marks.ashStuck ? 1 : 0) - (op.marks.ashStuck ? 1 : 0));
}
