// The Referee: two dragons, two scripts, an exact outcome. No drawing, no randomness, integers only.
//
// Per tick, in order [Proposed] §4 Resolution order:
//   1. movement for both dragons
//   2. attacks starting their wind-up lock their aim
//   3. hit detection, evasion tests, near-miss checks
//   4. damage and statuses, applied together
//   5. end-of-window checks (near misses, grazes, Intimidate)
//   6. KO checks
//
// Not modeled yet: crunch, charge, compounds, hazards beyond boulders, claw sweep timing,
// Acumen-scaled punishes, shards, extended morphs.

import { ACTIONS, HOLD, describe, type ActionName, type ActionSpec } from './actions.ts';
import { hatch, matchup, type StatSheet } from './hatch.ts';
import { add, dist, flat, flatLen, isqrt, len, scaleTo, sub, vec, type Vec } from './geometry.ts';
import { describeObstacle, inZone, makeArena, obstacleAt, obstacleOnLine, type Arena, type ArenaSetup, type Obstacle } from './arena.ts';
import { inShape, shapeOf } from './shapes.ts';
import * as R from './rules.ts';

export type Side = 'A' | 'B';
export const SIDES: readonly Side[] = ['A', 'B'];
export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

export interface Statuses {
  pinned: boolean;
  staggered: boolean;
  rattled: boolean;
  blinded: boolean;
  /** Hardness lowered after ending a slot in a corrosive pool [Assumed] */
  corroded: boolean;
}
const noStatuses = (): Statuses => ({ pinned: false, staggered: false, rattled: false, blinded: false, corroded: false });

export interface Fighter {
  side: Side;
  name: string;
  sheet: StatSheet;
  pos: Vec;
  wounds: number;
  meter: number;
  /** global slot number when each cooldown action is usable again */
  readyAt: Partial<Record<ActionName, number>>;
  /** statuses in force this slot, and those landing next slot */
  status: Statuses;
  pending: Statuses;
  intimidateBonus: boolean;
  chain: { action: ActionName | null; links: number; lastLanded: boolean };
  /** hit by a rim pulse this bout */
  pulsed: boolean;
}

export interface Bout {
  fighters: Record<Side, Fighter>;
  /** wins a double KO [Proposed] */
  challenged: Side;
  exchange: number;
  globalSlot: number;
  /** Wounds when the current exchange began, so controllers can see who was hit */
  startWounds: Record<Side, number>;
  /** every action each side has used, in order; public, since everyone watched it happen */
  history: Record<Side, ActionName[]>;
  arena: Arena;
  over: boolean;
  winner: Side | null;
}

export interface FighterSetup {
  name: string;
  morph: StatSheet['morph'];
  stone: StatSheet['stone'];
}

/** Separation is in paces (decimals allowed). A stands west of B, facing east. */
export function newBout(a: FighterSetup, b: FighterSetup, separationPaces: number, challenged: Side = 'B', arena: ArenaSetup = {}): Bout {
  const half = Math.round((separationPaces * R.PACE) / 2);
  const make = (side: Side, setup: FighterSetup, x: number): Fighter => {
    const sheet = hatch(setup.morph, setup.stone);
    return {
      side, name: setup.name, sheet, pos: vec(x, 0),
      wounds: sheet.wounds, meter: sheet.acumen, readyAt: {},
      status: noStatuses(), pending: noStatuses(), intimidateBonus: false,
      chain: { action: null, links: 0, lastLanded: false }, pulsed: false,
    };
  };
  const fighters = { A: make('A', a, -half), B: make('B', b, half) };
  return {
    fighters,
    arena: makeArena(arena, [fighters.A.pos, fighters.B.pos]),
    challenged, exchange: 0, globalSlot: 0, over: false, winner: null,
    startWounds: { A: 0, B: 0 }, history: { A: [], B: [] },
  };
}

// ---------------------------------------------------------------- events

export interface PlanInfo {
  label: string;
  windup: number;
  active: number;
  recovery: number;
  interruptedAt: number | null;
}

export type Event =
  | { kind: 'exchangeStart'; exchange: number }
  | { kind: 'slotStart'; exchange: number; slot: number }
  | { kind: 'note'; tick: number; side: Side; text: string }
  | { kind: 'aim'; tick: number; side: Side; action: ActionName; distance: number }
  | { kind: 'hit'; tick: number; attacker: Side; action: ActionName; damage: number; parts: string[]; interrupt: boolean; graze: boolean; trade: boolean; woundsLeft: number }
  | { kind: 'evade'; tick: number; attacker: Side; action: ActionName; text: string }
  | { kind: 'nearMiss'; tick: number; attacker: Side; action: ActionName; meter: number }
  | { kind: 'whiff'; tick: number; attacker: Side; action: ActionName }
  | { kind: 'trace'; tick: number; positions: Record<Side, Vec> }
  | { kind: 'slotEnd'; exchange: number; slot: number; plans: Record<Side, PlanInfo>; positions: Record<Side, Vec>; separation: number; wounds: Record<Side, number>; meters: Record<Side, number> }
  | { kind: 'ko'; tick: number; side: Side }
  | { kind: 'revision'; side: Side; moment: Moment; from: string; to: string }
  | { kind: 'pulse'; side: Side; pulse: number; damage: number; woundsLeft: number; capped: boolean }
  | { kind: 'obstacle'; tick: number; attacker: Side; action: ActionName; obstacle: string; damage: number; destroyed: boolean; through: boolean }
  | { kind: 'zone'; tick: number; owner: Side; zone: 'burning' | 'corrosive'; center: Vec }
  | { kind: 'zoneEffect'; side: Side; zone: 'burning' | 'corrosive'; damage: number; woundsLeft: number }
  | { kind: 'boutEnd'; winner: Side; reason: string };

// ---------------------------------------------------------------- plans

type Phase = 'windup' | 'active' | 'recovery' | 'idle';

interface Plan {
  spec: ActionSpec;
  windup: number;
  active: number;
  recovery: number;
  interruptedAt: number | null;
  resolved: boolean;
  landed: boolean;
  nearMiss: boolean;
  origin: Vec | null;
  aim: Vec | null;
  moveTotal: number;
  /** ticks the move takes to complete; Evasion beyond the one-band cap shortens it */
  travel: number;
  moved: number;
  converted: 'dodge' | 'roar' | null;
  link: number;
  intimidateBonus: boolean;
  /** a Wyvern stoop: flies from the air to land at Melee during the wind-up */
  stoop: { from: Vec; to: Vec; target: Vec } | null;
}

const category = (p: Plan) => ACTIONS[p.spec.name].category;

function phase(p: Plan, t: number): Phase {
  if (p.interruptedAt !== null && t >= p.interruptedAt) return 'idle';
  if (t < p.windup) return 'windup';
  if (t < p.windup + p.active) return 'active';
  return 'recovery';
}

/** Shifts move the active window's edges; the action always totals 30 ticks [Doc]. */
export function timing(profile: readonly [number, number, number], windupShift: number, recoveryShift: number): [number, number, number] {
  let w = Math.max(0, profile[0] + windupShift);
  let r = Math.max(0, profile[2] + recoveryShift);
  let a = R.TICKS_PER_SLOT - w - r;
  if (a < R.MIN_ACTIVE) {
    // Shifts past the floor are lost: trim recovery first, then wind-up.
    let need = R.MIN_ACTIVE - a;
    const fromR = Math.min(r, need);
    r -= fromR;
    need -= fromR;
    w -= need;
    a = R.MIN_ACTIVE;
  }
  return [w, a, r];
}

function makePlan(f: Fighter, requested: ActionSpec, g: number, ev: Event[]): Plan {
  let spec = requested;
  const ready = f.readyAt[spec.name] ?? 0;
  if (ready > g) {
    ev.push({ kind: 'note', tick: 0, side: f.side, text: `${describe(spec)} is still cooling down; holds instead.` });
    spec = HOLD;
  }
  if (f.status.pinned && ACTIONS[spec.name].category === 'move') {
    ev.push({ kind: 'note', tick: 0, side: f.side, text: `Pinned: can't ${describe(spec)}; holds instead.` });
    spec = HOLD;
  }
  if (spec.name === 'dive' && f.pos.z === 0) {
    ev.push({ kind: 'note', tick: 0, side: f.side, text: 'Already on the ground: nothing to dive from; holds instead.' });
    spec = HOLD;
  }
  if (spec.name === 'stomp' && f.pos.z > 0) {
    ev.push({ kind: 'note', tick: 0, side: f.side, text: "Can't Stomp while aloft; holds instead." });
    spec = HOLD;
  }
  const def = ACTIONS[spec.name];
  if (def.cooldown > 0) f.readyAt[spec.name] = g + def.cooldown + 1;

  const [windup, active, recovery] = timing(def.profile, f.status.rattled ? R.RATTLED_WINDUP : 0, 0);

  let moveTotal = 0;
  let travel = active;
  if (def.category === 'move') {
    const raw = f.sheet.evasion * R.EVASION_STEP;
    moveTotal = Math.min(raw, R.MOVE_CAP);
    // A move carries at most one band; Evasion beyond that buys timing [Proposed]: the move finishes sooner.
    if (raw > R.MOVE_CAP) travel = Math.max(1, Math.floor((active * R.MOVE_CAP) / raw));
    if (f.status.staggered) moveTotal = Math.floor(moveTotal / 2);
  }

  let link = 0;
  let intimidateBonus = false;
  if (def.category === 'attack') {
    const continues = f.chain.action === spec.name && f.chain.lastLanded && def.cooldown === 0 && f.chain.links < 3;
    link = continues ? f.chain.links + 1 : 1;
    intimidateBonus = f.intimidateBonus;
    f.intimidateBonus = false;
  }

  return {
    spec, windup, active, recovery, interruptedAt: null,
    resolved: false, landed: false, nearMiss: false, origin: null, aim: null,
    moveTotal, travel, moved: 0, converted: null, link, intimidateBonus, stoop: null,
  };
}

// ---------------------------------------------------------------- the exchange

/** Revision moments: the end of slot 1 or the end of slot 2, before slot 3 begins. */
export type Moment = 1 | 2;

/**
 * Asked at each revision moment while the side still has its one revision. Sees the bout as it stands
 * (everything is visible) and whether the opponent has already revised (the flash). Returns a new
 * slot 3, or null to keep it. Both sides decide from the same moment, so same-moment revisions are simultaneous.
 */
export type Reviser = (bout: Bout, side: Side, moment: Moment, opponentRevised: boolean) => ActionSpec | null;

export interface ExchangeOptions {
  trace?: boolean;
  revise?: Partial<Record<Side, Reviser>>;
}

export function runExchange(bout: Bout, scripts: Record<Side, ActionSpec[]>, opts: ExchangeOptions = {}): Event[] {
  const ev: Event[] = [];
  if (bout.over) return ev;
  bout.exchange++;
  ev.push({ kind: 'exchangeStart', exchange: bout.exchange });
  for (const s of SIDES) {
    bout.fighters[s].chain = { action: null, links: 0, lastLanded: false }; // [Assumed] chains live within one exchange
    bout.startWounds[s] = bout.fighters[s].wounds;
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
        if (!revised[s] && reviser) {
          const c = reviser(bout, s, moment, revised[other(s)]);
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

function runSlot(bout: Bout, slot: number, specs: Record<Side, ActionSpec>, ev: Event[], trace: boolean) {
  const g = bout.globalSlot++;
  const F = bout.fighters;
  ev.push({ kind: 'slotStart', exchange: bout.exchange, slot: slot + 1 });

  for (const s of SIDES) {
    F[s].status = F[s].pending;
    F[s].pending = noStatuses();
  }
  const plans: Record<Side, Plan> = { A: makePlan(F.A, specs.A, g, ev), B: makePlan(F.B, specs.B, g, ev) };

  for (let t = 0; t < R.TICKS_PER_SLOT && !bout.over; t++) {
    tick(bout, plans, t, ev);
    if (trace) ev.push({ kind: 'trace', tick: t, positions: { A: { ...F.A.pos }, B: { ...F.B.pos } } });
  }
  if (!bout.over) zonesAtSlotEnd(bout, g, ev);

  for (const s of SIDES) {
    const p = plans[s];
    F[s].chain = category(p) === 'attack'
      ? { action: p.spec.name, links: p.link, lastLanded: p.landed }
      : { action: null, links: 0, lastLanded: false };
    bout.history[s].push(p.spec.name);
  }

  const info = (p: Plan): PlanInfo => ({
    label: describe(p.spec) + (p.spec.revised ? ' (revised)' : '') + (p.converted === 'dodge' ? ' → dodge' : p.converted === 'roar' ? ' → roar' : ''),
    windup: p.windup, active: p.active, recovery: p.recovery, interruptedAt: p.interruptedAt,
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

function tick(bout: Bout, plans: Record<Side, Plan>, t: number, ev: Event[]) {
  const F = bout.fighters;

  // 1. Movement, both dragons from the same starting positions.
  const next = { A: moveStep(F.A, F.B, plans.A, plans.B, t, ev), B: moveStep(F.B, F.A, plans.B, plans.A, t, ev) };
  for (const s of SIDES) next[s] = stoopStep(F[s], plans[s], t, next[s]);
  for (const s of SIDES) {
    // Obstacles restrict movement [Doc]; a blocked move defaults to a dodge.
    const o = next[s] !== F[s].pos ? obstacleAt(bout.arena, next[s]) : null;
    if (o) {
      next[s] = F[s].pos;
      if (plans[s].stoop) {
        plans[s].stoop = null;
        ev.push({ kind: 'note', tick: t, side: s, text: `The stoop is cut short by ${describeObstacle(o)}.` });
      } else {
        plans[s].converted = 'dodge';
        ev.push({ kind: 'note', tick: t, side: s, text: `Blocked by ${describeObstacle(o)}; converts to a dodge.` });
      }
    }
  }
  if (dist(next.A, next.B) < R.BODY_GAP) {
    // Bodies block each other: whoever moved this tick stays put and dodges instead.
    for (const s of SIDES) {
      if (next[s] !== F[s].pos) {
        next[s] = F[s].pos;
        if (plans[s].stoop) {
          plans[s].stoop = null;
          ev.push({ kind: 'note', tick: t, side: s, text: 'The stoop is cut short by the other body.' });
        } else {
          plans[s].converted = 'dodge';
          ev.push({ kind: 'note', tick: t, side: s, text: 'Blocked by the other body; converts to a dodge.' });
        }
      }
    }
  }
  F.A.pos = next.A;
  F.B.pos = next.B;

  // 2. Attacks lock their aim when the wind-up starts [Assumed]. A strafe during the wind-up can carry
  //    the target out of the shape; Accuracy's phantom band and the long Claw window answer that.
  for (const s of SIDES) {
    const p = plans[s];
    if (category(p) === 'attack' && t === 0) {
      p.origin = { ...F[s].pos };
      p.aim = sub(F[other(s)].pos, F[s].pos);
      ev.push({ kind: 'aim', tick: t, side: s, action: p.spec.name, distance: len(p.aim) });
      beginStoop(F[s], F[other(s)], p, t, ev);
    }
    // A stooping Wyvern strikes from wherever it actually landed, toward where the target stood.
    if (p.stoop && t === p.windup && phase(p, t) === 'active') {
      p.origin = { ...F[s].pos };
      p.aim = sub(p.stoop.target, F[s].pos);
    }
  }

  // 3. Hit detection. Obstacles in the way are judged as they stood at the start of the tick.
  const hits: Side[] = [];
  const blocked: { s: Side; o: Obstacle }[] = [];
  for (const s of SIDES) {
    const p = plans[s];
    if (category(p) !== 'attack' || p.resolved || phase(p, t) !== 'active' || !p.origin || !p.aim) continue;
    const att = F[s];
    const def = F[other(s)];
    const accuracy = att.sheet.accuracy - (att.status.blinded ? R.BLINDED_ACCURACY : 0);
    const shape = p.stoop ? 'stoop' : shapeOf(p.spec.name, att.sheet);

    if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, 0)) {
      // An attack shape stops where it meets an obstacle and damages it instead [Proposed]. Stomp shakes the ground under it.
      const o = p.spec.name === 'stomp' ? null : obstacleOnLine(bout.arena, p.origin, def.pos);
      if (o) {
        blocked.push({ s, o });
        continue;
      }
      // Breath and Stomp skip Evasion [Doc]. Bite and Claw test it against a moving or dodging target.
      const evading = evasionState(plans[other(s)], t);
      if ((p.spec.name === 'bite' || p.spec.name === 'claw') && evading) {
        // Wyrm Serpentine [Assumed reading of §2]: it owns lateral movement, so its strafe evades like a dodge.
        const serpentine = def.sheet.aspect === 'serpentine' && plans[other(s)].spec.name === 'strafe' && evading === 'moving';
        const evasion = def.sheet.evasion + (evading === 'dodging' || serpentine ? R.DODGE_BONUS : 0);
        const escaped = evasion > accuracy || (evasion === accuracy && def.sheet.acumen > att.sheet.acumen);
        if (escaped) {
          p.resolved = true;
          ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, text: `${serpentine ? 'strafing (Serpentine)' : evading} with Evasion ${evasion} beats Accuracy ${accuracy}` });
          continue;
        }
      }
      hits.push(s);
    } else if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, Math.max(0, accuracy) * R.NOTCH)) {
      p.nearMiss = true;
    }
  }

  for (const s of strikeObstacles(bout, plans, blocked, t, ev)) hits.push(s);

  // 4. Damage and statuses, worked out from the same moment, then applied together.
  const results = hits.map((s) => ({ s, ...damage(F[s], F[other(s)], plans[s], plans[other(s)], t, false) }));
  const trade = results.length === 2;
  for (const r of results) applyHit(bout, plans, r.s, r.total, r.parts, t, false, trade, ev);

  // 5. End-of-window checks.
  for (const s of SIDES) {
    const p = plans[s];
    const lastActive = t === p.windup + p.active - 1 && phase(p, t) === 'active';
    if (!lastActive) continue;
    if (p.spec.name === 'breath' && p.origin && p.aim) leaveZone(bout, s, p.origin, p.aim, t, ev);
    if (category(p) === 'attack' && !p.resolved) {
      p.resolved = true;
      if (!p.nearMiss) {
        ev.push({ kind: 'whiff', tick: t, attacker: s, action: p.spec.name });
        continue;
      }
      const att = F[s];
      att.meter += R.NEAR_MISS_STEP;
      if (att.meter >= R.METER_MAX) {
        att.meter = att.sheet.acumen;
        const g = damage(att, F[other(s)], p, plans[other(s)], t, true);
        applyHit(bout, plans, s, g.total, g.parts, t, true, false, ev);
      } else {
        ev.push({ kind: 'nearMiss', tick: t, attacker: s, action: p.spec.name, meter: att.meter });
      }
    }
    if (p.spec.name === 'intimidate') {
      const sep = dist(F.A.pos, F.B.pos);
      if (sep <= R.FAR_EDGE) {
        F[s].intimidateBonus = true;
        ev.push({ kind: 'note', tick: t, side: s, text: 'Intimidate lands: +3 to the next attack.' });
      } else {
        ev.push({ kind: 'note', tick: t, side: s, text: 'Intimidate falls short: the opponent is beyond Far.' });
      }
    }
  }

  // 6. KO checks.
  checkKO(bout, ev, t);
}

function evasionState(p: Plan, t: number): 'moving' | 'dodging' | null {
  if (phase(p, t) !== 'active') return null;
  if (p.spec.name === 'dodge' || p.converted === 'dodge') return 'dodging';
  if (category(p) === 'move' && p.converted === null) return 'moving';
  return null;
}

function moveStep(me: Fighter, opp: Fighter, p: Plan, oppPlan: Plan, t: number, ev: Event[]): Vec {
  if (category(p) !== 'move' || p.converted || phase(p, t) !== 'active') return me.pos;
  const k = t - p.windup;
  const target = Math.floor((p.moveTotal * Math.min(k + 1, p.travel)) / p.travel);
  const delta = target - p.moved;
  // A Wyrm's leap is a hop: it rises for the first half of the window and lands by the end [Assumed].
  if (p.spec.name === 'leap' && !me.sheet.flies) {
    const half = Math.max(1, Math.floor(p.active / 2));
    const peak = Math.floor(p.moveTotal / 2);
    const z = k < half ? Math.floor((peak * (k + 1)) / half) : Math.max(0, Math.floor((peak * (p.active - k - 1)) / (p.active - half)));
    return { ...me.pos, z };
  }
  if (delta <= 0) return me.pos;

  // Approach, Retreat and Strafe move across the floor; Leap and Dive change altitude [Doc]: three degrees of freedom.
  const v = sub(me.pos, opp.pos);
  const flatV = flat(v);
  const flatSep = flatLen(v);
  let np: Vec;
  switch (p.spec.name) {
    case 'approach': {
      const both = oppPlan.spec.name === 'approach' && oppPlan.converted === null && phase(oppPlan, t) === 'active';
      if (both && len(v) <= R.MELEE_EDGE) {
        p.converted = 'dodge';
        ev.push({ kind: 'note', tick: t, side: me.side, text: 'Both advanced: stops at Melee and converts to a dodge.' });
        return me.pos;
      }
      if (flatSep === 0) return me.pos; // directly above or below: nothing left to close across the floor
      // Stop where the bodies would touch, counting the height difference.
      const minFlat = isqrt(Math.max(0, R.BODY_GAP * R.BODY_GAP - v.z * v.z));
      np = { ...add(flat(opp.pos), scaleTo(flatV, Math.max(minFlat, flatSep - delta))), z: me.pos.z };
      break;
    }
    case 'retreat': {
      if (flatSep === 0) return me.pos;
      np = { ...add(flat(opp.pos), scaleTo(flatV, flatSep + delta)), z: me.pos.z };
      if (dist(np, opp.pos) > R.LEASH) {
        p.converted = 'roar';
        ev.push({ kind: 'note', tick: t, side: me.side, text: 'The leash holds: the retreat becomes an impotent roar.' });
        return me.pos;
      }
      break;
    }
    case 'strafe': {
      if (flatSep === 0) return me.pos;
      const tangent = p.spec.dir === 'cw' ? vec(flatV.y, -flatV.x) : vec(-flatV.y, flatV.x);
      np = { ...add(flat(opp.pos), scaleTo(add(flatV, scaleTo(tangent, delta)), flatSep)), z: me.pos.z };
      break;
    }
    case 'leap': {
      const z = Math.min(R.MAX_ALTITUDE, me.pos.z + delta);
      if (z === me.pos.z) return me.pos;
      np = { ...me.pos, z };
      if (dist(np, opp.pos) > R.LEASH) return me.pos; // the leash holds in every direction [Doc]
      break;
    }
    case 'dive': {
      const z = Math.max(0, me.pos.z - delta);
      if (z === me.pos.z) return me.pos;
      np = { ...me.pos, z };
      break;
    }
    default:
      return me.pos;
  }
  if (flatLen(np) > R.ARENA_RADIUS) {
    p.converted = 'dodge';
    ev.push({ kind: 'note', tick: t, side: me.side, text: 'Blocked by the arena wall; converts to a dodge.' });
    return me.pos;
  }
  p.moved = target;
  return np;
}

function damage(att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number, graze: boolean): { total: number; parts: string[] } {
  const parts: string[] = [];
  const defPhase = phase(defPlan, t);
  const scales = defPlan.spec.name === 'scales' && defPhase === 'active';
  const corroded = def.status.corroded;
  const hardness = Math.max(0, def.sheet.hardness + (scales ? R.SCALES_HARDNESS : 0) - (corroded ? R.CORRODE_HARDNESS : 0));
  const hardLabel = `Hardness ${hardness}${scales ? ' (Scales)' : ''}${corroded ? ' (corroded)' : ''}`;
  let v = 0;
  switch (p.spec.name) {
    case 'bite':
      v = att.sheet.bite - hardness;
      parts.push(`Bite Force ${att.sheet.bite}`, `−${hardLabel}`);
      break;
    case 'claw':
      v = att.sheet.claw - hardness;
      parts.push(`Claw Sharpness ${att.sheet.claw}`, `−${hardLabel}`);
      break;
    case 'breath': {
      const m = matchup(att.sheet.stone, def.sheet.stone) * R.MATCHUP;
      v = att.sheet.breath - def.sheet.affinity + m;
      parts.push(`Breath Potency ${att.sheet.breath}`, `−Affinity ${def.sheet.affinity}`);
      if (m > 0) parts.push(`+${m} matchup`);
      if (m < 0) parts.push(`${m} matchup`);
      break;
    }
    case 'stomp':
      v = R.STOMP_DAMAGE;
      parts.push(`Stomp ${R.STOMP_DAMAGE} true damage`);
      break;
  }
  if (p.intimidateBonus) {
    v += R.INTIMIDATE_BONUS;
    parts.push(`+${R.INTIMIDATE_BONUS} Intimidate`);
  }
  if (p.link === 3 && !p.spec.revised) {
    v += R.CHAIN_THIRD_LINK_BONUS;
    parts.push(`+${R.CHAIN_THIRD_LINK_BONUS} chain third link`);
  }
  if (defPhase === 'recovery') {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught in recovery)`);
  } else if (defPlan.spec.name === 'intimidate' && defPhase !== 'idle') {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught intimidating)`);
  }
  if (graze) {
    v -= R.GRAZE_PENALTY;
    parts.push(`−${R.GRAZE_PENALTY} graze`);
  }
  if (v < R.DAMAGE_FLOOR) {
    v = R.DAMAGE_FLOOR;
    parts.push(`floor ${R.DAMAGE_FLOOR}`);
  }
  return { total: v, parts };
}

function applyHit(bout: Bout, plans: Record<Side, Plan>, s: Side, total: number, parts: string[], t: number, graze: boolean, trade: boolean, ev: Event[]) {
  const p = plans[s];
  const defPlan = plans[other(s)];
  const def = bout.fighters[other(s)];
  p.resolved = true;
  p.landed = true;
  def.wounds -= total;
  const interrupt = phase(defPlan, t) === 'windup';
  if (interrupt) defPlan.interruptedAt = t;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: p.spec.name, damage: total, parts, interrupt, graze, trade, woundsLeft: def.wounds });
  if (p.spec.name === 'breath' && !graze && p.aim) breathVerb(bout, s, p.aim, t, ev);
  if (p.spec.name === 'stomp') {
    def.pending.staggered = true;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'Staggered next slot: movement distance halved.' });
  }
}

// ---------------------------------------------------------------- obstacles and breath effects

/** Raw force of an attack against an obstacle: no Hardness, no modifiers. */
function obstacleDamage(att: Fighter, action: ActionName): number {
  switch (action) {
    case 'bite': return att.sheet.bite;
    case 'claw': return att.sheet.claw;
    case 'breath': return att.sheet.breath * (att.sheet.stone === 'earth' ? R.EARTH_OBSTACLE_MULTIPLIER : 1);
    default: return R.STOMP_DAMAGE;
  }
}

/**
 * Attacks that met an obstacle hit it instead and are spent [Proposed]. Damage from both sides lands
 * together; then destroyed obstacles are removed. Earth's slurry eats obstacles: if the obstacle it met
 * is destroyed, it carries on to the target. Returns the sides whose attack carries on.
 */
function strikeObstacles(bout: Bout, plans: Record<Side, Plan>, blocked: { s: Side; o: Obstacle }[], t: number, ev: Event[]): Side[] {
  const dealt = blocked.map(({ s, o }) => (o.wounds === null ? 0 : obstacleDamage(bout.fighters[s], plans[s].spec.name)));
  blocked.forEach(({ o }, i) => {
    if (o.wounds !== null) o.wounds -= dealt[i];
  });
  const carryOn: Side[] = [];
  blocked.forEach(({ s, o }, i) => {
    const p = plans[s];
    const destroyed = o.wounds !== null && o.wounds <= 0;
    const through = destroyed && p.spec.name === 'breath' && bout.fighters[s].sheet.stone === 'earth';
    ev.push({ kind: 'obstacle', tick: t, attacker: s, action: p.spec.name, obstacle: describeObstacle(o), damage: dealt[i], destroyed, through });
    if (through) carryOn.push(s);
    else p.resolved = true;
  });
  bout.arena.obstacles = bout.arena.obstacles.filter((o) => o.wounds === null || o.wounds > 0);
  return carryOn;
}

/** Moves a dragon across the floor in ⅓-pace steps until the full distance or something stops it. */
function shove(bout: Bout, side: Side, dir: Vec, amount: number): number {
  const f = bout.fighters[side];
  const opp = bout.fighters[other(side)];
  if (flatLen(dir) === 0) return 0;
  let moved = 0;
  while (moved < amount) {
    const step = Math.min(R.NOTCH, amount - moved);
    const np = add(f.pos, scaleTo(flat(dir), step));
    if (flatLen(np) > R.ARENA_RADIUS || obstacleAt(bout.arena, np) || dist(np, opp.pos) < R.BODY_GAP || dist(np, opp.pos) > R.LEASH) break;
    f.pos = np;
    moved += step;
  }
  return moved;
}

/** The breath's verb on a hit [Doc] §3: Water pushes back, Air shoves sideways. Fire and Earth act through zones. */
function breathVerb(bout: Bout, s: Side, aim: Vec, t: number, ev: Event[]) {
  const att = bout.fighters[s];
  const def = bout.fighters[other(s)];
  if (att.sheet.stone === 'water') {
    const moved = shove(bout, def.side, aim, R.WATER_PUSH);
    ev.push({ kind: 'note', tick: t, side: def.side, text: moved > 0 ? `The jet pushes it back ${(moved / R.PACE).toFixed(1)} paces.` : 'The jet pushes, but something holds it in place.' });
  } else if (att.sheet.stone === 'air') {
    // Shove away from the gust's center line; dead center goes counterclockwise.
    const d = sub(def.pos, att.pos);
    const side = aim.x * d.y - aim.y * d.x;
    const perp = side >= 0 ? vec(-aim.y, aim.x) : vec(aim.y, -aim.x);
    const moved = shove(bout, def.side, perp, R.AIR_SHOVE);
    ev.push({ kind: 'note', tick: t, side: def.side, text: moved > 0 ? `The gust shoves it sideways ${(moved / R.PACE).toFixed(1)} paces.` : 'The gust shoves, but something holds it in place.' });
  }
}

/** Fire leaves a burning zone and Earth a corrosive pool where the breath lands, on the floor below [Doc] §3. */
function leaveZone(bout: Bout, s: Side, origin: Vec, aim: Vec, t: number, ev: Event[]) {
  const stone = bout.fighters[s].sheet.stone;
  if (stone !== 'fire' && stone !== 'earth') return;
  const reach = stone === 'fire' ? R.BREATH.blast.maxCenter : R.BREATH.narrowCone.reach;
  const center = flat(add(origin, scaleTo(aim, Math.min(len(aim), reach))));
  const zone = stone === 'fire' ? 'burning' : 'corrosive';
  bout.arena.zones.push({ kind: zone, center, radius: R.ZONE_RADIUS, lastSlot: bout.globalSlot - 1 + R.ZONE_SLOTS, owner: s });
  ev.push({ kind: 'zone', tick: t, owner: s, zone, center });
}

/** At slot's end, grounded dragons inside a zone feel it, whoever breathed it; then spent zones fade. */
function zonesAtSlotEnd(bout: Bout, g: number, ev: Event[]) {
  for (const z of bout.arena.zones) {
    for (const s of SIDES) {
      const f = bout.fighters[s];
      if (!inZone(z, f.pos)) continue;
      if (z.kind === 'burning') {
        f.wounds -= R.BURN_DAMAGE;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: R.BURN_DAMAGE, woundsLeft: f.wounds });
      } else {
        f.pending.corroded = true;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: 0, woundsLeft: f.wounds });
      }
    }
  }
  bout.arena.zones = bout.arena.zones.filter((z) => z.lastSlot > g);
  checkKO(bout, ev, R.TICKS_PER_SLOT - 1);
}

// ---------------------------------------------------------------- the Wyvern stoop

/**
 * Wyvern Talons [Doc] §2, claws from hind talons on dives: a Claw scripted while aloft, against a grounded
 * opponent within Far, is a stoop. It bends the one-band move rule: during the wind-up the Wyvern flies
 * straight to the ground, landing at Melee short of where the target stood when the wind-up began, then
 * swipes both ways. Against an airborne opponent it simply claws. The price is getting airborne first.
 */
function beginStoop(att: Fighter, def: Fighter, p: Plan, t: number, ev: Event[]) {
  if (p.spec.name !== 'claw' || att.sheet.aspect !== 'talons' || att.pos.z === 0 || def.pos.z !== 0) return;
  if (dist(att.pos, def.pos) > R.STOOP_RANGE) return;
  const target = { ...def.pos };
  const back = flat(sub(att.pos, target));
  const offset = flatLen(back) === 0 ? vec(R.STOOP_LANDING, 0) : scaleTo(back, R.STOOP_LANDING);
  const to = add(target, offset);
  p.stoop = { from: { ...att.pos }, to, target };
  ev.push({ kind: 'note', tick: t, side: att.side, text: `Stoops from ${(dist(att.pos, to) / R.PACE).toFixed(1)} paces to land at Melee, talons first.` });
}

/** Where a stooping Wyvern is this tick: a straight flight that touches down as the wind-up ends. */
function stoopStep(f: Fighter, p: Plan, t: number, fallback: Vec): Vec {
  if (!p.stoop || t === 0 || phase(p, t) !== 'windup') return fallback;
  const span = Math.max(1, p.windup - 1);
  const { from, to } = p.stoop;
  const k = Math.min(t, span);
  return vec(
    from.x + Math.trunc(((to.x - from.x) * k) / span),
    from.y + Math.trunc(((to.y - from.y) * k) / span),
    from.z + Math.trunc(((to.z - from.z) * k) / span),
  );
}
