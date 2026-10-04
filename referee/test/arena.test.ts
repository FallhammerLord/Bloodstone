// Aspects, breath effects, and obstacles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { makeArena } from '../src/arena.ts';
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

test('Talons: from the air, the Wyvern claw strikes straight down', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 2);
  bout.fighters.A.pos = { x: bout.fighters.B.pos.x, y: 0, z: 2 * R.PACE }; // directly overhead
  const ev = run(bout, ['claw:left'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(hits(ev)[0].damage, 12 - 3);
});

test('Serpentine: a strafing Wyrm evades like a dodge; a retreating one does not', () => {
  const ev = run(newBout(TD_WATER, { name: 'C', morph: 'wyrm', stone: 'water' }, 2), ['claw:left', 'claw:left'], ['strafe:cw', 'retreat']);
  assert.ok(ev.some((e) => e.kind === 'evade' && e.text.includes('Serpentine')));
  assert.equal(hits(ev).length, 1);
});

test('the True Dragon has no Aspect', () => {
  assert.equal(newBout(TD_WATER, TD_WATER, 4).fighters.A.sheet.aspect, 'none');
});

// ---- Breath effects (§3) ----

test('Water pushes the target back one pace', () => {
  const bout = newBout({ name: 'T', morph: 'wyrm', stone: 'water' }, TD_WATER, 4);
  const before = bout.fighters.B.pos.x;
  run(bout, ['breath'], ['hold']);
  assert.equal(bout.fighters.B.pos.x - before, R.WATER_PUSH);
});

test('Air shoves the target sideways one pace', () => {
  const bout = newBout({ name: 'G', morph: 'wyrm', stone: 'air' }, TD_WATER, 4);
  run(bout, ['breath'], ['hold']);
  assert.equal(Math.abs(bout.fighters.B.pos.y), R.AIR_SHOVE);
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
