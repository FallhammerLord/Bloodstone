// Attack roles [Proposed]: two-slot charges, lunges and pounces. Geometry decides first,
// then Accuracy against Evasion, then Acumen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, simulateSlot, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const WYVERN: FighterSetup = { name: 'Gale', morph: 'wyvern', stone: 'earth' };
const WYRM: FighterSetup = { name: 'Coil', morph: 'wyrm', stone: 'earth' };
const run = (b: FighterSetup, sep: number, A: string[], B: string[]) => {
  const bout = newBout(TD_WATER, b, sep);
  return { bout, ev: runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) }) };
};
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

/** Plays slot by slot; returns the hits each slot. */
const slots = (b: FighterSetup, sep: number, A: string[], B: string[], luck?: number) => {
  const bout = newBout(TD_WATER, b, sep);
  if (luck !== undefined) bout.dice = { mode: 'quantile', u: luck }; // fixes the Evasion test's dice at a luck quantile
  return A.map((a, i) => hits(simulateSlot(bout, { A: parseAction(a), B: parseAction(B[i]) })).length);
};
const BELLOWS: FighterSetup = { ...TD_WATER, shards: [{ shard: 'Bellows Chest', grade: 'wyrmling', pips: [0, 1] }] };

test('a bite catches a Wyrm\'s retreat only before it finishes: a band move outruns a bite chain', () => {
  // A retreat now carries a band; Evasion 6 finishes it in 12 ticks, as the Bite lands at the edge of its reach.
  assert.deepEqual(slots(WYRM, 2, ['bite', 'bite', 'bite'], ['retreat', 'retreat', 'retreat']), [1, 0, 0]);
});

test('a plain Breath fires in one slot, and a one-slot charge earns nothing', () => {
  const plain = hits(run(TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']).ev);
  const one = hits(run(TD_WATER, 5, ['charge:breath', 'breath', 'hold'], ['hold', 'hold', 'hold']).ev);
  assert.equal(plain.length, 1);
  assert.equal(one[0].damage, plain[0].damage);
});

test('a charge held a second slot earns +3, for Bite and Breath', () => {
  for (const [name, sep] of [['breath', 5], ['bite', 2]] as const) {
    const one = hits(run(TD_WATER, sep, [`charge:${name}`, name, 'hold'], ['hold', 'hold', 'hold']).ev);
    const two = run(TD_WATER, sep, [`charge:${name}`, `charge:${name}`, name], ['hold', 'hold', 'hold']);
    assert.equal(hits(two.ev).length, 1);
    assert.equal(hits(two.ev)[0].damage, one[0].damage + R.DEFAULT_RULES.CHARGE_BONUS, name);
  }
});

test('a second charge slot can\'t run into slot 3: it releases there', () => {
  const { ev } = run(TD_WATER, 5, ['hold', 'charge:breath', 'charge:breath'], ['hold', 'hold', 'hold']);
  assert.equal(hits(ev).length, 1);
});

test('Bellows Chest restores the +3 on a one-slot Breath charge, then adds its own', () => {
  const plain = hits(run(TD_WATER, 5, ['charge:breath', 'breath', 'hold'], ['hold', 'hold', 'hold']).ev)[0];
  const ev = runExchange(newBout(BELLOWS, TD_WATER, 5), { A: ['charge:breath', 'breath', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.equal(hits(ev)[0].damage, plain.damage + R.DEFAULT_RULES.CHARGE_BONUS + 3, 'Wyrmling Bellows: +3 restored, +3 its own');
});

test('lunge: only a Bite right after an Approach that moved', () => {
  const bare = run(WYRM, 4, ['bite'], ['hold']);
  assert.ok(!bare.ev.some((e) => e.kind === 'note' && e.text.startsWith('Lunges')));
  const set = run(WYRM, 7, ['approach', 'bite'], ['hold', 'hold']);
  assert.ok(set.ev.some((e) => e.kind === 'note' && e.text.startsWith('Lunges 1.0')));
});

test('lunge: approach then Bite catches a retreat one pace farther out', () => {
  assert.deepEqual(slots(WYRM, 6, ['hold', 'bite'], ['hold', 'retreat']), [0, 0], 'a bare Bite falls short');
  assert.deepEqual(slots(WYRM, 6, ['approach', 'bite'], ['hold', 'retreat']), [0, 1]);
});

test('lunge is geometry only: a swift retreat still escapes', () => {
  // The lunge carries no tracking: the retreating Wyvern still takes the Evasion test, here with the dice its way.
  assert.deepEqual(slots(WYVERN, 3, ['approach', 'bite'], ['retreat', 'retreat'], 0.99), [0, 0]);
});

test('only the first Bite after an Approach lunges', () => {
  const { ev } = run(WYRM, 7, ['approach', 'bite', 'bite'], ['hold', 'hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'note' && e.text.startsWith('Lunges')).length, 1);
});

test('lunge stops at the other body', () => {
  const { ev } = run(TD_WATER, 4.5, ['approach', 'bite'], ['hold', 'hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && /^Lunges 0\.\d/.test(e.text)));
});

test('pounce: a Claw right after a Strafe reaches from Close, and pierces', () => {
  assert.deepEqual(slots(WYRM, 5, ['hold', 'claw:left'], ['hold', 'hold']), [0, 0], 'out of reach without the pounce');
  const bout = newBout({ name: 'Gust', morph: 'true-dragon', stone: 'air' }, WYRM, 5);
  simulateSlot(bout, { A: parseAction('strafe:cw'), B: parseAction('hold') });
  const ev = simulateSlot(bout, { A: parseAction('claw:left'), B: parseAction('hold') });
  assert.equal(hits(ev).length, 1);
  assert.equal(hits(ev)[0].damage, 9 - (6 - R.DEFAULT_RULES.POUNCE_PIERCE), 'Claw 9 against the Wyrm\'s Scales 6, pierced to 3');
});

test('pounce: only the Claw right after the Strafe', () => {
  const { ev } = run(WYRM, 2, ['strafe:cw', 'claw:left', 'claw:left'], ['hold', 'hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'note' && e.text.startsWith('Pounces')).length, 1);
});

test('pounce is geometry only: a swift retreat still escapes it', () => {
  assert.deepEqual(slots(WYVERN, 5, ['strafe:cw', 'claw:left'], ['hold', 'retreat']), [0, 0]);
});

test('an airborne Wyvern that strafes into its stoop pierces', () => {
  // A stoop needs an exchange already aloft: Leap in one exchange, strafe into the stoop in the next.
  const bout = newBout(WYVERN, WYRM, 6);
  runExchange(bout, { A: ['leap', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  const ev = runExchange(bout, { A: ['strafe:cw', 'claw:left', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Strafed into the stoop')));
  assert.ok(hits(ev)[0].parts.some((x) => x.includes('pierced')));
});
