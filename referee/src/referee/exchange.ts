// The exchange and the slot: scripts in, revisions at the window, slot-end bookkeeping.

import { ACTIONS, HOLD, describe, type ActionSpec } from '../actions.ts';
import { add, dist, flat, flatLen, scaleTo, sub, type Vec } from '../geometry.ts';
import { obstacleAt } from '../arena.ts';
import * as R from '../rules.ts';
import { zonesAtSlotEnd } from './elements.ts';
import type { Event, PlanInfo } from './events.ts';
import { fillMeter } from './meter.ts';
import { type Plan, category, makePlan } from './plan.ts';
import { A, type Bout, E, type Fighter, J, SIDES, type Side, V, W, noChain, noStatuses, other, tech } from './state.ts';
import { tick } from './tick.ts';

/** Revision moments: the end of slot 1 or the end of slot 2, before slot 3 begins. */
export type Moment = 1 | 2;

/**
 * Asked at each revision moment while the side still has its one revision. Sees the bout as it stands
 * (everything is visible) and whether the opponent has already revised (the flash). Returns a new
 * slot 3, or null to keep it. Both sides decide from the same moment, so same-moment revisions are simultaneous.
 */
export type Reviser = (bout: Bout, side: Side, moment: Moment, opponentRevised: boolean, revealed: string | null) => ActionSpec | null;

/** Baleful Eye: what the eye shows of the opponent's scripted slot 3, by grade [Doc]. */
export function reveal(spec: ActionSpec, rank: number): string {
  const cat = ACTIONS[spec.name].category;
  if (rank >= V) return describe(spec);
  if (rank >= E) return ACTIONS[spec.name].label;
  if (rank >= J) return cat;
  return cat === 'attack' ? 'attack' : 'not an attack';
}

export interface ExchangeOptions {
  trace?: boolean;
  revise?: Partial<Record<Side, Reviser>>;
}

export function runExchange(bout: Bout, scripts: Record<Side, ActionSpec[]>, opts: ExchangeOptions = {}): Event[] {
  const ev: Event[] = [];
  if (bout.over) return ev;
  bout.exchange++;
  ev.push({ kind: 'exchangeStart', exchange: bout.exchange });
  for (const s of SIDES) bout.fighters[s].marks.aloftAtStart = bout.fighters[s].pos.z > 0;
  for (const s of SIDES) {
    const f = bout.fighters[s];
    f.chain.hitThisExchange = false;
    f.chain.scalesThisExchange = false;
    f.marks.eye = null;
    bout.startWounds[s] = f.wounds;
    if (f.marks.revisionLockedFor === bout.exchange) ev.push({ kind: 'note', tick: 0, side: s, text: "Ash Gland: can't revise this exchange." });
  }
  const slots: Record<Side, ActionSpec[]> = {
    A: [0, 1, 2].map((i) => scripts.A[i] ?? HOLD),
    B: [0, 1, 2].map((i) => scripts.B[i] ?? HOLD),
  };
  const revised: Record<Side, boolean> = { A: false, B: false };

  for (let slot = 0; slot < R.SLOTS_PER_EXCHANGE && !bout.over; slot++) {
    runSlot(bout, slot, { A: slots.A[slot], B: slots.B[slot] }, ev, opts.trace ?? false);

    // The revision window: slot 3 stays live while slots 1 and 2 resolve, once per exchange [Doc].
    if (slot < 2 && !bout.over && opts.revise) {
      const moment = (slot + 1) as Moment;
      const choices: Partial<Record<Side, ActionSpec>> = {};
      for (const s of SIDES) {
        const reviser = opts.revise[s];
        const f = bout.fighters[s];
        // A charge on the board releases next slot regardless, so there's nothing to revise.
        if (!revised[s] && reviser && f.marks.revisionLockedFor !== bout.exchange && !f.marks.charge) {
          const seen = f.marks.eye !== null ? reveal(slots[other(s)][2], f.marks.eye) : null;
          const c = reviser(bout, s, moment, revised[other(s)], seen);
          if (c) choices[s] = c;
        }
      }
      for (const s of SIDES) {
        const c = choices[s];
        if (!c) continue;
        ev.push({ kind: 'revision', side: s, moment, from: describe(slots[s][2]), to: describe(c) });
        slots[s][2] = { ...c, revised: true };
        revised[s] = true;
      }
    }
  }
  if (!bout.over) for (const s of SIDES) chainAtExchangeEnd(bout.fighters[s], ev);
  if (!bout.over) for (const s of SIDES) gravity(bout, s, ev);
  return ev;
}

/**
 * Between slots, the separation across the floor snaps to the nearest ½ pace [Proposed], both dragons shifting
 * equally along their line. Nothing snaps through a wall, an obstacle, the other body or the leash.
 */
export function snapSeparation(bout: Bout) {
  const A = bout.fighters.A;
  const B = bout.fighters.B;
  const line = flat(sub(B.pos, A.pos));
  const d = flatLen(line);
  if (d === 0) return;
  const target = Math.round(d / R.SNAP) * R.SNAP;
  const diff = target - d;
  if (diff === 0) return;
  const half = scaleTo(line, Math.trunc(diff / 2));
  const nA = { ...sub(A.pos, half), z: A.pos.z };
  const nB = { ...add(B.pos, scaleTo(line, diff - Math.trunc(diff / 2))), z: B.pos.z };
  const ok = (p: Vec) => flatLen(p) <= R.ARENA_RADIUS && !obstacleAt(bout.arena, p);
  if (!ok(nA) || !ok(nB) || dist(nA, nB) < R.BODY_GAP || dist(nA, nB) > R.LEASH) return;
  A.pos = nA;
  B.pos = nB;
}

/** Gravity [Proposed]: a flier that didn't Leap this exchange drops a band at its end, landing on anything below. */
export function gravity(bout: Bout, s: Side, ev: Event[]) {
  const f = bout.fighters[s];
  if (f.pos.z === 0 || bout.history[s].slice(-R.SLOTS_PER_EXCHANGE).includes('leap')) return;
  let z = Math.max(0, f.pos.z - R.GRAVITY_DROP);
  const below = obstacleAt(bout.arena, { ...f.pos, z });
  if (below) z = Math.max(z, below.height);
  f.pos = { ...f.pos, z };
  ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: s, text: z === 0 ? 'No Leap this exchange: gravity brings it down to land.' : `No Leap this exchange: gravity drops it to ${(z / R.PACE).toFixed(1)} paces.` });
}

/**
 * A chain lapses only when a whole exchange passes without a landed hit. Ratchet Claws carries a Claw
 * chain through one such exchange (Wyrmling: only if it guarded with Scales; Venerable: two).
 */
export function chainAtExchangeEnd(f: Fighter, ev: Event[]) {
  const c = f.chain;
  if (c.hitThisExchange || c.links === 0) return;
  const rat = tech(f, 'ratchet-claws');
  // Ratchet Claws Elder: the escalating Claw chain holds through one hitless exchange.
  if (c.action === 'claw' && rat >= E && c.saves < 1) {
    c.saves++;
    c.resumed = true;
    ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: f.side, text: `Ratchet Claws: the Claw chain (${c.links} link${c.links > 1 ? 's' : ''}) holds through a hitless exchange.` });
    return;
  }
  ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: f.side, text: `A whole exchange without a hit: the ${ACTIONS[c.action ?? 'hold'].label} chain lapses.` });
  f.chain = noChain();
}

/**
 * Plays one slot on a bout, for an AI imagining the rest of an exchange. The real fight never calls this;
 * it runs whole exchanges. The slot number is the next one in the current exchange.
 */
export function simulateSlot(bout: Bout, specs: Record<Side, ActionSpec>): Event[] {
  const ev: Event[] = [];
  if (!bout.over) runSlot(bout, bout.globalSlot % R.SLOTS_PER_EXCHANGE, specs, ev, false);
  return ev;
}

/** Ends the bout if anyone is down. A double KO goes to the challenged [Proposed]. */
export function checkKO(bout: Bout, ev: Event[], tick: number): void {
  const F = bout.fighters;
  const down = SIDES.filter((s) => F[s].wounds <= 0);
  if (down.length === 0) return;
  for (const s of down) ev.push({ kind: 'ko', tick, side: s });
  bout.over = true;
  bout.winner = down.length === 2 ? bout.challenged : other(down[0]);
  ev.push({ kind: 'boutEnd', winner: bout.winner, reason: down.length === 2 ? 'double KO goes to the challenged' : 'KO' });
}

export function runSlot(bout: Bout, slot: number, specs: Record<Side, ActionSpec>, ev: Event[], trace: boolean) {
  const g = bout.globalSlot++;
  const F = bout.fighters;
  ev.push({ kind: 'slotStart', exchange: bout.exchange, slot: slot + 1 });

  for (const s of SIDES) {
    F[s].status = F[s].pending;
    F[s].pending = noStatuses();
  }
  const startSep = dist(F.A.pos, F.B.pos);
  const startZ = { A: F.A.pos.z, B: F.B.pos.z };
  const startWounds = { A: F.A.wounds, B: F.B.wounds };
  const breathReady = { A: (F.A.readyAt.breath ?? 0) <= g, B: (F.B.readyAt.breath ?? 0) <= g };
  const meterFull = { A: F.A.meter >= R.METER_MAX, B: F.B.meter >= R.METER_MAX };
  const prev = bout.record.at(-1);
  const prevLanded = (s: Side) => !!prev && prev.landed[s] && prev.actions[s] === specs[s].name;
  const plans: Record<Side, Plan> = {
    A: makePlan(F.A, F.B, specs.A, g, slot, prevLanded('A'), ev),
    B: makePlan(F.B, F.A, specs.B, g, slot, prevLanded('B'), ev),
  };
  checkKO(bout, ev, 0); // a goaded retreat can be the last straw

  for (let t = 0; t < R.TICKS_PER_SLOT && !bout.over; t++) {
    tick(bout, plans, t, ev);
    if (trace) ev.push({ kind: 'trace', tick: t, positions: { A: { ...F.A.pos }, B: { ...F.B.pos } } });
  }
  if (!bout.over) zonesAtSlotEnd(bout, plans, g, ev);
  if (!bout.over) snapSeparation(bout);

  for (const s of SIDES) {
    const p = plans[s];
    const f = F[s];
    if (p.landed) f.chain.hitThisExchange = true;
    if (p.spec.name === 'scales') f.chain.scalesThisExchange = true;
    if (category(p) === 'attack' && ACTIONS[p.spec.name].cooldown === 0 && p.link > 0) {
      const c = f.chain;
      if (c.action !== p.spec.name) {
        // A different attack starts a new chain.
        f.chain = { ...noChain(), hitThisExchange: c.hitThisExchange, scalesThisExchange: c.scalesThisExchange, action: p.spec.name, links: p.landed ? 1 : 0 };
      } else if (p.landed) {
        c.links = p.link;
        c.resumed = false;
        // A third link completes the chain; the next repeat starts a fresh one.
        if (c.links >= 3) f.chain = { ...noChain(), hitThisExchange: true, scalesThisExchange: c.scalesThisExchange };
      }
    }
    // Riposte Talons Adult: the Dodge cooldown penalty applies only after a failed dodge.
    if (p.spec.name === 'dodge' && !p.evaded && tech(f, 'riposte-talons') >= A) f.readyAt.dodge = (f.readyAt.dodge ?? 0) + 1;
    // Stooping Pinions: a dive from high enough adds +3 to the next attack; the next slot can't Leap below Adult.
    const sp = tech(f, 'stooping-pinions');
    if (p.spec.name === 'dive' && sp >= W && p.moved > 0 && p.startZ >= (sp === W ? R.STOOPING_HEIGHT.wyrmling : R.STOOPING_HEIGHT.rest)) {
      f.marks.diveBonus = true;
      f.marks.noLeap = sp < A;
      ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: s, text: 'Stooping Pinions: +3 to the next attack.' });
    }
    // Guarding to the end, or drawing a Breath, fills the Acumen meter [Proposed]. A broken charge fills nothing.
    if ((p.spec.name === 'scales' || p.spec.name === 'dodge') && p.interruptedAt === null) fillMeter(f, p.spec.name === 'scales' ? 'Scales' : 'Dodge', R.TICKS_PER_SLOT - 1, ev);
    if (p.charging && p.spec.name === 'breath' && f.marks.charge?.action === 'breath') fillMeter(f, 'drawing Breath', R.TICKS_PER_SLOT - 1, ev);
    bout.history[s].push(p.spec.name);
    f.marks.advanced = p.spec.name === 'approach' && p.converted === null && p.moved > 0;
    f.marks.strafed = p.spec.name === 'strafe' && p.converted === null && p.moved > 0;
  }
  bout.record.push({
    exchange: bout.exchange, slot, separation: startSep, z: startZ, wounds: startWounds,
    actions: { A: plans.A.spec.name, B: plans.B.spec.name }, landed: { A: plans.A.landed, B: plans.B.landed }, breathReady, meterFull,
  });

  const info = (p: Plan): PlanInfo => ({
    label: describe(p.spec) + (p.spec.revised ? ' (revised)' : '') + (p.converted === 'dodge' ? ' → dodge' : p.converted === 'roar' ? ' → roar' : ''),
    windup: p.windup, active: p.active, recovery: p.recovery, interruptedAt: p.interruptedAt,
    ...(p.halves ? { halves: p.halves } : {}),
  });
  ev.push({
    kind: 'slotEnd', exchange: bout.exchange, slot: slot + 1,
    plans: { A: info(plans.A), B: info(plans.B) },
    positions: { A: { ...F.A.pos }, B: { ...F.B.pos } },
    separation: dist(F.A.pos, F.B.pos),
    wounds: { A: F.A.wounds, B: F.B.wounds },
    meters: { A: F.A.meter, B: F.B.meter },
  });
}
