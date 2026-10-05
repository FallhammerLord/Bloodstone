// Shards: the catalog, seating and overlap, and riders in play.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { compile, emptyArray, findShard, seat } from '../src/shards.ts';
import { hatch } from '../src/hatch.ts';
import { buildSheet, newBout, runExchange, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

// ---- Catalog (dragonshards-body.md, dragonshards-bloodstone.md) ----

test('grades: +1, +2, +3 chips; Elder and Venerable are 2-pip with a rider; Venerable adds a related point', () => {
  const pts = ['Whetted Nail', 'Hooked Talon', 'Razor Talons'].map((n) => findShard(n));
  assert.deepEqual(pts.map((s) => s.kind.family !== 'technique' && s.kind.points), [1, 2, 3]);
  assert.deepEqual(pts.map((s) => s.pips), [1, 1, 1]);
  const elder = findShard('Reaver Hooks');
  const ven = findShard('Sundering Claws');
  assert.equal(elder.pips, 2);
  assert.ok(elder.kind.family === 'bloodstone' && elder.kind.rider?.condition === 'chainFinal' && elder.kind.related === null);
  assert.ok(ven.kind.family === 'bloodstone' && ven.kind.related?.attr === 'affinity' && ven.kind.related.points === 1);
});

test('three Wyrmling chips make one full unit', () => {
  const a = emptyArray();
  for (const p of [0, 1, 2]) seat(a, findShard('Milk Fang'), [p]);
  assert.equal(compile(hatch('true-dragon', 'water'), a).sheet.bite, 9 + 3);
});

test('Techniques need a grade', () => {
  assert.throws(() => findShard('Snapping Jaw'), /grade/);
  assert.equal(findShard('Lance Throat', 'wyrmling').pips, 2);
  assert.equal(findShard('Lance Throat', 'elder').pips, 3);
});

// ---- The array ----

test('a wyrmling has three pips; a splinter fits any two of them', () => {
  const a = emptyArray();
  seat(a, findShard('Galewing'), [0, 2]);
  assert.throws(() => seat(a, findShard('Deep Keel'), [3]), /doesn't exist/);
});

test('overlap: one covered pip strips the rider (and a Venerable\'s related point); a chip covered is destroyed', () => {
  const a = emptyArray();
  seat(a, findShard('Sundering Claws'), [0, 1]);
  seat(a, findShard('Razor Talons'), [2]);
  const notes = seat(a, findShard('Deep Keel'), [1]);
  assert.ok(notes[0].includes('rider'));
  const { sheet, loadout } = compile(hatch('true-dragon', 'water'), a);
  assert.equal(sheet.claw, 3 + 3 + 3, 'Sundering keeps its value; Razor Talons adds 3');
  assert.equal(sheet.affinity, 9, 'the related point is gone');
  assert.equal(loadout.riders.length, 0);
  seat(a, findShard('Heartgrit'), [2]);
  assert.equal(compile(hatch('true-dragon', 'water'), a).loadout.names.some((n) => n.startsWith('Razor')), false);
});

test('shards add to attributes but tertiaries don\'t re-derive', () => {
  // More Breath Potency doesn't raise Affinity; more Evasion doesn't raise Accuracy [Doc].
  const { sheet } = buildSheet({ ...TD_WATER, shards: [{ shard: 'Furnace Gland', pips: [0] }, { shard: 'Swept Pinions', pips: [1] }] });
  assert.deepEqual([sheet.breath, sheet.affinity, sheet.evasion, sheet.accuracy], [15, 9, 6, 6]);
});

// ---- Riders in play ----

test('Bastion Plates: +3 Hardness while guarding with Scales', () => {
  const bout = newBout(TD_WATER, { ...TD_WATER, shards: [{ shard: 'Bastion Plates', pips: [0, 1] }] }, 4);
  const ev = runExchange(bout, { A: ['bite', 'bite'].map(parseAction), B: ['scales', 'hold'].map(parseAction) });
  assert.deepEqual(hits(ev).map((h) => h.damage), [1, 6], 'scales: Hardness 12 pierced to 9, so 9 − 9 floors at 1; then 9 − (6 pierced to 3)');
});

test('Ironheart: +3 Hardness at half Wounds or below', () => {
  const bout = newBout(TD_WATER, { ...TD_WATER, shards: [{ shard: 'Ironheart', pips: [0, 1] }] }, 4);
  bout.fighters.B.wounds = 18;
  const ev = runExchange(bout, { A: ['bite'].map(parseAction), B: ['hold'].map(parseAction) });
  assert.equal(hits(ev)[0].damage, 9 - (3 + 3 - 3), 'Hardness 3, +3 from the rider, pierced by 3');
});

test('Reaver Hooks: +3 Claw Sharpness on a chain\'s final link', () => {
  const bout = newBout({ ...TD_WATER, shards: [{ shard: 'Reaver Hooks', pips: [0, 1] }] }, TD_WATER, 2);
  const ev = runExchange(bout, { A: ['claw:left', 'claw:left', 'claw:left'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.deepEqual(hits(ev).map((h) => h.damage), [3, 3, 9], 'Claw 6: 3, 3, then 6 + 3 rider + 3 chain − 3');
});

test('Cauldron Gullet: +3 Breath Potency against targets at Far', () => {
  const at = (sep: number) => {
    const bout = newBout({ ...TD_WATER, shards: [{ shard: 'Cauldron Gullet', pips: [0, 1] }] }, TD_WATER, sep);
    return hits(runExchange(bout, { A: ['breath'].map(parseAction), B: ['hold'].map(parseAction) }))[0].damage;
  };
  assert.equal(at(7) - at(4), 3);
});

test('Wardskin: +3 Affinity against elements that beat your stone', () => {
  // Air beats Water. A Wardskin water dragon takes 3 less from Air breath.
  const plain = newBout({ name: 'G', morph: 'true-dragon', stone: 'air' }, TD_WATER, 4);
  const warded = newBout({ name: 'G', morph: 'true-dragon', stone: 'air' }, { ...TD_WATER, shards: [{ shard: 'Wardskin', pips: [0, 1] }] }, 4);
  const d = (b: typeof plain) => hits(runExchange(b, { A: ['breath'].map(parseAction), B: ['hold'].map(parseAction) }))[0].damage;
  assert.equal(d(plain) - d(warded), Math.min(6, d(plain) - 1), 'Wardskin: +3 Affinity flat, +3 more from its rider');
});

test('Galewing: +3 Evasion, and +3 more while aloft, lets a flyer land a long Leap higher', () => {
  const lift = (shards: FighterSetup['shards']) => {
    const bout = newBout({ name: 'G', morph: 'true-dragon', stone: 'water', shards }, TD_WATER, 6);
    bout.fighters.A.pos = { ...bout.fighters.A.pos, z: R.PACE };
    runExchange(bout, { A: ['leap:long'].map(parseAction), B: ['hold'].map(parseAction) });
    return bout.fighters.A.pos.z;
  };
  // A long band move adds Evasion ÷ 6 paces: Evasion 3 adds ½ pace, Evasion 9 adds 1½.
  assert.equal(lift([{ shard: 'Galewing', pips: [0, 1] }]) - lift([]), R.PACE);
});
