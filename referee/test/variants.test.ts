// Attack-role variants [Proposed]: switched on one at a time for testing. Geometry decides first,
// then Accuracy against Evasion, then Acumen.

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, simulateSlot, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const WYVERN: FighterSetup = { name: 'Gale', morph: 'wyvern', stone: 'earth' };
const WYRM: FighterSetup = { name: 'Coil', morph: 'wyrm', stone: 'earth' };
const OFF = { breathCharge: false, biteLunge: false, elementalBite: false };
afterEach(() => Object.assign(R.VARIANT, OFF));
const run = (flags: Partial<typeof OFF>, b: FighterSetup, sep: number, A: string[], B: string[]) => {
  Object.assign(R.VARIANT, OFF, flags);
  const bout = newBout(TD_WATER, b, sep);
  return { bout, ev: runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) }) };
};
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

/** Plays slot by slot; returns the hits each slot. */
const slots = (flags: Partial<typeof OFF>, b: FighterSetup, sep: number, A: string[], B: string[]) => {
  Object.assign(R.VARIANT, OFF, flags);
  const bout = newBout(TD_WATER, b, sep);
  return A.map((a, i) => hits(simulateSlot(bout, { A: parseAction(a), B: parseAction(B[i]) })).length);
};
const BELLOWS: FighterSetup = { ...TD_WATER, shards: [{ shard: 'Bellows Chest', grade: 'wyrmling', pips: [0, 1] }] };

test('a bite chain catches a retreat at Melee and Close, then misses once it reaches Far', () => {
  assert.deepEqual(slots({}, WYRM, 2, ['bite', 'bite', 'bite'], ['retreat', 'retreat', 'retreat']), [1, 1, 0]);
});

test('mandatory charge: a plain Breath charges one slot and releases with no bonus', () => {
  const plain = run({}, TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  const charged = run({ breathCharge: true }, TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(hits(charged.ev).length, 1);
  assert.equal(hits(charged.ev)[0].damage, hits(plain.ev)[0].damage);
  assert.ok(charged.ev.some((e) => e.kind === 'note' && e.text.startsWith('Breath must charge')));
});

test('mandatory charge: a Breath scripted in slot 3 holds', () => {
  assert.equal(hits(run({ breathCharge: true }, TD_WATER, 5, ['hold', 'hold', 'breath'], ['hold', 'hold', 'hold']).ev).length, 0);
});

test('a charge held a second slot earns +3, for Bite and Breath', () => {
  for (const [name, sep] of [['breath', 5], ['bite', 2]] as const) {
    const one = hits(run({ breathCharge: true }, TD_WATER, sep, [`charge:${name}`, name, 'hold'], ['hold', 'hold', 'hold']).ev);
    const two = run({ breathCharge: true }, TD_WATER, sep, [`charge:${name}`, `charge:${name}`, name], ['hold', 'hold', 'hold']);
    assert.equal(hits(two.ev).length, 1);
    assert.equal(hits(two.ev)[0].damage, one[0].damage + R.CHARGE_BONUS, name);
  }
});

test('a second charge slot can\'t run into slot 3: it releases there', () => {
  const { ev } = run({ breathCharge: true }, TD_WATER, 5, ['hold', 'charge:breath', 'charge:breath'], ['hold', 'hold', 'hold']);
  assert.equal(hits(ev).length, 1);
});

test('Bellows Chest restores the +3 on a one-slot Breath charge, then adds its own', () => {
  const plain = hits(run({ breathCharge: true }, TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']).ev)[0];
  Object.assign(R.VARIANT, OFF, { breathCharge: true });
  const ev = runExchange(newBout(BELLOWS, TD_WATER, 5), { A: ['breath', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.equal(hits(ev)[0].damage, plain.damage + R.CHARGE_BONUS + 3, 'Wyrmling Bellows: +3 restored, +3 its own');
});

test('lunge: only a Bite right after an Approach that moved', () => {
  const bare = run({ biteLunge: true }, WYRM, 4, ['bite'], ['hold']);
  assert.ok(!bare.ev.some((e) => e.kind === 'note' && e.text.startsWith('Lunges')));
  const set = run({ biteLunge: true }, WYRM, 7, ['approach', 'bite'], ['hold', 'hold']);
  assert.ok(set.ev.some((e) => e.kind === 'note' && e.text.startsWith('Lunges 1.0')));
});

test('lunge: approach then Bite catches a retreat one pace farther out', () => {
  assert.deepEqual(slots({}, WYRM, 6, ['approach', 'bite'], ['hold', 'retreat']), [0, 0]);
  assert.deepEqual(slots({ biteLunge: true }, WYRM, 6, ['approach', 'bite'], ['hold', 'retreat']), [0, 1]);
});

test('lunge is geometry only: a swift retreat still escapes', () => {
  assert.deepEqual(slots({ biteLunge: true }, WYVERN, 3, ['approach', 'bite'], ['retreat', 'retreat']), [0, 0]);
});

test('only the first Bite after an Approach lunges', () => {
  const { ev } = run({ biteLunge: true }, WYRM, 7, ['approach', 'bite', 'bite'], ['hold', 'hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'note' && e.text.startsWith('Lunges')).length, 1);
});

test('lunge stops at the other body', () => {
  const { ev } = run({ biteLunge: true }, TD_WATER, 2.5, ['approach', 'bite'], ['hold', 'hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && /^Lunges 0\.\d/.test(e.text)));
});

test('elemental bite: a Bite carries the stone matchup', () => {
  const off = hits(run({}, WYRM, 2, ['bite'], ['hold']).ev)[0];
  const on = hits(run({ elementalBite: true }, WYRM, 2, ['bite'], ['hold']).ev)[0];
  assert.equal(on.damage, off.damage + R.MATCHUP, 'Water beats Earth');
});
