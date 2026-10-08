// One tick, in the resolution order: movement, aim, hits, damage, end-of-window checks, KOs.

import { add, dist, flatLen, len, sub, type Vec } from '../geometry.ts';
import { describeObstacle, obstacleAt, obstacleOnLine, type Obstacle } from '../arena.ts';
import { inShape, shapeOf } from '../shapes.ts';
import * as R from '../rules.ts';
import { applyHit, damage } from './damage.ts';
import { breathVerbs, leaveZone, strikeObstacles } from './elements.ts';
import type { Event } from './events.ts';
import { checkKO } from './exchange.ts';
import { linearTarget, poolOf, rollEvasion, rollUnder } from './dice.ts';
import { fillMeter } from './meter.ts';
import { beginLunge, beginPounce, beginStoop, carryStep, moveStep, stoopStep } from './movement.ts';
import { type Plan, category, evasionState, lastActiveTick, phase } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, J, SIDES, type Side, V, W, other, tech } from './state.ts';
import { ashCloud, intimidateLands, riposte, smolder, thorns } from './techniques.ts';

/**
 * One tick, in the resolution order [Proposed] §4. Each step sees what the steps before it did this tick:
 * where the dragons moved, where attacks aim, which ones connect.
 */
export function tick(bout: Bout, plans: Record<Side, Plan>, t: number, ev: Event[]) {
  // 1. Movement, both dragons from the same starting positions.
  move(bout, plans, t, ev);
  // A hard landing Stomps where it touches down.
  for (const s of SIDES) if (plans[s].hardLanding && !plans[s].quaked && bout.fighters[s].pos.z === 0 && plans[s].moved > 0) hardLanding(bout, plans, s, t, ev);
  // 2. Attacks aim as their wind-up starts, then track until the aim settles.
  for (const s of SIDES) aim(bout, plans, s, t, ev);
  // 3. Hit detection. Obstacles in the way are judged as they stood at the start of the tick.
  const hits: Side[] = [];
  const blocked: { s: Side; o: Obstacle }[] = [];
  for (const s of SIDES) {
    const c = contact(bout, plans, s, t, ev);
    if (c === 'hit') hits.push(s);
    else if (c) blocked.push({ s, o: c });
  }
  if (blocked.length) for (const s of strikeObstacles(bout, plans, blocked, t, ev)) hits.push(s);
  // 4. Damage and statuses, worked out from the same moment, then applied together.
  if (hits.length) land(bout, plans, hits, t, ev);
  // 5. End-of-window checks.
  for (const s of SIDES) endOfWindow(bout, plans, s, t, ev);
  // 6. KO checks.
  checkKO(bout, ev, t);
}

/** Moves both dragons a tick. Obstacles and bodies block movement [Doc]: a blocked move becomes a dodge, a blocked carry stops. */
function move(bout: Bout, plans: Record<Side, Plan>, t: number, ev: Event[]) {
  const F = bout.fighters;
  const next = { A: moveStep(bout.rules, F.A, F.B, plans.A, plans.B, t, ev), B: moveStep(bout.rules, F.B, F.A, plans.B, plans.A, t, ev) };
  for (const s of SIDES) next[s] = stoopStep(F[s], plans[s], t, next[s]);
  for (const s of SIDES) next[s] = carryStep(plans[s], t, next[s]);
  if (next.A === F.A.pos && next.B === F.B.pos) return; // nobody moved this tick
  const block = (s: Side, by: string) => {
    next[s] = F[s].pos;
    const p = plans[s];
    if (p.stoop || p.carry) {
      ev.push({ kind: 'note', tick: t, side: s, tag: 'carry-cut', text: `The ${p.stoop ? 'stoop' : p.carry!.kind} is cut short by ${by}.` });
      p.stoop = null;
      p.carry = null;
    } else {
      p.converted = 'dodge';
      ev.push({ kind: 'note', tick: t, side: s, tag: 'blocked-move', text: `Blocked by ${by}; converts to a dodge.` });
    }
  };
  for (const s of SIDES) {
    const o = next[s] !== F[s].pos ? obstacleAt(bout.arena, next[s], bout.rules) : null;
    if (o) block(s, describeObstacle(o));
  }
  // Bodies block each other: whoever moved this tick stays put.
  if (dist(next.A, next.B) < bout.rules.BODY_GAP) for (const s of SIDES) if (next[s] !== F[s].pos) block(s, 'the other body');
  F.A.pos = next.A;
  F.B.pos = next.B;
}

/**
 * An attack takes its aim as the wind-up starts (each crunch half aims afresh), then follows the target until
 * the aim settles, (12 − Accuracy) ticks before the strike [Proposed]. Stoops, lunges and pounces begin here.
 */
function aim(bout: Bout, plans: Record<Side, Plan>, s: Side, t: number, ev: Event[]) {
  const F = bout.fighters;
  const p = plans[s];
  if (category(p) === 'attack' && (t === 0 || (p.halves && t === R.HALF)) && phase(p, t) !== 'idle') {
    if (t > 0) {
      p.resolved = false;
      p.nearMiss = false;
    }
    p.origin = { ...F[s].pos };
    p.aim = sub(F[other(s)].pos, F[s].pos);
    ev.push({ kind: 'aim', tick: t, side: s, action: p.spec.name, distance: len(p.aim) });
    if (!p.halves) beginStoop(bout.rules, F[s], F[other(s)], p, t, ev);
    if (p.lunges && t === 0) beginLunge(bout.rules, F[s], p, ev);
    if (t === 0) {
      const acc = eff(F[s], 'accuracy', { opp: F[other(s)] }).value - (F[s].status.blinded ? bout.rules.BLINDED_ACCURACY : 0);
      const lead = Math.min(p.windup, Math.max(1, bout.rules.AIM_SETTLE_BASE - acc));
      p.aimLock = Math.max(0, p.windup - lead);
      // Ravener [Proposed]: within Close, the Drake's Bite tracks its target all the way to the strike.
      if (p.ravener && len(p.aim) <= R.CLOSE_EDGE) p.aimLock = p.windup;
    }
    if (p.pounces && t === 0 && !p.stoop) beginPounce(bout.rules, F[s], p, ev);
    if (p.pounces && t === 0 && p.stoop) ev.push({ kind: 'note', tick: t, side: s, tag: 'pounce', text: 'Strafed into the stoop: it pounces, and pierces.' });
  }
  // Until it settles, the aim follows the target (a stoop and a crunch's halves keep their own aim).
  if (category(p) === 'attack' && !p.stoop && !p.halves && t > 0 && t <= p.aimLock && phase(p, t) === 'windup' && p.aim) {
    p.origin = { ...F[s].pos };
    p.aim = sub(F[other(s)].pos, F[s].pos);
  }
  // A lunging Bite strikes from where the wind-up carried it, along the line it locked.
  if (p.lunges && t === p.windup && phase(p, t) === 'active') p.origin = { ...F[s].pos };
  // A pouncing Claw sweeps its arc from wherever the pounce has carried it, tick by tick.
  if (p.pounces && !p.stoop && phase(p, t) === 'active') p.origin = { ...F[s].pos };
  if (p.spec.name === 'stomp' && t === p.windup && phase(p, t) === 'active') shatter(bout, s, t, ev);
  // A stooping Wyvern strikes from wherever it actually landed, toward where the target stood.
  if (p.stoop && t === p.windup && phase(p, t) === 'active') {
    p.origin = { ...F[s].pos };
    p.aim = sub(p.stoop.target, F[s].pos);
  }
}

/**
 * Whether an active attack connects this tick: 'hit', the obstacle in its way, or null (out of the shape, evaded,
 * or not attacking). Geometry decides first, then, for a Bite or Claw on a moving or dodging target, the Evasion test:
 * pair-off dice (HIT_DICE), or Accuracy against Evasion with ties to Acumen.
 * A target just outside the shape, within Accuracy's phantom band, is a near miss.
 */
function contact(bout: Bout, plans: Record<Side, Plan>, s: Side, t: number, ev: Event[]): 'hit' | Obstacle | null {
  const F = bout.fighters;
  const p = plans[s];
  if (category(p) !== 'attack' || p.resolved || phase(p, t) !== 'active' || !p.origin || !p.aim) return null;
  const att = F[s];
  const def = F[other(s)];
  const defPlan = plans[other(s)];
  // Scything Forelimbs: a wider claw arc that tests Accuracy at −3 (from Adult, only on a chain's first claw).
  const scy = p.spec.name === 'claw' ? tech(att, 'scything-forelimbs') : -1;
  const scythePenalty = scy >= W && (scy < A || p.link <= 1) ? 3 : 0;
  const accuracy = eff(att, 'accuracy', { opp: def }).value - (att.status.blinded ? bout.rules.BLINDED_ACCURACY : 0) - scythePenalty;
  const lance = p.spec.name === 'breath' ? tech(att, 'lance-throat') : -1;
  const shape = p.stoop ? 'stoop' : lance >= W ? 'lance' : shapeOf(p.spec.name, att.sheet);
  const mods = {
    reach: scy < W ? 0 : (scy === W ? bout.rules.SCYTHE_REACH.wyrmling : bout.rules.SCYTHE_REACH.full) + (scy >= V && def.pos.z > p.origin.z ? R.PACE : 0),
    widen: lance >= E,
  };

  // Bellows Chest Elder: a charged breath's area grows.
  const area = (p.spec.released && p.spec.name === 'breath' && tech(att, 'bellows-chest') >= E ? R.PACE : 0)
    // Stalwart: each charging slot widens a True Dragon's released Breath by ½ pace [Proposed].
    + (p.spec.released && p.spec.name === 'breath' && att.sheet.aspect === 'stalwart' ? (p.spec.full ? 2 : 1) * bout.rules.STALWART_WIDEN : 0);
  if (inShape(bout.rules, shape, att.sheet, p.origin, p.aim, def.pos, area, mods)) {
    // An attack shape stops where it meets an obstacle and damages it instead [Proposed]. Stomp shakes the ground under it.
    // Lance Throat from Adult punches through one obstacle.
    const o = p.spec.name === 'stomp' ? null : obstacleOnLine(bout.arena, p.origin, def.pos, lance >= A ? 1 : 0);
    if (o) return o;
    // Breath and Stomp skip Evasion [Doc]. Bite and Claw test it against a moving or dodging target.
    const evading = evasionState(plans[other(s)], t);
    // Wyrm Serpentine [Assumed reading of §2]: it owns lateral movement, so its strafe evades like a dodge, and
    // [Proposed] against Breath too.
    const serpentine = def.sheet.aspect === 'serpentine' && plans[other(s)].spec.name === 'strafe' && evading === 'moving';
    // Ravener [Proposed]: within Close, the Drake's tracking Bite follows a strafe; it tests no Evasion against one.
    const tracked = p.ravener && plans[other(s)].spec.name === 'strafe' && evading === 'moving' && dist(att.pos, def.pos) <= R.CLOSE_EDGE;
    const tests = !tracked && (p.spec.name === 'bite' || p.spec.name === 'claw' || (p.spec.name === 'breath' && serpentine && bout.rules.SERPENTINE_BREATH));
    if (tests && evading) {
      const base = eff(def, 'evasion', {}).value;
      // Staggered, it tests half its Evasion [Proposed].
      let evasion = (def.status.staggered && bout.rules.STAGGER_EVASION_TEST ? Math.floor(base / 2) : base) + (evading === 'dodging' || serpentine ? bout.rules.DODGE_BONUS : 0);
      if (def.status.pinned && p.spec.name === 'bite' && tech(att, 'lockjaw') >= E) evasion -= 3; // Lockjaw Elder
      if (scy >= E && defPlan.spec.name === 'strafe') evasion -= 3; // Scything Elder: caught strafers
      const sw = tech(def, 'sidewinder-spine');
      if (sw >= V && defPlan.spec.name === 'strafe' && bout.history[def.side].at(-1) === 'strafe') evasion += 3; // chained Sidewinders
      const how = serpentine ? 'strafing (Serpentine)' : evading;
      // The attack's own stat meets Evasion. Blindness and Scything's wider arc cost the attack what they cost Accuracy.
      const stat = p.spec.name === 'bite' ? 'bite' : p.spec.name === 'claw' ? 'claw' : 'breath';
      const strike = eff(att, stat, { opp: def }).value - (att.status.blinded ? bout.rules.BLINDED_ACCURACY : 0) - scythePenalty;
      if (bout.rules.HIT_LINEAR) {
        // The linear test [Proposed]: one die, under half its faces + the attack stat − Evasion. A preferred Earth
        // stone's extra die counts as a die's worth of points. Near misses belong to the phantom band.
        const size = bout.rules.HIT_LINEAR;
        const target = linearTarget(size, strike + att.sheet.hitDice * bout.rules.DICE_UNIT, evasion);
        const roll = rollUnder(bout.dice, size, target);
        if (!roll.hit) {
          p.resolved = true;
          defPlan.evaded = true;
          ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, how: serpentine ? 'serpentine' : evading, text: `${how} with Evasion ${evasion} slips ${stat} ${strike}${att.sheet.hitDice ? ` +${att.sheet.hitDice} die` : ''} (needs ${target} or less on a d${size}${roll.roll === null ? '' : `, rolls ${roll.roll}`})` });
          riposte(bout, other(s), p, defPlan, t, ev);
          return null;
        }
      } else if (bout.rules.HIT_DICE) {
        // Pair-off dice [Proposed]: the attack's own stat against Evasion, a die per DICE_UNIT.
        // A preferred Earth stone rolls one more die (hitDice).
        const roll = rollEvasion(bout.dice, poolOf(strike, bout.rules.DICE_UNIT) + att.sheet.hitDice, poolOf(evasion, bout.rules.DICE_UNIT));
        if (roll.result !== 'hit') {
          p.resolved = true;
          defPlan.evaded = true;
          const shown = roll.attack.length || roll.evasion.length ? ` (${roll.attack.join(' ') || 'no dice'} against ${roll.evasion.join(' ') || 'no dice'})` : '';
          ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, how: serpentine ? 'serpentine' : evading, text: `${how} with Evasion ${evasion} slips ${stat} ${strike}${att.sheet.hitDice ? ` +${att.sheet.hitDice} die` : ''}${shown}${roll.result === 'nearMiss' ? ': a matched chain, a near miss' : ''}` });
          riposte(bout, other(s), p, defPlan, t, ev);
          // The attacker's whole pool matched is the defender's, but it was close: the attacker's Surge fills as for any near miss.
          if (roll.result === 'nearMiss') {
            fillMeter(bout.rules, att, 'near miss', t, ev);
            ev.push({ kind: 'nearMiss', tick: t, attacker: s, action: p.spec.name, meter: att.meter });
          }
          return null;
        }
      } else if (evasion > accuracy || (evasion === accuracy && def.sheet.acumen > att.sheet.acumen)) {
        p.resolved = true;
        defPlan.evaded = true;
        ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, how: serpentine ? 'serpentine' : evading, text: `${how} with Evasion ${evasion} beats Accuracy ${accuracy}` });
        riposte(bout, other(s), p, defPlan, t, ev);
        return null;
      }
    }
    return 'hit';
    // Accuracy's phantom band belongs to aimed attacks: a Stomp's quake has no near misses [Doc].
  } else if (p.spec.name !== 'stomp' && inShape(bout.rules, shape, att.sheet, p.origin, p.aim, def.pos, area + Math.max(0, accuracy) * R.NOTCH, mods)) {
    p.nearMiss = true;
  }
  return null;
}

/** Damage from the same moment, applied together; then the meters, and the breath verbs once every hit is in. */
function land(bout: Bout, plans: Record<Side, Plan>, hits: Side[], t: number, ev: Event[]) {
  const F = bout.fighters;
  // At Melee, a Breath trading with a Bite, Claw or Stomp is lost: Melee belongs to the body [Doc]. A charged release
  // holds, and so does a Drake's Breath in its Ravener window [Proposed].
  if (hits.length === 2 && dist(F.A.pos, F.B.pos) <= R.MELEE_EDGE) {
    const lost = hits.filter((s) => plans[s].spec.name === 'breath' && !plans[s].spec.released && !plans[s].ravenerBreath && plans[other(s)].spec.name !== 'breath');
    for (const s of lost) {
      plans[s].interruptedAt = t;
      plans[s].resolved = true;
      ev.push({ kind: 'note', tick: t, side: s, tag: 'breath-broken', text: 'Struck at Melee mid-Breath: the Breath is lost.' });
    }
    hits = hits.filter((s) => !lost.includes(s));
  }
  const results = hits.map((s) => ({ s, ...damage(bout.rules, F[s], F[other(s)], plans[s], plans[other(s)], t) }));
  const trade = results.length === 2;
  // Breath verbs wait until every hit this tick is applied, so a push and a pull can meet.
  const verbs: { s: Side; aim: Vec }[] = [];
  const reflected = new Set<Side>();
  for (const r of results) {
    // A guard with a full Surge turns the blow back on the attacker and empties the meter [Doc].
    const d = other(r.s);
    const dp = plans[d];
    if ((dp.spec.name === 'guard' || dp.spec.name === 'dodge') && phase(dp, t) === 'active' && F[d].meter >= R.METER_MAX) {
      reflected.add(r.s);
      plans[r.s].resolved = true;
      F[d].meter = 0;
      // The blow lands on its owner, against its owner's own hide.
      const back = damage(bout.rules, F[r.s], F[r.s], plans[r.s], plans[r.s], t);
      F[r.s].wounds -= back.total;
      // Thornscale (window or free, Elder): a guard reversal also deals the thorns.
      const thR = tech(F[d], 'thornscale');
      if (bout.rules.TECH_THORNSCALE !== 'base' && thR >= E && dp.spec.name === 'guard' && (plans[r.s].spec.name === 'claw' || plans[r.s].spec.name === 'bite')) thorns(bout, r.s, thR, t, ev);
      ev.push({ kind: 'note', tick: t, side: d, tag: 'reflected', text: `The full Surge turns the ${plans[r.s].spec.name} back on its owner.` });
      ev.push({ kind: 'hit', tick: t, attacker: d, action: plans[r.s].spec.name, damage: back.total, parts: ['reflected by a full Surge:', ...back.parts], tags: ['reflected'], interrupt: false, trade: false, woundsLeft: F[r.s].wounds });
      continue;
    }
    applyHit(bout, plans, r.s, r.total, r.parts, r.tags, t, trade, ev, verbs);
  }
  for (const r of results) {
    // A full meter is spent by the hit it empowered; a landed Breath then fills the breather's meter.
    if (r.bypass) {
      F[r.s].meter = 0;
      ev.push({ kind: 'note', tick: t, side: r.s, tag: 'meter-spent', text: 'Surge empties into the blow: true damage.' });
    }
    if (reflected.has(r.s)) continue;
    if (plans[r.s].spec.name === 'breath') fillMeter(bout.rules, F[r.s], 'landed Breath', t, ev);
    // A hit on a corroded dragon is an Acumen trigger [Proposed].
    if (bout.rules.CORRODE_METER && F[other(r.s)].marks.corrosion) fillMeter(bout.rules, F[r.s], 'hit on a corroded target', t, ev);
  }
  breathVerbs(bout, plans, verbs, t, ev, new Set(results.filter((r) => r.bypass).map((r) => r.s)));
}

/** As an attack's active window closes: a breath leaves its zone, an unresolved attack whiffs or nearly misses, an Intimidate lands. */
function endOfWindow(bout: Bout, plans: Record<Side, Plan>, s: Side, t: number, ev: Event[]) {
  const F = bout.fighters;
  const p = plans[s];
  if (t !== lastActiveTick(p, t) || phase(p, t) !== 'active') return;
  if (p.spec.name === 'breath' && p.origin && p.aim) {
    leaveZone(bout, s, p, p.origin, p.aim, t, ev);
    smolder(bout, s, p.origin, p.aim, t, ev);
  }
  if (category(p) === 'attack' && !p.resolved) {
    p.resolved = true;
    // Sidewinder Spine Elder: a strafe that slips an attack speeds the next wind-up.
    const dp = plans[other(s)];
    if (dp.spec.name === 'strafe' && tech(F[other(s)], 'sidewinder-spine') >= E) {
      dp.evaded = true;
      F[other(s)].marks.quick = 'any';
    }
    // Ash Gland (cloud, Juvenile): the cloud forms where the breath strikes, landed or not: here, its aim point.
    if (p.spec.name === 'breath' && p.origin && p.aim && bout.rules.TECH_ASH_GLAND === 'cloud' && tech(F[s], 'ash-gland') >= J) ashCloud(bout, s, add(p.origin, p.aim), t, ev);
    if (!p.nearMiss) {
      ev.push({ kind: 'whiff', tick: t, attacker: s, action: p.spec.name });
      return;
    }
    // A near miss fills Surge; it no longer grazes [Proposed].
    fillMeter(bout.rules, F[s], 'near miss', t, ev);
    ev.push({ kind: 'nearMiss', tick: t, attacker: s, action: p.spec.name, meter: F[s].meter });
  }
  if (p.spec.name === 'intimidate') intimidateLands(bout, s, t, ev);
}

/** A Stomp's quake shatters the boulders inside its radius as it lands [Proposed]; pillars stand. */
function shatter(bout: Bout, s: Side, t: number, ev: Event[]) {
  const F = bout.fighters;
  const reach = bout.rules.STOMP_RADIUS[F[s].sheet.age];
  const shattered = bout.arena.obstacles.filter((o) => o.kind === 'boulder' && flatLen(sub(o.pos, F[s].pos)) <= reach + o.radius);
  for (const o of shattered) ev.push({ kind: 'note', tick: t, side: s, tag: 'boulder-shattered', text: `The quake shatters ${describeObstacle(o)}.` });
  if (shattered.length) bout.arena.obstacles = bout.arena.obstacles.filter((o) => !shattered.includes(o));
}

/**
 * A hard landing [Doc]: the Dive touches down and Stomps for free, a quake around where it lands. It hits a grounded
 * target inside Stomp's reach, Staggers it as a Stomp does, and shatters boulders. No Evasion test, like any Stomp.
 */
function hardLanding(bout: Bout, plans: Record<Side, Plan>, s: Side, t: number, ev: Event[]) {
  const F = bout.fighters;
  const p = plans[s];
  p.quaked = true;
  ev.push({ kind: 'note', tick: t, side: s, tag: 'hard-landing', text: 'A hard landing: the ground quakes.' });
  shatter(bout, s, t, ev);
  const def = F[other(s)];
  if (def.pos.z !== 0 || dist(F[s].pos, def.pos) > bout.rules.STOMP_RADIUS[F[s].sheet.age]) return;
  const quake: Plan = { ...p, spec: { name: 'stomp' }, halves: null, landedHalves: 0 };
  const r = damage(bout.rules, F[s], def, quake, plans[other(s)], t);
  applyHit(bout, { ...plans, [s]: quake } as Record<Side, Plan>, s, r.total, r.parts, r.tags, t, false, ev, null);
}
