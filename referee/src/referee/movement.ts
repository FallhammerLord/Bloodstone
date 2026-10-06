// Movement: band moves and strafes, and the carries that bend them (stoop, lunge, pounce).

import { add, dist, flat, flatLen, isqrt, len, scaleTo, sub, vec, type Vec } from '../geometry.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import type { Event } from './events.ts';
import { type Plan, category, phase, traveling } from './plan.ts';
import type { Fighter } from './state.ts';

export function moveStep(rules: Rules, me: Fighter, opp: Fighter, p: Plan, oppPlan: Plan, t: number, ev: Event[]): Vec {
  if (category(p) !== 'move' || p.converted || !traveling(p, t)) return me.pos;
  const k = t - p.windup;
  const target = Math.floor((p.moveTotal * Math.min(k + 1, p.travel)) / p.travel);
  const delta = target - p.moved;
  // A Wyrm's leap is a hop: it rises for the first half of the window and lands by the end [Assumed].
  if (p.spec.name === 'leap' && !me.sheet.flies) {
    const half = Math.max(1, Math.floor(p.travel / 2));
    const peak = Math.floor(p.moveTotal / 2);
    const z = k < half ? Math.floor((peak * (k + 1)) / half) : Math.max(0, Math.floor((peak * (p.travel - k - 1)) / Math.max(1, p.travel - half)));
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
      const both = oppPlan.spec.name === 'approach' && oppPlan.converted === null && traveling(oppPlan, t);
      if (both && len(v) <= R.MELEE_EDGE) {
        p.converted = 'dodge';
        ev.push({ kind: 'note', tick: t, side: me.side, tag: 'blocked-move', text: 'Both advanced: stops at Melee and converts to a dodge.' });
        return me.pos;
      }
      if (flatSep === 0) return me.pos; // directly above or below: nothing left to close across the floor
      // Stop where the bodies would touch, counting the height difference.
      const minFlat = isqrt(Math.max(0, rules.BODY_GAP * rules.BODY_GAP - v.z * v.z));
      np = { ...add(flat(opp.pos), scaleTo(flatV, Math.max(minFlat, flatSep - delta))), z: me.pos.z };
      break;
    }
    case 'retreat': {
      if (flatSep === 0) return me.pos;
      np = { ...add(flat(opp.pos), scaleTo(flatV, flatSep + delta)), z: me.pos.z };
      if (dist(np, opp.pos) > rules.LEASH) {
        p.converted = 'roar';
        ev.push({ kind: 'note', tick: t, side: me.side, tag: 'leash', text: 'The leash holds: the retreat becomes an impotent roar.' });
        return me.pos;
      }
      break;
    }
    case 'strafe': {
      if (flatSep === 0) return me.pos;
      // A Strafe's band is arc [Proposed]: this tick's distance turns the dragon around the opponent at its separation.
      const turn = Math.min(Math.PI, delta / flatSep) * (p.spec.dir === 'cw' ? -1 : 1);
      const around = vec(Math.round(flatV.x * Math.cos(turn) - flatV.y * Math.sin(turn)), Math.round(flatV.x * Math.sin(turn) + flatV.y * Math.cos(turn)));
      // Sidewinder Spine: shift along the line while strafing, spread over the same ticks.
      const k2 = Math.min(t - p.windup + 1, p.travel);
      const shiftNow = Math.floor((p.shiftTotal * k2) / p.travel) - p.shifted;
      p.shifted += shiftNow;
      const radius = Math.max(rules.BODY_GAP, flatSep + (p.spec.shift === 'in' ? -shiftNow : shiftNow));
      np = { ...add(flat(opp.pos), scaleTo(around, radius)), z: me.pos.z };
      if (dist(np, opp.pos) > rules.LEASH) np = { ...add(flat(opp.pos), scaleTo(around, flatSep)), z: me.pos.z };
      break;
    }
    case 'leap': {
      const z = Math.min(rules.MAX_ALTITUDE, me.pos.z + delta);
      if (z === me.pos.z) return me.pos;
      np = { ...me.pos, z };
      if (dist(np, opp.pos) > rules.LEASH) return me.pos; // the leash holds in every direction [Doc]
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
  if (flatLen(np) > rules.ARENA_RADIUS) {
    p.converted = 'dodge';
    ev.push({ kind: 'note', tick: t, side: me.side, tag: 'blocked-move', text: 'Blocked by the arena wall; converts to a dodge.' });
    return me.pos;
  }
  p.moved = target;
  return np;
}


/**
 * Wyvern Talons [Doc] §2, claws from hind talons on dives: a Claw scripted while aloft, against a grounded
 * opponent within Far, is a stoop. The Wyvern descends to the ground during the wind-up, carrying at most one
 * band forward (never closer than Melee, short of where the target stood) or one band back, then swipes both
 * ways. The descent takes time: the wind-up grows with the height it falls, and the active window trims to fit
 * the slot. Against an airborne opponent it simply claws. The price is getting airborne, and close, first.
 */
export function beginStoop(rules: Rules, att: Fighter, def: Fighter, p: Plan, t: number, ev: Event[]) {
  if (p.spec.name !== 'claw' || att.sheet.aspect !== 'talons' || att.pos.z === 0 || def.pos.z !== 0) return;
  if (dist(att.pos, def.pos) > rules.STOOP_RANGE) return;
  // A stoop needs an exchange already spent aloft [Proposed]: no Leap and stoop in the same exchange.
  if (!att.marks.aloftAtStart) {
    ev.push({ kind: 'note', tick: t, side: att.side, tag: 'stoop-too-soon', text: 'Not aloft since the exchange began: too soon to stoop.' });
    return;
  }
  const target = { ...def.pos };
  const ahead = flat(sub(target, att.pos));
  const across = flatLen(ahead);
  const carry = p.spec.back ? -rules.STOOP_CARRY : Math.min(rules.STOOP_CARRY, Math.max(0, across - rules.STOOP_LANDING));
  let to = across === 0 ? flat(att.pos) : add(flat(att.pos), scaleTo(ahead, carry));
  if (flatLen(to) > rules.ARENA_RADIUS) to = scaleTo(to, rules.ARENA_RADIUS);
  // The descent takes time [Doc]: the wind-up grows with the fall; the active window, then recovery, give it room.
  const fall = Math.floor((att.pos.z * rules.STOOP_TICKS_PER_PACE) / R.PACE);
  p.windup = Math.min(R.TICKS_PER_SLOT - rules.MIN_ACTIVE, p.windup + fall);
  p.active = Math.min(p.active, R.TICKS_PER_SLOT - p.windup);
  p.recovery = R.TICKS_PER_SLOT - p.windup - p.active;
  p.stoop = { from: { ...att.pos }, to, target };
  const moved = flatLen(sub(to, flat(att.pos)));
  ev.push({ kind: 'note', tick: t, side: att.side, tag: 'stoop', text: `Stoops from ${(att.pos.z / R.PACE).toFixed(1)} paces up, carrying ${(moved / R.PACE).toFixed(1)} paces ${p.spec.back ? 'back' : 'forward'}; strikes at tick ${p.windup}.` });
}

/**
 * Lunge [Proposed]: a Bite right after an Approach carries the dragon up to 1 pace along its locked line
 * during the wind-up. Pure geometry: a retreat that outruns it still escapes, and Evasion still applies.
 * Bodies, obstacles and the wall cut it short.
 */
export function beginLunge(rules: Rules, att: Fighter, p: Plan, ev: Event[]) {
  if (!p.aim || p.windup < 2) return;
  const ahead = flat(p.aim);
  const room = Math.min(rules.BITE_LUNGE, Math.max(0, flatLen(ahead) - rules.BODY_GAP));
  if (room <= 0 || flatLen(ahead) === 0) return;
  p.carry = { kind: 'lunge', from: { ...att.pos }, to: carryTo(rules, att, ahead, room) };
  ev.push({ kind: 'note', tick: 0, side: att.side, tag: 'lunge', text: `Lunges ${(dist(att.pos, p.carry.to) / R.PACE).toFixed(1)} paces into the Bite.` });
}

/**
 * Pounce [Proposed]: a Claw right after a Strafe advances up to one band along its locked line during
 * the active window, sweeping its arc as it goes, and pierces 3 Hardness. It stops at the stoop's landing
 * distance from where the target stood; a grounded Wyvern's short Claw pounces too. An airborne Wyvern
 * that strafes into a stoop gets the pierce on the stoop instead.
 */
export function beginPounce(rules: Rules, att: Fighter, p: Plan, ev: Event[]) {
  if (!p.aim) return;
  const ahead = flat(p.aim);
  const room = Math.min(rules.POUNCE_REACH, Math.max(0, flatLen(ahead) - rules.STOOP_LANDING));
  if (room <= 0 || flatLen(ahead) === 0) {
    ev.push({ kind: 'note', tick: 0, side: att.side, tag: 'pounce', text: 'Pounces from the strafe, already in reach.' });
    return;
  }
  p.carry = { kind: 'pounce', from: { ...att.pos }, to: carryTo(rules, att, ahead, room) };
  ev.push({ kind: 'note', tick: 0, side: att.side, tag: 'pounce', text: `Pounces ${(dist(att.pos, p.carry.to) / R.PACE).toFixed(1)} paces out of the strafe.` });
}

export function carryTo(rules: Rules, att: Fighter, ahead: Vec, room: number): Vec {
  const to = add(att.pos, scaleTo(ahead, room));
  return flatLen(to) > rules.ARENA_RADIUS ? { ...scaleTo(flat(to), rules.ARENA_RADIUS), z: att.pos.z } : to;
}

/** Where a lunge or pounce has carried the dragon this tick: a lunge across the wind-up, a pounce across the active window. */
export function carryStep(p: Plan, t: number, fallback: Vec): Vec {
  if (!p.carry) return fallback;
  const lunge = p.carry.kind === 'lunge';
  if (lunge ? t === 0 || phase(p, t) !== 'windup' : phase(p, t) !== 'active') return fallback;
  const span = lunge ? Math.max(1, p.windup - 1) : Math.max(1, p.active);
  const k = lunge ? Math.min(t, span) : Math.min(t - p.windup + 1, span);
  const { from, to } = p.carry;
  return vec(from.x + Math.trunc(((to.x - from.x) * k) / span), from.y + Math.trunc(((to.y - from.y) * k) / span), from.z);
}

/** Where a stooping Wyvern is this tick: a straight flight that touches down as the wind-up ends. */
export function stoopStep(f: Fighter, p: Plan, t: number, fallback: Vec): Vec {
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
