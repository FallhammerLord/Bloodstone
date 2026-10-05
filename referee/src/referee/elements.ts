// Obstacles and the elements: shoves, breath verbs, Affinity contests, zones.

import type { ActionName } from '../actions.ts';
import { add, dist, flat, flatLen, len, scaleTo, sub, vec, type Vec } from '../geometry.ts';
import { describeObstacle, inZone, obstacleAt, type Obstacle, type Zone } from '../arena.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import type { Event } from './events.ts';
import { checkKO } from './exchange.ts';
import { type Plan, guarding } from './plan.ts';
import { eff } from './riders.ts';
import { type Bout, E, type Fighter, J, SIDES, type Side, V, W, other, tech } from './state.ts';

/** Raw force of an attack against an obstacle: no Hardness, no modifiers. */
export function obstacleDamage(rules: Rules, att: Fighter, action: ActionName): number {
  switch (action) {
    case 'bite': return att.sheet.bite;
    case 'claw': return att.sheet.claw;
    case 'breath': return att.sheet.breath * (att.sheet.stone === 'earth' ? rules.EARTH_OBSTACLE_MULTIPLIER : 1);
    default: return rules.STOMP_DAMAGE;
  }
}

/**
 * Attacks that met an obstacle hit it instead and are spent [Proposed]. Damage from both sides lands
 * together; then destroyed obstacles are removed. Earth's slurry eats obstacles: if the obstacle it met
 * is destroyed, it carries on to the target. Returns the sides whose attack carries on.
 */
export function strikeObstacles(bout: Bout, plans: Record<Side, Plan>, blocked: { s: Side; o: Obstacle }[], t: number, ev: Event[]): Side[] {
  // Water's jet shoves a boulder rather than breaking it [Proposed]; Earth's slurry eats through.
  const jet = (s: Side) => plans[s].spec.name === 'breath' && bout.fighters[s].sheet.stone === 'water';
  const dealt = blocked.map(({ s, o }) => (o.wounds === null || jet(s) ? 0 : obstacleDamage(bout.rules, bout.fighters[s], plans[s].spec.name)));
  blocked.forEach(({ o }, i) => {
    if (o.wounds !== null) o.wounds -= dealt[i];
  });
  const carryOn: Side[] = [];
  blocked.forEach(({ s, o }, i) => {
    const p = plans[s];
    const destroyed = o.wounds !== null && o.wounds <= 0;
    const through = destroyed && p.spec.name === 'breath' && bout.fighters[s].sheet.stone === 'earth';
    ev.push({ kind: 'obstacle', tick: t, attacker: s, action: p.spec.name, obstacle: describeObstacle(o), damage: dealt[i], destroyed, through });
    if (!destroyed && jet(s) && p.aim) shoveObstacle(bout, o, p.aim, t, s, ev);
    if (through) carryOn.push(s);
    else p.resolved = true;
  });
  bout.arena.obstacles = bout.arena.obstacles.filter((o) => o.wounds === null || o.wounds > 0);
  return carryOn;
}

/** Moves a dragon up to `amount` along `dir`; reports how far, and the wall or obstacle that stopped it, if one did. */
export function shove(bout: Bout, side: Side, dir: Vec, amount: number, zFloor: number | null = null): { moved: number; slam: string | null } {
  const f = bout.fighters[side];
  const opp = bout.fighters[other(side)];
  // Flat unless a floor is given: then the move may lower a flier, but never below the floor.
  const d = zFloor === null ? flat(dir) : dir;
  if (len(d) === 0) return { moved: 0, slam: null };
  let moved = 0;
  while (moved < amount) {
    const step = Math.min(R.NOTCH, amount - moved);
    let np = add(f.pos, scaleTo(d, step));
    if (zFloor !== null) np = { ...np, z: Math.max(np.z, zFloor) };
    if (flatLen(np) > bout.rules.ARENA_RADIUS) return { moved, slam: 'the arena wall' };
    const o = obstacleAt(bout.arena, np, bout.rules);
    if (o) return { moved, slam: describeObstacle(o) };
    if (dist(np, opp.pos) < bout.rules.BODY_GAP || dist(np, opp.pos) > bout.rules.LEASH) break;
    f.pos = np;
    moved += step;
  }
  return { moved, slam: null };
}

/** Water's jet shoves a boulder it strikes a band along the aim; it stops at the wall, other obstacles and dragons. */
export function shoveObstacle(bout: Bout, o: Obstacle, dir: Vec, t: number, s: Side, ev: Event[]) {
  if (o.kind !== 'boulder' || flatLen(dir) === 0) return;
  let moved = 0;
  while (moved < bout.rules.WATER_OBSTACLE_PUSH) {
    const np = add(o.pos, scaleTo(flat(dir), Math.min(R.NOTCH, bout.rules.WATER_OBSTACLE_PUSH - moved)));
    if (flatLen(np) + o.radius > bout.rules.ARENA_RADIUS) break;
    if (bout.arena.obstacles.some((q) => q !== o && flatLen(sub(np, q.pos)) < q.radius + o.radius)) break;
    if (SIDES.some((d) => flatLen(sub(np, bout.fighters[d].pos)) < o.radius + bout.rules.BODY_RADIUS)) break;
    moved += Math.min(R.NOTCH, bout.rules.WATER_OBSTACLE_PUSH - moved);
    o.pos = { ...np, z: 0 };
  }
  if (moved > 0) ev.push({ kind: 'note', tick: t, side: s, tag: 'boulder-shoved', text: `The jet shoves ${describeObstacle(o)} ${(moved / R.PACE).toFixed(1)} paces.` });
}

/** The breath's verb on a hit [Doc] §3: Water pushes back, Air shoves sideways. Fire and Earth act through zones. */
export function breathVerb(bout: Bout, s: Side, aim: Vec, t: number, ev: Event[]) {
  const att = bout.fighters[s];
  const def = bout.fighters[other(s)];
  if (att.sheet.stone === 'water') {
    const { moved, slam } = shove(bout, def.side, aim, bout.rules.WATER_PUSH);
    ev.push({ kind: 'note', tick: t, side: def.side, tag: moved > 0 ? 'push' : 'push-stopped', text: moved > 0 ? `The jet pushes it back ${(moved / R.PACE).toFixed(1)} paces.` : 'The jet pushes, but something holds it in place.' });
    slammed(bout.rules, def, slam, t, ev);
  } else if (att.sheet.stone === 'air') {
    // The vortex pulls a band toward the breather; a second vortex in the breather's own space throws anything
    // inside Melee back out to Close. So the pull ends at Close, and a target already at Melee is thrown out.
    const sep = dist(def.pos, att.pos);
    const edge = R.MELEE_EDGE + R.NOTCH;
    const floor = def.pos.z > 0 ? Math.min(def.pos.z, bout.rules.AIR_FLOOR) : 0;
    if (sep <= R.MELEE_EDGE) {
      const out = len(sub(def.pos, att.pos)) === 0 ? vec(R.PACE, 0) : sub(def.pos, att.pos);
      const { moved, slam } = shove(bout, def.side, out, edge - sep, floor);
      ev.push({ kind: 'note', tick: t, side: def.side, tag: 'pull', text: `The vortex at its heart throws it out ${(moved / R.PACE).toFixed(1)} paces, to Close.` });
      slammed(bout.rules, def, slam, t, ev);
    } else {
      const { moved, slam } = shove(bout, def.side, sub(att.pos, def.pos), Math.min(bout.rules.AIR_PULL, sep - edge), floor);
      ev.push({ kind: 'note', tick: t, side: def.side, tag: moved > 0 ? 'pull' : 'pull-stopped', text: moved > 0 ? `The vortex pulls it in ${(moved / R.PACE).toFixed(1)} paces.` : 'The vortex pulls, but something holds it in place.' });
      slammed(bout.rules, def, slam, t, ev);
    }
  }
}

/** The Affinity a Breath meets: the stone's, plus Scales and Mantle Wings when guarding, less Lance Throat's pierce. */
export function affinityAgainst(rules: Rules, att: Fighter, def: Fighter, scales: boolean, sep: number) {
  const aff = eff(def, 'affinity', { opp: att });
  // Scales presents the hide to the elements: +3 Affinity. Mantle Wings adds 3 more (Wyrmling: only at Melee or Close).
  const scalesAff = scales ? rules.SCALES_AFFINITY : 0;
  const mantle = scales ? tech(def, 'mantle-wings') : -1;
  const mantleAff = mantle >= J || (mantle === W && sep <= R.CLOSE_EDGE) ? 3 : 0;
  // Lance Throat pierces Affinity: 3 from Juvenile, 6 at Far for a Venerable.
  const lance = tech(att, 'lance-throat');
  const pierce = lance >= V && sep > R.CLOSE_EDGE ? 6 : lance >= J ? 3 : 0;
  return { aff, scalesAff, mantleAff, pierce, affinity: Math.max(0, aff.value + scalesAff + mantleAff - pierce) };
}

/**
 * Affinity is the element's Evasion [Proposed]: a breath's verb (push, pull, burn, corrosion, a smolder's
 * tug) lands only if the breather's Potency beats the target's Affinity; a tie goes to the higher Acumen.
 * Returns a note when the target holds, or null when the element takes hold.
 */
export function elementHolds(rules: Rules, att: Fighter, def: Fighter, scales: boolean): string | null {
  const potency = eff(att, 'breath', { sep: dist(att.pos, def.pos) }).value;
  const { affinity } = affinityAgainst(rules, att, def, scales, dist(att.pos, def.pos));
  const holds = affinity > potency || (affinity === potency && def.sheet.acumen > att.sheet.acumen);
  return holds ? `Affinity ${affinity} holds against Potency ${potency}` : null;
}

/** Any forced movement that meets the wall or an obstacle slams [Proposed]. */
export function slammed(rules: Rules, f: Fighter, slam: string | null, t: number, ev: Event[]) {
  if (!slam) return;
  f.wounds -= rules.SLAM_DAMAGE;
  ev.push({ kind: 'note', tick: t, side: f.side, tag: 'slam', text: `Slammed into ${slam}: takes ${rules.SLAM_DAMAGE}.` });
}

/** A push and a pull in the same moment cancel: Water's jet against Air's vortex [Proposed]. */
export function breathVerbs(bout: Bout, plans: Record<Side, Plan>, all: { s: Side; aim: Vec }[], t: number, ev: Event[], bypass: Set<Side> = new Set()) {
  // First each target's Affinity contests the element (a true-damage Breath ignores it); only verbs that take hold can meet.
  const verbs = all.filter((v) => {
    if (bout.fighters[v.s].sheet.stone !== 'water' && bout.fighters[v.s].sheet.stone !== 'air') return true;
    if (bypass.has(v.s)) return true;
    const held = elementHolds(bout.rules, bout.fighters[v.s], bout.fighters[other(v.s)], guarding(plans[other(v.s)], t));
    if (held) ev.push({ kind: 'note', tick: t, side: other(v.s), tag: 'verb-held', text: `${held}: the ${bout.fighters[v.s].sheet.stone === 'water' ? 'push' : 'pull'} fails.` });
    return !held;
  });
  const stones = verbs.map((v) => bout.fighters[v.s].sheet.stone);
  if (verbs.length === 2 && stones.includes('water') && stones.includes('air')) {
    for (const v of verbs) ev.push({ kind: 'note', tick: t, side: other(v.s), tag: 'push-pull-cancel', text: 'Jet and vortex meet: the push and the pull cancel.' });
    return;
  }
  for (const v of verbs) breathVerb(bout, v.s, v.aim, t, ev);
}

/**
 * Fire leaves burning ground and Earth a corrosive pool, on the floor [Doc] §3. Fire's burns a lane along its line
 * through Close and Far, as wide as the blast [Proposed]; Earth's pools where the breath lands. A zone lingers
 * Potency ÷ 6 slots plus an exchange per charging slot, and each dragon keeps at most ZONE_MAX; the oldest goes out.
 */
export function leaveZone(bout: Bout, s: Side, p: Plan, origin: Vec, aim: Vec, t: number, ev: Event[]) {
  const R2 = bout.rules;
  const f = bout.fighters[s];
  const stone = f.sheet.stone;
  if (stone !== 'fire' && stone !== 'earth') return;
  const kind = stone === 'fire' ? 'burning' : 'corrosive';
  const potency = eff(f, 'breath', {}).value;
  const charged = p.spec.released ? (p.spec.full ? 2 : 1) : 0;
  const linger = R2.ZONE_DURATION_DIVISOR ? Math.floor(potency / R2.ZONE_DURATION_DIVISOR) + charged * R2.ZONE_CHARGE_SLOTS : R2.ZONE_SLOTS;
  const damage = kind === 'burning' ? (R2.BURN_DIVISOR ? Math.floor(potency / R2.BURN_DIVISOR) : R2.BURN_DAMAGE) : 0;
  const along = (d: number) => flat(add(origin, scaleTo(aim, d)));
  const zone: Zone = kind === 'burning' && R2.FIRE_LANE
    ? { kind, center: along(R.MELEE_EDGE), end: along(R.FAR_EDGE), radius: R2.BREATH.blast.radius, damage, lastSlot: bout.globalSlot - 1 + linger, owner: s }
    : { kind, center: along(Math.min(len(aim), stone === 'fire' ? R2.BREATH.blast.maxCenter : R2.BREATH.narrowCone.reach)), radius: R2.ZONE_RADIUS, damage, lastSlot: bout.globalSlot - 1 + linger, owner: s };
  if (R2.ZONE_MAX) {
    const mine = bout.arena.zones.filter((z) => z.owner === s && z.kind !== 'smolder');
    if (mine.length >= R2.ZONE_MAX) bout.arena.zones = bout.arena.zones.filter((z) => !mine.slice(0, mine.length - R2.ZONE_MAX + 1).includes(z));
  }
  bout.arena.zones.push(zone);
  ev.push({ kind: 'zone', tick: t, owner: s, zone: kind, center: zone.center, ...(zone.end ? { end: zone.end } : {}) });
}

/**
 * At slot's end, dragons inside a zone feel it, whoever breathed it; then spent zones fade.
 * Floor zones touch only grounded dragons. A dragon guarding with Mantle Wings (Elder) is shielded.
 * Smoldering Maw: 3 points and the element's verb; overlapping areas stack only for a Venerable.
 */
export function zonesAtSlotEnd(bout: Bout, plans: Record<Side, Plan>, g: number, ev: Event[]) {
  const smoldered = new Set<Side>();
  // Overlapping fires burn a dragon once a slot.
  const burned = new Set<Side>();
  for (const z of bout.arena.zones) {
    for (const s of SIDES) {
      const f = bout.fighters[s];
      if (!inZone(z, f.pos)) continue;
      if (plans[s].spec.name === 'scales' && tech(f, 'mantle-wings') >= E) continue;
      // Stalwart: a True Dragon's own zones never harm it [Proposed].
      if (z.owner === s && f.sheet.aspect === 'stalwart') continue;
      // The zone's element contests the dragon's Affinity, as the breath did [Proposed].
      const held = elementHolds(bout.rules, bout.fighters[z.owner], f, plans[s].spec.name === 'scales');
      if (held && z.kind !== 'smolder') {
        ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: s, tag: 'zone-held', text: `${held}: the ${z.kind === 'burning' ? 'flames' : 'pool'} can't take hold.` });
        continue;
      }
      if (z.kind === 'burning') {
        if (burned.has(s)) continue;
        burned.add(s);
        const burn = z.damage ?? bout.rules.BURN_DAMAGE;
        f.wounds -= burn;
        if (bout.rules.BURN_BLINDS) f.pending.blinded = true;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: burn, woundsLeft: f.wounds });
      } else if (z.kind === 'corrosive') {
        f.pending.corroded = true;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: 0, woundsLeft: f.wounds });
      } else {
        if (smoldered.has(s) && !z.stacks) continue;
        smoldered.add(s);
        f.wounds -= bout.rules.TECHNIQUE_POINTS;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: bout.rules.TECHNIQUE_POINTS, woundsLeft: f.wounds });
        const away = sub(f.pos, z.center);
        if (held) continue;
        if (z.element === 'water') shove(bout, s, away, bout.rules.SMOLDER_PUSH);
        if (z.element === 'air') shove(bout, s, sub(bout.fighters[z.owner].pos, f.pos), bout.rules.SMOLDER_PULL);
        if (z.element === 'earth') f.pending.corroded = true;
      }
    }
    // Smoldering Maw Elder: the lingering area eats at obstacles inside it.
    if (z.kind === 'smolder' && tech(bout.fighters[z.owner], 'smoldering-maw') >= E) {
      for (const o of bout.arena.obstacles) {
        if (o.wounds !== null && flatLen(sub(o.pos, z.center)) <= z.radius + o.radius) o.wounds -= bout.rules.TECHNIQUE_POINTS;
      }
      bout.arena.obstacles = bout.arena.obstacles.filter((o) => o.wounds === null || o.wounds > 0);
    }
  }
  bout.arena.zones = bout.arena.zones.filter((z) => z.lastSlot > g);
  checkKO(bout, ev, R.TICKS_PER_SLOT - 1);
}
