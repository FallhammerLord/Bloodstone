// One tick, in the resolution order: movement, aim, hits, damage, end-of-window checks, KOs.

import { dist, flatLen, len, sub, type Vec } from '../geometry.ts';
import { describeObstacle, obstacleAt, obstacleOnLine, type Obstacle } from '../arena.ts';
import { inShape, shapeOf } from '../shapes.ts';
import * as R from '../rules.ts';
import { applyHit, damage } from './damage.ts';
import { breathVerbs, leaveZone, strikeObstacles } from './elements.ts';
import type { Event } from './events.ts';
import { checkKO } from './exchange.ts';
import { fillMeter } from './meter.ts';
import { beginLunge, beginPounce, beginStoop, carryStep, moveStep, stoopStep } from './movement.ts';
import { type Plan, category, evasionState, lastActiveTick, phase } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, SIDES, type Side, V, W, other, tech } from './state.ts';
import { intimidateLands, riposte, smolder } from './techniques.ts';

export function tick(bout: Bout, plans: Record<Side, Plan>, t: number, ev: Event[]) {
  const F = bout.fighters;

  // 1. Movement, both dragons from the same starting positions.
  const next = { A: moveStep(F.A, F.B, plans.A, plans.B, t, ev), B: moveStep(F.B, F.A, plans.B, plans.A, t, ev) };
  for (const s of SIDES) next[s] = stoopStep(F[s], plans[s], t, next[s]);
  for (const s of SIDES) next[s] = carryStep(plans[s], t, next[s]);
  for (const s of SIDES) {
    // Obstacles restrict movement [Doc]; a blocked move defaults to a dodge.
    const o = next[s] !== F[s].pos ? obstacleAt(bout.arena, next[s]) : null;
    if (o) {
      next[s] = F[s].pos;
      if (plans[s].stoop || plans[s].carry) {
        ev.push({ kind: 'note', tick: t, side: s, text: `The ${plans[s].stoop ? 'stoop' : plans[s].carry!.kind} is cut short by ${describeObstacle(o)}.` });
        plans[s].stoop = null;
        plans[s].carry = null;
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
        if (plans[s].stoop || plans[s].carry) {
          ev.push({ kind: 'note', tick: t, side: s, text: `The ${plans[s].stoop ? 'stoop' : plans[s].carry!.kind} is cut short by the other body.` });
          plans[s].stoop = null;
          plans[s].carry = null;
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
    if (category(p) === 'attack' && (t === 0 || (p.halves && t === R.HALF)) && phase(p, t) !== 'idle') {
      // Each half of a crunch aims afresh.
      if (t > 0) {
        p.resolved = false;
        p.nearMiss = false;
      }
      p.origin = { ...F[s].pos };
      p.aim = sub(F[other(s)].pos, F[s].pos);
      ev.push({ kind: 'aim', tick: t, side: s, action: p.spec.name, distance: len(p.aim) });
      if (!p.halves) beginStoop(F[s], F[other(s)], p, t, ev);
      if (p.lunges && t === 0) beginLunge(F[s], p, ev);
      if (t === 0) {
        // Accuracy sets how late the aim settles: (12 − Accuracy) ticks before the strike [Proposed].
        const acc = eff(F[s], 'accuracy', { opp: F[other(s)] }).value - (F[s].status.blinded ? R.BLINDED_ACCURACY : 0);
        const lead = Math.min(p.windup, Math.max(1, R.AIM_SETTLE_BASE - acc));
        p.aimLock = Math.max(0, p.windup - lead);
      }
      if (p.pounces && t === 0 && !p.stoop) beginPounce(F[s], p, ev);
      if (p.pounces && t === 0 && p.stoop) ev.push({ kind: 'note', tick: t, side: s, text: 'Strafed into the stoop: it pounces, and pierces.' });
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
    // A stooping Wyvern strikes from wherever it actually landed, toward where the target stood.
    // A Stomp's quake shatters the boulders inside its radius as it lands [Proposed]; pillars stand.
    if (p.spec.name === 'stomp' && t === p.windup && phase(p, t) === 'active') {
      const reach = R.STOMP_RADIUS[F[s].sheet.age];
      const shattered = bout.arena.obstacles.filter((o) => o.kind === 'boulder' && flatLen(sub(o.pos, F[s].pos)) <= reach + o.radius);
      for (const o of shattered) ev.push({ kind: 'note', tick: t, side: s, text: `The quake shatters ${describeObstacle(o)}.` });
      if (shattered.length) bout.arena.obstacles = bout.arena.obstacles.filter((o) => !shattered.includes(o));
    }
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
    const defPlan = plans[other(s)];
    // Scything Forelimbs: a wider claw arc that tests Accuracy at −3 (from Adult, only on a chain's first claw).
    const scy = p.spec.name === 'claw' ? tech(att, 'scything-forelimbs') : -1;
    const scythePenalty = scy >= W && (scy < A || p.link <= 1) ? 3 : 0;
    const accuracy = eff(att, 'accuracy', { opp: def }).value - (att.status.blinded ? R.BLINDED_ACCURACY : 0) - scythePenalty;
    const lance = p.spec.name === 'breath' ? tech(att, 'lance-throat') : -1;
    const shape = p.stoop ? 'stoop' : lance >= W ? 'lance' : shapeOf(p.spec.name, att.sheet);
    const mods = {
      reach: scy < W ? 0 : (scy === W ? R.SCYTHE_REACH.wyrmling : R.SCYTHE_REACH.full) + (scy >= V && def.pos.z > p.origin.z ? R.PACE : 0),
      widen: lance >= E,
    };

    // Bellows Chest Elder: a charged breath's area grows.
    const area = (p.spec.released && p.spec.name === 'breath' && tech(att, 'bellows-chest') >= E ? R.PACE : 0)
      // Stalwart: each charging slot widens a True Dragon's released Breath by ½ pace [Proposed].
      + (p.spec.released && p.spec.name === 'breath' && att.sheet.aspect === 'stalwart' ? (p.spec.full ? 2 : 1) * R.STALWART_WIDEN : 0);
    if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, area, mods)) {
      // An attack shape stops where it meets an obstacle and damages it instead [Proposed]. Stomp shakes the ground under it.
      // Lance Throat from Adult punches through one obstacle.
      const o = p.spec.name === 'stomp' ? null : obstacleOnLine(bout.arena, p.origin, def.pos, lance >= A ? 1 : 0);
      if (o) {
        blocked.push({ s, o });
        continue;
      }
      // Breath and Stomp skip Evasion [Doc]. Bite and Claw test it against a moving or dodging target.
      const evading = evasionState(plans[other(s)], t);
      if ((p.spec.name === 'bite' || p.spec.name === 'claw') && evading) {
        // Wyrm Serpentine [Assumed reading of §2]: it owns lateral movement, so its strafe evades like a dodge.
        const serpentine = def.sheet.aspect === 'serpentine' && plans[other(s)].spec.name === 'strafe' && evading === 'moving';
        let evasion = eff(def, 'evasion', {}).value + (evading === 'dodging' || serpentine ? R.DODGE_BONUS : 0);
        if (def.status.pinned && p.spec.name === 'bite' && tech(att, 'lockjaw') >= E) evasion -= 3; // Lockjaw Elder
        if (scy >= E && defPlan.spec.name === 'strafe') evasion -= 3; // Scything Elder: caught strafers
        const sw = tech(def, 'sidewinder-spine');
        if (sw >= V && defPlan.spec.name === 'strafe' && bout.history[def.side].at(-1) === 'strafe') evasion += 3; // chained Sidewinders
        const escaped = evasion > accuracy || (evasion === accuracy && def.sheet.acumen > att.sheet.acumen);
        if (escaped) {
          p.resolved = true;
          defPlan.evaded = true;
          ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, text: `${serpentine ? 'strafing (Serpentine)' : evading} with Evasion ${evasion} beats Accuracy ${accuracy}` });
          riposte(bout, other(s), p, defPlan, t, ev);
          continue;
        }
      }
      hits.push(s);
    } else if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, area + Math.max(0, accuracy) * R.NOTCH, mods)) {
      p.nearMiss = true;
    }
  }

  for (const s of strikeObstacles(bout, plans, blocked, t, ev)) hits.push(s);

  // 4. Damage and statuses, worked out from the same moment, then applied together.
  const results = hits.map((s) => ({ s, ...damage(F[s], F[other(s)], plans[s], plans[other(s)], t, false) }));
  const trade = results.length === 2;
  // Breath verbs wait until every hit this tick is applied, so a push and a pull can meet.
  const verbs: { s: Side; aim: Vec }[] = [];
  for (const r of results) applyHit(bout, plans, r.s, r.total, r.parts, t, false, trade, ev, verbs);
  for (const r of results) {
    // A full meter is spent by the hit it empowered; a landed Breath then fills the breather's meter.
    if (r.bypass) {
      F[r.s].meter = 0;
      ev.push({ kind: 'note', tick: t, side: r.s, text: 'The Acumen meter empties into the blow: true damage.' });
    }
    if (plans[r.s].spec.name === 'breath') fillMeter(F[r.s], 'landed Breath', t, ev);
  }
  breathVerbs(bout, plans, verbs, t, ev, new Set(results.filter((r) => r.bypass).map((r) => r.s)));

  // 5. End-of-window checks.
  for (const s of SIDES) {
    const p = plans[s];
    const lastActive = t === lastActiveTick(p, t) && phase(p, t) === 'active';
    if (!lastActive) continue;
    if (p.spec.name === 'breath' && p.origin && p.aim) {
      leaveZone(bout, s, p.origin, p.aim, t, ev);
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
      if (!p.nearMiss) {
        ev.push({ kind: 'whiff', tick: t, attacker: s, action: p.spec.name });
        continue;
      }
      // A near miss fills the Acumen meter; it no longer grazes [Proposed].
      fillMeter(F[s], 'near miss', t, ev);
      ev.push({ kind: 'nearMiss', tick: t, attacker: s, action: p.spec.name, meter: F[s].meter });
    }
    if (p.spec.name === 'intimidate') intimidateLands(bout, s, t, ev);
  }

  // 6. KO checks.
  checkKO(bout, ev, t);
}
