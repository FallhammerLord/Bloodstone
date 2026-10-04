// Attack-role variants [Proposed]: switched on one at a time for testing. Claw catches strafes,
// Bite catches retreats and armor, Breath catches dodges, Stomp catches burrows and the grounded.

import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const WYVERN: FighterSetup = { name: 'Gale', morph: 'wyvern', stone: 'earth' };
const WYRM: FighterSetup = { name: 'Coil', morph: 'wyrm', stone: 'earth' };
const OFF = { breathCharge: false, biteTracking: false, biteLunge: false, elementalBite: false };
afterEach(() => Object.assign(R.VARIANT, OFF));
const run = (flags: Partial<typeof OFF>, b: FighterSetup, sep: number, A: string[], B: string[]) => {
  Object.assign(R.VARIANT, OFF, flags);
  const bout = newBout(TD_WATER, b, sep);
  return { bout, ev: runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) }) };
};
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

test('mandatory charge: a plain Breath charges, then releases for +3', () => {
  const plain = run({}, TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  const charged = run({ breathCharge: true }, TD_WATER, 5, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(hits(charged.ev).length, 1);
  assert.equal(hits(charged.ev)[0].damage, hits(plain.ev)[0].damage + R.CHARGE_BONUS);
  assert.ok(charged.ev.some((e) => e.kind === 'note' && e.text.startsWith('Breath must charge')));
});

test('mandatory charge: a Breath scripted in slot 3 holds', () => {
  const { ev } = run({ breathCharge: true }, TD_WATER, 5, ['hold', 'hold', 'breath'], ['hold', 'hold', 'hold']);
  assert.equal(hits(ev).length, 0);
});

test('tracking: a Bite begun at Close catches a strafe; at Melee it does not', () => {
  assert.equal(hits(run({}, WYVERN, 4, ['bite'], ['strafe:cw']).ev).length, 0, 'off: the Wyvern evades');
  assert.equal(hits(run({ biteTracking: true }, WYVERN, 4, ['bite'], ['strafe:cw']).ev).length, 1);
  assert.equal(hits(run({ biteTracking: true }, WYVERN, 2, ['bite'], ['strafe:cw']).ev).length, 0, 'Melee is Claw\'s job');
});

test('tracking leaves a dodge alone', () => {
  assert.equal(hits(run({ biteTracking: true }, WYVERN, 4, ['bite'], ['dodge']).ev).length, 0);
});

test('lunge: a Bite carries 1 pace forward and runs down a retreat', () => {
  assert.equal(hits(run({}, WYVERN, 3, ['bite'], ['retreat']).ev).length, 0);
  const { bout, ev } = run({ biteLunge: true }, WYVERN, 3, ['bite'], ['retreat']);
  assert.equal(hits(ev).length, 1);
  assert.ok(bout.fighters.A.pos.x > -Math.floor((3 * R.PACE) / 2), 'A moved toward B');
});

test('lunge: reach grows by the carry', () => {
  assert.equal(hits(run({}, WYRM, 5, ['bite'], ['retreat']).ev).length, 0);
  assert.equal(hits(run({ biteLunge: true }, WYRM, 5, ['bite'], ['retreat']).ev).length, 1);
});

test('lunge stops at the other body', () => {
  const { ev } = run({ biteLunge: true }, TD_WATER, 1.5, ['bite'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Lunges 0.5')));
});

test('elemental bite: a Bite carries the stone matchup', () => {
  const off = hits(run({}, WYRM, 2, ['bite'], ['hold']).ev)[0];
  const on = hits(run({ elementalBite: true }, WYRM, 2, ['bite'], ['hold']).ev)[0];
  assert.equal(on.damage, off.damage + R.MATCHUP, 'Water beats Earth');
});
