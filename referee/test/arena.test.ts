// Aspects, breath effects, and obstacles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { makeArena, standardBoulders } from '../src/arena.ts';
import { newBout, runExchange, type Bout, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const run = (bout: Bout, A: string[], B: string[]) => runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) });
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

// ---- Aspects (§2) ----

test('Talons: a grounded Wyvern claw is short', () => {
  // At 2.5 paces a True Dragon's claw lands; a Wyvern's doesn't.
  const td = run(newBout(TD_WATER, TD_WATER, 2.5), ['claw:left'], ['hold']);
  const wy = run(newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 2.5), ['claw:left'], ['hold']);
  assert.equal(hits(td).length, 1);
  assert.equal(hits(wy).length, 0);
});

test('Talons: from the air, a Wyvern stoops on a grounded target anywhere within Far, lands at Melee, and claws', () => {
  // Wyvern + Air 3 paces up, 8 paces across the floor: 8.5 paces away, inside Far.
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 8);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
  const ev = run(bout, ['claw:left'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(hits(ev)[0].damage, 12 - 3);
  assert.equal(bout.fighters.A.pos.z, 0, 'lands on the ground');
  assert.ok(Math.abs(bout.fighters.B.pos.x - bout.fighters.A.pos.x) <= R.MELEE_EDGE, 'at Melee');
});

test('Talons: the stoop swipes both ways, catching a target that steps to either side', () => {
  for (const dir of ['strafe:cw', 'strafe:ccw']) {
    const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 6);
    bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
    const ev = run(bout, ['claw:left'], [dir]);
    assert.equal(hits(ev).length, 1, dir);
  }
});

test('Talons: no stoop beyond Far, and none against an airborne opponent', () => {
  const far = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 10);
  far.fighters.A.pos = { ...far.fighters.A.pos, z: 3 * R.PACE };
  run(far, ['claw:left'], ['hold']);
  assert.equal(far.fighters.A.pos.z, 3 * R.PACE, 'stays aloft');

  const air = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, { name: 'H', morph: 'wyvern', stone: 'water' }, 6);
  air.fighters.A.pos = { ...air.fighters.A.pos, z: 3 * R.PACE };
  air.fighters.B.pos = { ...air.fighters.B.pos, z: 3 * R.PACE };
  const ev = run(air, ['claw:left'], ['hold']);
  assert.equal(hits(ev).length, 0, 'a plain claw at 6 paces misses');
  assert.equal(air.fighters.A.pos.z, 3 * R.PACE);
});

test('Serpentine: a strafing Wyrm evades like a dodge; a retreating one does not', () => {
  const ev = run(newBout(TD_WATER, { name: 'C', morph: 'wyrm', stone: 'water' }, 2), ['claw:left', 'claw:left'], ['strafe:cw', 'retreat']);
  assert.ok(ev.some((e) => e.kind === 'evade' && e.text.includes('Serpentine')));
  assert.equal(hits(ev).length, 1);
});

test('the True Dragon\'s Aspect, Stalwart: a flat +9 Wounds', () => {
  const td = newBout(TD_WATER, TD_WATER, 4).fighters.A.sheet;
  assert.equal(td.aspect, 'stalwart');
  assert.equal(td.wounds, 36 + 9);
});

// ---- Breath effects (§3) ----

test('Water pushes the target back a band', () => {
  const bout = newBout({ name: 'T', morph: 'wyrm', stone: 'water' }, TD_WATER, 4);
  const before = bout.fighters.B.pos.x;
  run(bout, ['breath'], ['hold']);
  assert.equal(bout.fighters.B.pos.x - before, R.WATER_PUSH);
});

const AIR_WYRM: FighterSetup = { name: 'G', morph: 'wyrm', stone: 'air' };
const sepOf = (bout: Bout) => Math.hypot(bout.fighters.A.pos.x - bout.fighters.B.pos.x, bout.fighters.A.pos.y - bout.fighters.B.pos.y, bout.fighters.A.pos.z - bout.fighters.B.pos.z);

test('Air\'s vortex pulls the target a band toward the breather', () => {
  const bout = newBout(AIR_WYRM, TD_WATER, 8);
  run(bout, ['breath'], ['hold']);
  assert.equal(Math.round(sepOf(bout)), 8 * R.PACE - R.AIR_PULL);
});

test('the pull stops at Close: the vortex at the breather\'s heart throws Melee back out', () => {
  const close = newBout(AIR_WYRM, TD_WATER, 4.5);
  run(close, ['breath'], ['hold']);
  assert.equal(Math.round(sepOf(close)), R.MELEE_EDGE + R.NOTCH, 'pulled only to the edge of Close');
  const melee = newBout(AIR_WYRM, TD_WATER, 2);
  const ev = run(melee, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('The vortex at its heart throws it out')));
  assert.equal(Math.round(sepOf(melee)), R.MELEE_EDGE + R.NOTCH);
});

test('the vortex lowers a flier a band but never grounds it', () => {
  const bout = newBout(AIR_WYRM, { name: 'W', morph: 'wyvern', stone: 'water' }, 8);
  bout.fighters.B.pos = { ...bout.fighters.B.pos, z: 2 * R.PACE };
  run(bout, ['breath'], ['hold']);
  assert.ok(bout.fighters.B.pos.z > 0 && bout.fighters.B.pos.z < 2 * R.PACE);
});

test('a push and a pull in the same moment cancel', () => {
  const bout = newBout(TD_WATER, AIR_WYRM, 7);
  const a0 = { ...bout.fighters.A.pos };
  const b0 = { ...bout.fighters.B.pos };
  const ev = run(bout, ['breath'], ['breath']);
  assert.equal(hits(ev).length, 2);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.includes('cancel')));
  assert.deepEqual([bout.fighters.A.pos, bout.fighters.B.pos], [a0, b0]);
});

test('Fire leaves a burning zone that hurts grounded dragons inside at slot end, not those aloft', () => {
  const ground = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
  const ev = run(ground, ['breath', 'hold'], ['hold', 'hold']);
  const burns = ev.filter((e) => e.kind === 'zoneEffect' && e.zone === 'burning');
  assert.equal(burns.length, 2, 'the slot it lands and the next');

  const air = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, { name: 'G', morph: 'wyvern', stone: 'water' }, 5);
  air.fighters.B.pos = { ...air.fighters.B.pos, z: 2 * R.PACE };
  const ev2 = run(air, ['breath', 'hold'], ['hold', 'hold']);
  assert.equal(ev2.filter((e) => e.kind === 'zoneEffect').length, 0);
});

test('Earth leaves a corrosive pool: Hardness −3 the next slot', () => {
  // Wyrm + Earth breathes on Brine, then Brine's corroded Hardness is 0: a bite deals the full 12.
  const bout = newBout({ name: 'C', morph: 'wyrm', stone: 'earth' }, TD_WATER, 4);
  const ev = run(bout, ['breath', 'bite'], ['hold', 'hold']);
  assert.deepEqual(hits(ev).map((h) => h.action), ['breath', 'bite']);
  assert.equal(hits(ev)[1].damage, 12);
});

// ---- Obstacles (§5) ----

test('four unbreakable pillars stand at the quadrants', () => {
  const a = makeArena();
  const pillars = a.obstacles.filter((o) => o.kind === 'pillar');
  assert.equal(pillars.length, 4);
  assert.ok(pillars.every((o) => o.wounds === null));
});

test('seeded boulders: same seed, same map; starting spots stay clear', () => {
  const keep = [{ x: -975, y: 0, z: 0 }, { x: 975, y: 0, z: 0 }];
  const a = makeArena({ boulders: 3, seed: 42 }, keep);
  const b = makeArena({ boulders: 3, seed: 42 }, keep);
  assert.deepEqual(a, b);
  assert.equal(a.obstacles.length, 7);
  for (const o of a.obstacles.filter((x) => x.kind === 'boulder')) {
    for (const k of keep) assert.ok(Math.hypot(o.pos.x - k.x, o.pos.y - k.y) >= o.radius + R.BOULDER_CLEARANCE);
  }
});

test('an obstacle in the way takes the hit instead', () => {
  // True Dragon + Air breathes 6 into a large boulder (9 Wounds): the boulder holds, the target is untouched.
  const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, TD_WATER, 5.5, 'B', { obstacles: [{ size: 'large', x: 0, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev).length, 0);
  const o = ev.find((e) => e.kind === 'obstacle');
  assert.ok(o && o.kind === 'obstacle' && o.damage === 6 && !o.destroyed);
});

test('Earth breath eats through an obstacle it destroys and carries on', () => {
  const bout = newBout({ name: 'C', morph: 'true-dragon', stone: 'earth' }, TD_WATER, 5.5, 'B', { obstacles: [{ size: 'large', x: 0, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(bout.arena.obstacles.filter((o) => o.kind === 'boulder').length, 0);
});

test('attacks on the same obstacle in the same tick land together', () => {
  // Both breathe through the same boulder on the same tick: neither sees it vanish early.
  const bout = newBout(TD_WATER, { name: 'C', morph: 'true-dragon', stone: 'earth' }, 6, 'B', { obstacles: [{ size: 'medium', x: 0, y: 0 }] });
  const ev = run(bout, ['breath'], ['breath']);
  const strikes = ev.filter((e) => e.kind === 'obstacle');
  assert.equal(strikes.length, 2);
  assert.equal(hits(ev).length, 1, 'only Earth carries on through the destroyed boulder');
});

test('a move into an obstacle is blocked and becomes a dodge', () => {
  const bout = newBout(TD_WATER, TD_WATER, 5.5, 'B', { obstacles: [{ size: 'large', x: 0, y: 0 }] });
  const ev = run(bout, ['approach'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Blocked by large boulder')));
});

test('a flyer above a boulder passes over it', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 6, 'B', { obstacles: [{ size: 'small', x: -1, y: 0 }] });
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 2 * R.PACE };
  const ev = run(bout, ['approach'], ['hold']);
  assert.ok(!ev.some((e) => e.kind === 'note' && e.text.startsWith('Blocked')));
});

// ---- Water's jet [Proposed]: a band of push, a slam into barriers, and boulders shoved ----

const TD_AIR: FighterSetup = { name: 'Gust', morph: 'true-dragon', stone: 'air' };

test('Water\'s jet pushes the target back a whole band', () => {
  const bout = newBout(TD_WATER, TD_AIR, 5);
  const x0 = bout.fighters.B.pos.x;
  run(bout, ['breath'], ['hold']);
  assert.equal(bout.fighters.B.pos.x - x0, R.WATER_PUSH);
});

test('a push into the arena wall slams for 3', () => {
  const bout = newBout(TD_WATER, TD_AIR, 5);
  bout.fighters.A.pos = { x: R.ARENA_RADIUS - 6 * R.PACE, y: 0, z: 0 };
  bout.fighters.B.pos = { x: R.ARENA_RADIUS - R.PACE, y: 0, z: 0 };
  const w0 = bout.fighters.B.wounds;
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === `Slammed into the arena wall: takes ${R.SLAM_DAMAGE}.`));
  assert.equal(w0 - bout.fighters.B.wounds, hits(ev)[0].damage + R.SLAM_DAMAGE);
});

test('a push into an obstacle slams for 3', () => {
  const bout = newBout(TD_WATER, TD_AIR, 5, 'B', { obstacles: [{ size: 'large', x: 5, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Slammed into') && e.text.endsWith(`takes ${R.SLAM_DAMAGE}.`)));
});

test('Water\'s jet shoves a boulder it strikes', () => {
  const bout = newBout(TD_WATER, TD_AIR, 6, 'B', { obstacles: [{ size: 'large', x: 0, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'obstacle'));
  const boulder = bout.arena.obstacles.find((o) => o.kind === 'boulder')!;
  assert.ok(boulder.pos.x > 0, 'the boulder moved toward B');
  assert.equal(boulder.wounds, 9, 'shoved, not broken');
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('The jet shoves')));
});

test('a landed jet breaks a charge', () => {
  const ev = run(newBout(TD_WATER, TD_AIR, 5), ['breath', 'hold'], ['charge:breath', 'breath']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === 'The hit breaks the charge.'));
});

// ---- Affinity contests the element [Proposed] ----

test('a verb lands only if Potency beats Affinity: a Wyrm + Water shrugs off a weak pull', () => {
  // Wyrm + Air breathes Potency 6; Wyrm + Water's Affinity 9 holds.
  const bout = newBout({ name: 'G', morph: 'wyrm', stone: 'air' }, { name: 'H', morph: 'wyrm', stone: 'water' }, 8);
  const x0 = bout.fighters.B.pos.x;
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev).length, 1, 'the breath still hits');
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === 'Affinity 9 holds against Potency 6: the pull fails.'));
  assert.equal(bout.fighters.B.pos.x, x0);
});

test('Scales adds its Affinity to the contest', () => {
  // True Dragon + Water's jet (Potency 9) against a True Dragon + Fire (Affinity 6): lands bare; under Scales it's 9 against 9, and a tie goes to the higher Acumen.
  const bare = newBout(TD_WATER, { name: 'F', morph: 'true-dragon', stone: 'fire' }, 5);
  assert.ok(run(bare, ['breath'], ['hold']).some((e) => e.kind === 'note' && e.text.startsWith('The jet pushes it back')));
  const guarded = newBout(TD_WATER, { name: 'F', morph: 'true-dragon', stone: 'fire' }, 5);
  guarded.fighters.B.sheet.acumen = 11;
  assert.ok(run(guarded, ['breath'], ['scales']).some((e) => e.kind === 'note' && e.text.includes('holds against Potency 9')));
});

test('zones contest Affinity too: a burning zone can\'t take hold of high Affinity', () => {
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
  bout.fighters.B.sheet.affinity = 20;
  const ev = run(bout, ['breath', 'hold'], ['hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'zoneEffect' && e.zone === 'burning').length, 0);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.endsWith("the flames can't take hold.")));
});

test('a Scales slot held to the end fills the Acumen meter a step', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  const m0 = bout.fighters.A.meter;
  run(bout, ['scales'], ['hold']);
  assert.equal(bout.fighters.A.meter, m0 + R.SCALES_ACUMEN);
});

test('standard arenas throw 1d4+2 boulders', () => {
  const counts = new Set(Array.from({ length: 200 }, (_, i) => standardBoulders(i)));
  assert.deepEqual([...counts].sort(), [3, 4, 5, 6]);
});
