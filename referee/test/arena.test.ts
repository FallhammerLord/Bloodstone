// Aspects, breath effects, and obstacles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { makeArena, standardBoulders } from '../src/arena.ts';
import { newBout, runExchange, simulateSlot, type Bout, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const run = (bout: Bout, A: string[], B: string[]) => runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) });
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

// ---- Aspects (§2) ----

test('Claw reaches Melee\'s edge and sweeps into Close, a grounded Wyvern\'s included', () => {
  for (const sep of [2.5, 3.25]) {
    const wy = run(newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, sep), ['claw:left'], ['hold']);
    assert.equal(hits(wy).length, 1, `${sep} paces`);
  }
  assert.equal(hits(run(newBout(TD_WATER, TD_WATER, 3.75), ['claw:left'], ['hold'])).length, 0, 'not deep into Close');
});

test('reaches are whole bands: Bite through Close, Stomp through Close at wyrmling', () => {
  assert.equal(hits(run(newBout(TD_WATER, TD_WATER, 6), ['bite'], ['hold'])).length, 1, 'Bite at Close\'s edge');
  assert.equal(hits(run(newBout(TD_WATER, TD_WATER, 6.5), ['bite'], ['hold'])).length, 0, 'not into Far');
  assert.equal(hits(run(newBout(TD_WATER, TD_WATER, 6), ['stomp'], ['hold'])).length, 1, 'Stomp at Close\'s edge');
});

test('Talons: from the air, a stoop descends and carries at most a band forward, then claws', () => {
  // Wyvern + Air 3 paces up, 5 paces across the floor: the stoop carries a band and lands 2 paces short.
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 5);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
  const ev = run(bout, ['claw:left'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(hits(ev)[0].damage, 12 - 6 + Math.floor(3 / R.DEFAULT_RULES.STOOP_PACES_PER_POINT), 'Claw 12, Hardness 6, +1 for a 3-pace fall');
  assert.equal(hits(ev)[0].tick, 6 + 3 * R.DEFAULT_RULES.STOOP_TICKS_PER_PACE, 'the descent takes 2 ticks a pace');
  assert.ok(hits(ev)[0].tags.includes('stoop'));
  assert.equal(bout.fighters.A.pos.z, 0, 'lands on the ground');
  assert.equal(Math.abs(bout.fighters.B.pos.x - bout.fighters.A.pos.x), 2 * R.PACE, 'a band forward, no further');
});

test('Talons: a stoop from Far carries only a band, and falls short', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 8);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
  const ev = run(bout, ['claw:left'], ['hold']);
  assert.equal(hits(ev).length, 0);
  assert.equal(Math.abs(bout.fighters.B.pos.x - bout.fighters.A.pos.x), 5 * R.PACE, 'lands at Close, out of Claw reach');
});

test('Talons: a stoop can carry back a band instead, landing clear', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 2);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
  const ev = run(bout, ['claw:left:back'], ['hold']);
  assert.equal(hits(ev).length, 0);
  assert.equal(bout.fighters.A.pos.z, 0);
  assert.equal(Math.abs(bout.fighters.B.pos.x - bout.fighters.A.pos.x), 5 * R.PACE, 'a band back from 2 paces');
});

test('Talons: a Wyvern\'s Leap climbs two bands', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 8);
  run(bout, ['leap', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(bout.fighters.A.pos.z, 2 * R.BAND);
  const td = newBout(TD_WATER, TD_WATER, 8);
  run(td, ['leap', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(td.fighters.A.pos.z, R.BAND, 'other fliers climb one');
});

test('Talons: a high stoop is slow enough for a Stomp to catch it landing; a low one beats the Stomp', () => {
  const stoop = (z: number) => {
    const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 4.5);
    bout.fighters.A.pos = { ...bout.fighters.A.pos, z };
    return hits(run(bout, ['claw:left'], ['stomp']));
  };
  const high = stoop(2 * R.BAND);
  assert.deepEqual(high.map((h) => h.action), ['stomp'], 'two bands: lands at tick 17, the quake is still live, and the Claw never comes');
  const low = stoop(R.BAND);
  assert.deepEqual(low.map((h) => h.action), ['claw'], 'one band: the Claw lands at tick 12 and interrupts the Stomp');
});

test('Talons: the stoop swipes both ways, catching a target that steps to either side', () => {
  for (const dir of ['strafe:cw', 'strafe:ccw']) {
    const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 4);
    bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
    const ev = run(bout, ['claw:left'], [dir]);
    assert.equal(hits(ev).length, 1, dir);
  }
});

test('Talons: no stoop beyond Far, and none against an airborne opponent', () => {
  const far = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 10);
  far.fighters.A.pos = { ...far.fighters.A.pos, z: 3 * R.PACE };
  simulateSlot(far, { A: parseAction('claw:left'), B: parseAction('hold') });
  assert.equal(far.fighters.A.pos.z, 3 * R.PACE, 'stays aloft');

  const air = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, { name: 'H', morph: 'wyvern', stone: 'water' }, 6);
  air.fighters.A.pos = { ...air.fighters.A.pos, z: 3 * R.PACE };
  air.fighters.B.pos = { ...air.fighters.B.pos, z: 3 * R.PACE };
  const ev = simulateSlot(air, { A: parseAction('claw:left'), B: parseAction('hold') });
  assert.equal(hits(ev).length, 0, 'a plain claw at 6 paces misses');
  assert.equal(air.fighters.A.pos.z, 3 * R.PACE);
});

test('Serpentine: a strafing Wyrm evades like a dodge; a retreating one does not', () => {
  // Wyrm + Earth (Acumen 10): a Wyrm + Water's preferred +3 Acumen would win the Evasion tie against the retreat too.
  const ev = run(newBout(TD_WATER, { name: 'C', morph: 'wyrm', stone: 'earth' }, 2), ['claw:left', 'claw:left'], ['strafe:cw', 'retreat']);
  assert.ok(ev.some((e) => e.kind === 'evade' && e.text.includes('Serpentine')));
  assert.equal(hits(ev).length, 1);
});

test('the True Dragon\'s Aspect, Stalwart: 42 base Wounds (its peak), and its Breath keeps the usual timing', () => {
  const td = newBout(TD_WATER, TD_WATER, 5);
  assert.equal(td.fighters.A.sheet.aspect, 'stalwart');
  assert.equal(td.fighters.A.sheet.wounds, 42);
  assert.equal(hits(run(td, ['breath'], ['hold']))[0].tick, 12);
});

test('Stalwart: a True Dragon\'s own zones never harm it', () => {
  // Each breathes a lane at a target 5 paces off, then advances a band into its own fire. Only the True Dragon walks it unharmed.
  const own = (morph: 'true-dragon' | 'wyrm') => {
    const bout = newBout({ name: 'E', morph, stone: 'fire' }, TD_WATER, 5);
    const ev = run(bout, ['breath', 'approach', 'hold'], ['hold', 'hold', 'hold']);
    return ev.filter((e) => e.kind === 'zoneEffect' && e.side === 'A').length;
  };
  assert.equal(own('true-dragon'), 0);
  assert.ok(own('wyrm') > 0, 'a Wyrm burns in its own fire');
});
test('Stalwart: each charging slot widens a True Dragon\'s released Breath by ½ pace', () => {
  // At a ½-pace radius, a slow target retreating out of it slips a plain blast; a charged one is widened.
  const rules = R.rulesWith({ BREATH: { blast: { radius: Math.floor(R.PACE / 2) } } });
  const plain = run(newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5, 'B', {}, rules), ['hold', 'breath'], ['hold', 'retreat']);
  const charged = run(newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5, 'B', {}, rules), ['charge:breath', 'charge:breath', 'breath'], ['hold', 'hold', 'retreat']);
  assert.equal(hits(plain).filter((h) => h.attacker === 'A').length, 0, 'the plain blast misses the retreat');
  assert.equal(hits(charged).filter((h) => h.attacker === 'A').length, 1, 'two charging slots widen it a pace: it catches the retreat');
});

// ---- Breath effects (§3) ----

test('Water pushes the target back a band', () => {
  const bout = newBout({ name: 'T', morph: 'wyrm', stone: 'water' }, TD_WATER, 4);
  const before = bout.fighters.B.pos.x;
  run(bout, ['breath'], ['hold']);
  assert.equal(bout.fighters.B.pos.x - before, R.DEFAULT_RULES.WATER_PUSH);
});

const AIR_WYRM: FighterSetup = { name: 'G', morph: 'wyrm', stone: 'air' };
const sepOf = (bout: Bout) => Math.hypot(bout.fighters.A.pos.x - bout.fighters.B.pos.x, bout.fighters.A.pos.y - bout.fighters.B.pos.y, bout.fighters.A.pos.z - bout.fighters.B.pos.z);

test('Air\'s vortex pulls the target a band toward the breather', () => {
  const bout = newBout(AIR_WYRM, TD_WATER, 8);
  run(bout, ['breath'], ['hold']);
  assert.equal(Math.round(sepOf(bout)), 8 * R.PACE - R.DEFAULT_RULES.AIR_PULL);
});

test('the pull stops at Close: the vortex at the breather\'s heart throws Melee back out', () => {
  const close = newBout(AIR_WYRM, TD_WATER, 4.5);
  run(close, ['breath'], ['hold']);
  assert.ok(sepOf(close) > R.MELEE_EDGE && sepOf(close) <= R.MELEE_EDGE + R.DEFAULT_RULES.SNAP, 'pulled only to the edge of Close');
  const melee = newBout(AIR_WYRM, TD_WATER, 2);
  const ev = run(melee, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('The vortex at its heart throws it out')));
  assert.ok(sepOf(melee) > R.MELEE_EDGE && sepOf(melee) <= R.MELEE_EDGE + R.DEFAULT_RULES.SNAP);
});

test('the vortex lowers a flier a band but never grounds it', () => {
  const bout = newBout(AIR_WYRM, { name: 'W', morph: 'wyvern', stone: 'water' }, 8);
  bout.fighters.B.pos = { ...bout.fighters.B.pos, z: 2 * R.PACE };
  simulateSlot(bout, { A: parseAction('breath'), B: parseAction('hold') });
  assert.ok(bout.fighters.B.pos.z > 0 && bout.fighters.B.pos.z < 2 * R.PACE);
});

test('a push and a pull in the same moment cancel', () => {
  // Both verbs must take hold to meet: a Wyvern + Water (Affinity 9) ties the Wyrm + Air's Potency 9, so the pull lands.
  const bout = newBout({ name: 'T', morph: 'wyvern', stone: 'water' }, AIR_WYRM, 7);
  const a0 = { ...bout.fighters.A.pos };
  const b0 = { ...bout.fighters.B.pos };
  const ev = run(bout, ['breath'], ['breath']);
  assert.equal(hits(ev).length, 2);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.includes('cancel')));
  assert.deepEqual([bout.fighters.A.pos, bout.fighters.B.pos], [a0, b0]);
});

test('Fire sets a lane burning through Close and Far: grounded dragons inside burn at slot end, not those aloft', () => {
  // True Dragon + Fire, Potency 18: the lane lingers 18 ÷ 6 = 3 slots after the one it lands in, and burns for 18 ÷ 4 = 4.
  const D = R.DEFAULT_RULES;
  const ground = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
  const ev = run(ground, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  const burns = ev.filter((e): e is Extract<Event, { kind: 'zoneEffect' }> => e.kind === 'zoneEffect' && e.zone === 'burning');
  assert.equal(burns.length, 3, 'every slot of the exchange');
  assert.ok(burns.every((b) => b.damage === Math.floor(18 / D.BURN_DIVISOR)));
  assert.ok(ground.arena.zones.some((z) => z.kind === 'burning' && z.end), 'the lane lingers into the next exchange');

  const air = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, { name: 'G', morph: 'wyvern', stone: 'water' }, 5);
  air.fighters.B.pos = { ...air.fighters.B.pos, z: 2 * R.PACE };
  const ev2 = run(air, ['breath', 'hold'], ['hold', 'hold']);
  assert.equal(ev2.filter((e) => e.kind === 'zoneEffect').length, 0);
});

test('the lane starts at the Melee edge: a target at Melee takes the blast but not the burn', () => {
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 2);
  const ev = run(bout, ['breath', 'hold'], ['hold', 'hold']);
  assert.ok(hits(ev).some((h) => h.attacker === 'A'));
  assert.equal(ev.filter((e) => e.kind === 'zoneEffect').length, 0);
});

test('each charging slot adds an exchange to the fire; each dragon keeps at most ZONE_MAX', () => {
  const lingers = (A: string[]) => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
    run(bout, A, A.map(() => 'hold'));
    const z = bout.arena.zones.find((x) => x.kind === 'burning')!;
    return z.lastSlot;
  };
  assert.equal(lingers(['charge:breath', 'charge:breath', 'breath']) - lingers(['hold', 'hold', 'breath']), 2 * R.DEFAULT_RULES.ZONE_CHARGE_SLOTS);

  // With fires that linger long, a third Breath puts out the first.
  const rules = R.rulesWith({ ZONE_DURATION_DIVISOR: 1 });
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5, 'B', {}, rules);
  for (let i = 0; i < 3; i++) runExchange(bout, { A: ['breath', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.equal(bout.arena.zones.filter((z) => z.owner === 'A').length, rules.ZONE_MAX);
});
test('Earth corrodes on the hit: +Potency ÷ 4 from every hit while it lasts, and each such hit fills the attacker\'s meter', () => {
  // Wyrm + Earth (Potency 12) breathes on a True Dragon + Earth (Affinity 6, so the verb holds), then bites: Bite 15,
  // Hardness 6 pierced to 3, +3 corroded.
  const bout = newBout({ name: 'C', morph: 'wyrm', stone: 'earth' }, { name: 'Clod', morph: 'true-dragon', stone: 'earth' }, 4);
  const ev = run(bout, ['breath', 'bite'], ['hold', 'hold']);
  assert.deepEqual(hits(ev).map((h) => h.action), ['breath', 'bite']);
  assert.equal(hits(ev)[1].damage, 15 - 3 + Math.floor(12 / R.DEFAULT_RULES.CORRODE_DIVISOR));
  assert.ok(hits(ev)[1].tags.includes('corroded'));
  assert.ok(ev.some((e) => e.kind === 'note' && e.side === 'A' && e.text.includes('hit on a corroded target')));
  assert.equal(bout.arena.zones.length, 0, 'no pool');
});

test('corrosion wears off after Potency ÷ 6 slots', () => {
  const bout = newBout({ name: 'C', morph: 'wyrm', stone: 'earth' }, { name: 'Clod', morph: 'true-dragon', stone: 'earth' }, 4);
  run(bout, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  const ev = run(bout, ['bite', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(!hits(ev)[0].tags.includes('corroded'), 'landed in slot 1, lasting 2 more: gone by the next exchange');
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
    for (const k of keep) assert.ok(Math.hypot(o.pos.x - k.x, o.pos.y - k.y) >= o.radius + R.DEFAULT_RULES.BOULDER_CLEARANCE);
  }
});

test('an obstacle in the way takes the hit instead', () => {
  // True Dragon + Air breathes 15 into a large boulder (9 Wounds): the boulder shatters, and the target is untouched.
  const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, TD_WATER, 5.5, 'B', { obstacles: [{ size: 'large', x: 0, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev).length, 0);
  const o = ev.find((e) => e.kind === 'obstacle');
  assert.ok(o && o.kind === 'obstacle' && o.damage === 15 && o.destroyed);
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
  assert.equal(bout.fighters.B.pos.x - x0, R.DEFAULT_RULES.WATER_PUSH);
});

test('a push into the arena wall slams for 3', () => {
  const bout = newBout(TD_WATER, TD_AIR, 5);
  bout.fighters.A.pos = { x: R.DEFAULT_RULES.ARENA_RADIUS - 6 * R.PACE, y: 0, z: 0 };
  bout.fighters.B.pos = { x: R.DEFAULT_RULES.ARENA_RADIUS - R.PACE, y: 0, z: 0 };
  const w0 = bout.fighters.B.wounds;
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === `Slammed into the arena wall: takes ${R.DEFAULT_RULES.SLAM_DAMAGE}.`));
  assert.equal(w0 - bout.fighters.B.wounds, hits(ev)[0].damage + R.DEFAULT_RULES.SLAM_DAMAGE);
});

test('a push into an obstacle slams for 3', () => {
  const bout = newBout(TD_WATER, TD_AIR, 5, 'B', { obstacles: [{ size: 'large', x: 5, y: 0 }] });
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Slammed into') && e.text.endsWith(`takes ${R.DEFAULT_RULES.SLAM_DAMAGE}.`)));
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
  const ev = run(newBout(TD_WATER, { name: 'W', morph: 'wyvern', stone: 'air' }, 5), ['breath', 'hold'], ['charge:breath', 'breath']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === 'The hit breaks the charge.'));
});

// ---- Affinity contests the element [Proposed] ----

test('a verb lands only if Potency beats Affinity, and the element wheel counts: Air scatters Water', () => {
  // Wyrm + Air breathes Potency 15 at Wyvern + Water, Affinity 15 (Acumen raised to 11). Air beats Water, so the wheel
  // takes 3 off: 15 against 12, and the pull lands. Without the wheel, 15 against 15 ties to the higher Acumen, and holds.
  const pull = (rules = R.DEFAULT_RULES) => {
    const bout = newBout({ name: 'G', morph: 'wyrm', stone: 'air' }, { name: 'H', morph: 'wyvern', stone: 'water' }, 8, 'B', {}, rules);
    bout.fighters.B.sheet.acumen = 11;
    const x0 = bout.fighters.B.pos.x;
    const ev = run(bout, ['breath'], ['hold']);
    assert.equal(hits(ev).length, 1, 'the breath still hits');
    return { moved: bout.fighters.B.pos.x !== x0, ev };
  };
  assert.ok(pull().moved);
  const off = pull(R.rulesWith({ ELEMENT_MATCHUP_CONTEST: 0 }));
  assert.ok(!off.moved);
  assert.ok(off.ev.some((e) => e.kind === 'note' && e.text === 'Affinity 15 holds against Potency 15: the pull fails.'));
});

test('the wheel shapes a burn as it shapes the Breath: Earth smothers Fire, Fire consumes Air', () => {
  // True Dragon + Fire burns for 18 ÷ 4 = 4: against Earth 4 − 3 = 1; against Air 4 + 3 = 7; against Water, neutral, 4.
  const burn = (stone: 'earth' | 'air' | 'water') => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, { name: 'T', morph: 'wyrm', stone }, 5);
    const ev = run(bout, ['breath', 'hold'], ['hold', 'hold']);
    const b = ev.find((e): e is Extract<Event, { kind: 'zoneEffect' }> => e.kind === 'zoneEffect');
    return b?.damage;
  };
  assert.equal(burn('earth'), 1);
  assert.equal(burn('air'), 7);
  assert.equal(burn('water'), 4);
});test('Scales adds its Affinity to the contest', () => {
  // True Dragon + Water's jet (Potency 18) against a True Dragon + Fire (Affinity 15): lands bare; under Scales it's 18 against 18, and a tie goes to the higher Acumen.
  const bare = newBout(TD_WATER, { name: 'F', morph: 'true-dragon', stone: 'fire' }, 5);
  assert.ok(run(bare, ['breath'], ['hold']).some((e) => e.kind === 'note' && e.text.startsWith('The jet pushes it back')));
  const guarded = newBout(TD_WATER, { name: 'F', morph: 'true-dragon', stone: 'fire' }, 5);
  guarded.fighters.B.sheet.acumen = 11;
  assert.ok(run(guarded, ['breath'], ['scales']).some((e) => e.kind === 'note' && e.text.includes('holds against Potency 18')));
});

test('zones contest Affinity too: a burning zone can\'t take hold of high Affinity', () => {
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
  bout.fighters.B.sheet.affinity = 20;
  const ev = run(bout, ['breath', 'hold'], ['hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'zoneEffect' && e.zone === 'burning').length, 0);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.endsWith("the flames can't take hold.")));
});

// ---- The Surge, fueled by Affinity [Proposed] ----

test('Surge starts at Acumen: 10 × age category, +3 for a Water-preferring dragon', () => {
  const bout = newBout(TD_WATER, { name: 'H', morph: 'wyrm', stone: 'water' }, 6);
  assert.equal(bout.fighters.A.meter, 10, 'True Dragon + Water, a wyrmling: 10');
  assert.equal(bout.fighters.B.meter, 13, 'Wyrm + Water, preferred: Acumen 13');
});

test('Scales, Dodge and a Breath charge held to the end each fill Affinity + the base fill', () => {
  for (const action of ['scales', 'dodge', 'charge:breath']) {
    const bout = newBout(TD_WATER, TD_WATER, 6);
    const m0 = bout.fighters.A.meter;
    simulateSlot(bout, { A: parseAction(action), B: parseAction('hold') });
    assert.equal(bout.fighters.A.meter, m0 + 12 + R.DEFAULT_RULES.METER_BASE_FILL, action); // True Dragon + Water, Affinity 12
  }
  const bite = newBout(TD_WATER, TD_WATER, 6);
  const m0 = bite.fighters.A.meter;
  simulateSlot(bite, { A: parseAction('charge:bite'), B: parseAction('hold') });
  assert.equal(bite.fighters.A.meter, m0, 'a Bite charge fills nothing');
});

test('a landed Breath fills the breather by its Affinity + the base fill', () => {
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'earth' }, TD_WATER, 5);
  const m0 = bout.fighters.A.meter;
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(bout.fighters.A.meter, m0 + 6 + R.DEFAULT_RULES.METER_BASE_FILL, 'True Dragon + Earth, Affinity 6');
});

test('a full meter makes the next landed hit true damage, then empties; a miss spends nothing', () => {
  const bout = newBout(TD_WATER, { name: 'H', morph: 'wyrm', stone: 'earth' }, 2);
  bout.fighters.A.meter = R.METER_MAX;
  const whiff = run(bout, ['stomp'], ['hold']);
  assert.ok(hits(whiff).length === 1 && bout.fighters.A.meter === R.METER_MAX, 'a Stomp never spends it');
  const ev = run(bout, ['claw:left'], ['hold']);
  assert.equal(hits(ev)[0].damage, 9 + Math.floor(12 / R.DEFAULT_RULES.METER_STEROID_DIVISOR), 'Claw 9 straight through Hardness 9, +4 for Affinity 12 ÷ 3');
  assert.ok(hits(ev)[0].parts.includes('true damage (full Surge)'));
  assert.equal(bout.fighters.A.meter, 0);
});

test('a true-damage Breath ignores Affinity, and its verb can\'t be held', () => {
  const bout = newBout({ name: 'G', morph: 'wyrm', stone: 'air' }, { name: 'H', morph: 'wyrm', stone: 'water' }, 8);
  bout.fighters.A.meter = R.METER_MAX;
  const ev = run(bout, ['breath'], ['hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('The vortex pulls it in')));
});

test('standard arenas throw 1d4+2 boulders', () => {
  const counts = new Set(Array.from({ length: 200 }, (_, i) => standardBoulders(i)));
  assert.deepEqual([...counts].sort(), [3, 4, 5, 6]);
});

// ---- Gravity, the delayed stoop, and the Stomp's quake [Proposed] ----

test('gravity: a flier that doesn\'t Leap during an exchange drops a band at its end', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'water' }, TD_WATER, 6);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 6 * R.PACE };
  run(bout, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(bout.fighters.A.pos.z, 3 * R.PACE);
  run(bout, ['leap', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(bout.fighters.A.pos.z, R.DEFAULT_RULES.MAX_ALTITUDE, 'a Leap holds it up for the exchange (two bands, to the ceiling)');
});

test('a Wyvern can\'t Leap and stoop in the same exchange', () => {
  const bout = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 6);
  const ev = run(bout, ['leap', 'claw:left', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === 'Not aloft since the exchange began: too soon to stoop.'));
  const next = run(bout, ['claw:left', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(next.some((e) => e.kind === 'note' && e.text.startsWith('Stoops from')), 'aloft since the exchange began: it stoops');
});

test('Stomp deals 3 + Hardness ÷ 3, and its quake shatters boulders inside its radius', () => {
  const bout = newBout({ name: 'C', morph: 'wyrm', stone: 'earth' }, TD_WATER, 1.5, 'B', { obstacles: [{ size: 'small', x: -1.5, y: -1.5 }] });
  const ev = run(bout, ['stomp'], ['hold']);
  assert.equal(hits(ev)[0].damage, R.DEFAULT_RULES.STOMP_DAMAGE + Math.floor(9 / R.DEFAULT_RULES.STOMP_HARDNESS_DIVISOR.wyrmling), 'a Wyrm\'s Hardness 9 adds 3');
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('The quake shatters')));
  assert.equal(bout.arena.obstacles.filter((o) => o.kind === 'boulder').length, 0);
});

test('between slots, separation snaps to the nearest ½ pace', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6.2);
  run(bout, ['hold'], ['hold']);
  assert.equal(Math.round(sepOf(bout)) % R.DEFAULT_RULES.SNAP, 0);
  assert.equal(Math.round(sepOf(bout)), 6 * R.PACE);
});

// ---- Aim settles by Accuracy [Proposed] ----

test('aim follows through the wind-up and settles 12 − Accuracy ticks out: radius then decides slow movers', () => {
  const fire = (radius: number, target: FighterSetup, move: string) => {
    const rules = R.rulesWith({ BREATH: { blast: { radius: Math.floor(radius * R.PACE) } } });
    const ev = run(newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, target, 5, 'B', {}, rules), ['breath'], [move]);
    return hits(ev).filter((h) => h.attacker === 'A').length;
  };
  // True Dragon + Fire has Accuracy 3 (Claw 6 − Evasion 3): its aim settles 9 ticks out.
  assert.equal(fire(1, TD_WATER, 'retreat'), 0, "a 1-pace blast misses a slow True Dragon's retreat");
  assert.equal(fire(1.25, TD_WATER, 'retreat'), 1, 'a 1¼-pace blast catches it');
  assert.equal(fire(1.5, { name: 'W', morph: 'wyvern', stone: 'water' }, 'retreat'), 0, "a Wyvern's quick move slips even 1½ paces");
});

// ---- Serpentine against Breath, and Stomp catching movers [Proposed] ----

test('Serpentine: a strafing Wyrm slips a Breath (Evasion 6 + 3 against Accuracy 6); a held one takes it', () => {
  // Earth's cone is wide enough at 5 paces that a short strafe stays inside it: geometry first, then the Evasion test.
  const breathOn = (move: string) => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'earth' }, { name: 'C', morph: 'wyrm', stone: 'earth' }, 5);
    return run(bout, ['breath'], [move]);
  };
  const strafing = breathOn('strafe:cw:short');
  assert.equal(hits(strafing).filter((h) => h.attacker === 'A').length, 0);
  assert.ok(strafing.some((e) => e.kind === 'evade' && e.action === 'breath' && e.how === 'serpentine'));
  assert.equal(hits(breathOn('hold')).filter((h) => h.attacker === 'A').length, 1);
  const off = newBout({ name: 'E', morph: 'true-dragon', stone: 'earth' }, { name: 'C', morph: 'wyrm', stone: 'earth' }, 5, 'B', {}, R.rulesWith({ SERPENTINE_BREATH: 0 }));
  assert.equal(hits(run(off, ['breath'], ['strafe:cw:short'])).filter((h) => h.attacker === 'A').length, 1, 'with the dial off, Breath skips Evasion');
});

test('a Stomp that lands mid-move Staggers for two slots, and a Staggered Wyrm can\'t slip a Breath', () => {
  // The Stomp lands at tick 15, after the strafe's evasive window: caught in recovery, Staggered two slots.
  const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'air' }, { name: 'C', morph: 'wyrm', stone: 'earth' }, 1.5);
  const ev = run(bout, ['stomp', 'breath', 'hold'], ['strafe:cw', 'strafe:cw', 'strafe:cw']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.tag === 'staggered' && e.text.startsWith('Caught mid-move')));
  // Slot 2: Staggered, it tests 6 ÷ 2 + 3 = 6 against True Dragon + Air's Accuracy 9: the Breath lands.
  assert.deepEqual(hits(ev).filter((h) => h.attacker === 'A').map((h) => h.action), ['stomp', 'breath']);
  assert.equal(bout.fighters.B.marks.staggerExtra, 0, 'both slots spent');
});

// ---- Breath at Melee, charged releases, guard reflection, hard landings [Doc] ----

test('at Melee a Breath trading with a Bite is lost; a charged release holds through a hit', () => {
  const trade = run(newBout(TD_WATER, TD_WATER, 2), ['breath'], ['bite']);
  assert.deepEqual(hits(trade).map((h) => h.attacker), ['B'], 'only the Bite lands');
  assert.ok(trade.some((e) => e.kind === 'note' && e.tag === 'breath-broken'));
  assert.equal(hits(run(newBout(TD_WATER, TD_WATER, 4), ['breath'], ['bite'])).length, 2, 'at Close they trade');
  // A Claw in the wind-up would interrupt a plain Breath; a charged release comes out anyway.
  const plain = run(newBout(TD_WATER, TD_WATER, 2), ['hold', 'breath'], ['hold', 'claw:left']);
  assert.ok(!hits(plain).some((h) => h.attacker === 'A'));
  const charged = run(newBout(TD_WATER, TD_WATER, 2), ['charge:breath', 'breath'], ['hold', 'claw:left']);
  assert.ok(hits(charged).some((h) => h.attacker === 'A' && h.action === 'breath'), 'the charged Breath lands');
});

test('a guard with a full Surge turns the blow back on its owner\'s own hide, Breath included, and spends the meter', () => {
  for (const [attack, guard] of [['bite', 'scales'], ['breath', 'scales'], ['bite', 'dodge']] as const) {
    const bout = newBout(TD_WATER, { name: 'W', morph: 'wyrm', stone: 'earth' }, 4);
    bout.fighters.B.meter = R.METER_MAX;
    const ev = run(bout, [attack], [guard]);
    const h = hits(ev);
    if (h.length === 0) continue; // a dodge that evades never needs the meter
    assert.equal(h[0].attacker, 'B', `${attack} into ${guard}`);
    assert.ok(h[0].tags.includes('reflected'));
    assert.equal(bout.fighters.A.wounds, bout.fighters.A.sheet.wounds - h[0].damage);
    assert.ok(bout.fighters.B.meter < R.METER_MAX, 'spent (a Scales slot held to the end then refills a little)');
  }
});

test('a hard landing from two bands up comes all the way down and Stomps for free', () => {
  const bout = newBout(TD_WATER, { name: 'W', morph: 'wyrm', stone: 'earth' }, 4);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 2 * R.BAND };
  const ev = run(bout, ['dive:hard'], ['hold']);
  assert.equal(bout.fighters.A.pos.z, 0);
  assert.ok(ev.some((e) => e.kind === 'note' && e.tag === 'hard-landing'));
  assert.deepEqual(hits(ev).map((h) => h.action), ['stomp']);
  assert.ok(bout.fighters.A.readyAt.stomp! > 0, 'it spends Stomp\'s cooldown');
  // From one band up it's an ordinary Dive.
  const low = newBout(TD_WATER, TD_WATER, 4);
  low.fighters.A.pos = { ...low.fighters.A.pos, z: R.BAND };
  assert.equal(hits(run(low, ['dive:hard'], ['hold'])).length, 0);
});

test('a Stomp has no near misses: an unaimed quake earns no meter for missing', () => {
  const bout = newBout(TD_WATER, TD_WATER, 7);
  const meter = bout.fighters.A.meter;
  const ev = run(bout, ['stomp'], ['hold']);
  assert.ok(!ev.some((e) => e.kind === 'nearMiss'));
  assert.equal(bout.fighters.A.meter, meter);
});
