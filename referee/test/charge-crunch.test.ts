// Charges (one action across two slots) and crunches (two attacks in one slot), design doc §4.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, type Event, type FighterSetup } from '../src/referee.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const CRUNCHLING: FighterSetup = { name: 'Coil', morph: 'true-dragon', stone: 'air', shards: [{ shard: 'Raking Talons', grade: 'juvenile', pips: [0] }] };
const run = (a: FighterSetup, b: FighterSetup, sep: number, A: string[], B: string[]) => {
  const bout = newBout(a, b, sep);
  return { bout, ev: runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) }) };
};
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

test('a charged Bite releases next slot for +3, whatever that slot scripted', () => {
  const { ev } = run(TD_WATER, TD_WATER, 4, ['charge:bite', 'retreat'], ['hold', 'hold']);
  assert.deepEqual(hits(ev).map((h) => h.damage), [9 + 3]);
});

test('the charging slot guards like Scales, and a landed hit breaks the charge', () => {
  const { ev } = run(TD_WATER, { name: 'A', morph: 'true-dragon', stone: 'air' }, 2, ['charge:bite', 'hold'], ['claw:left', 'hold']);
  assert.equal(hits(ev)[0].damage, 9 - (3 + 3), 'Claw 9 against Hardness 3 + 3 guarding');
  assert.ok(ev.some((e) => e.kind === 'note' && e.text === 'The hit breaks the charge.'));
  assert.equal(hits(ev).length, 1, 'no release');
});

test('a charge can\'t start in slot 3', () => {
  const { ev } = run(TD_WATER, TD_WATER, 4, ['hold', 'hold', 'charge:breath'], ['hold', 'hold', 'hold']);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('A charge must release by slot 3')));
});

test('a charged Breath starts its cooldown on release', () => {
  const bout = newBout(TD_WATER, TD_WATER, 5);
  runExchange(bout, { A: ['charge:breath', 'breath', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.equal(bout.fighters.A.readyAt.breath, 1 + 2 + 1, 'released in slot 2 (global 1): ready again at global 4');
});

test('a crunch lands two claws in one slot, with no modifiers', () => {
  const { ev } = run(CRUNCHLING, TD_WATER, 2, ['crunch:claw'], ['hold']);
  assert.deepEqual(hits(ev).map((h) => h.damage), [6, 6]);
  assert.ok(hits(ev).every((h) => h.parts.includes('crunched: no modifiers')));
});

test('crunching needs Raking Talons or Gnashing Teeth', () => {
  const { ev } = run(TD_WATER, TD_WATER, 2, ['crunch:claw'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.ok(ev.some((e) => e.kind === 'note' && e.text.startsWith('Crunching a Claw needs Raking Talons')));
});

test('a Wyrmling Raking Talons crunches only after a landed Claw the slot before', () => {
  const young: FighterSetup = { ...CRUNCHLING, shards: [{ shard: 'Raking Talons', grade: 'wyrmling', pips: [0] }] };
  const { ev } = run(young, TD_WATER, 2, ['crunch:claw', 'claw:left', 'crunch:claw'], ['hold', 'hold', 'hold']);
  assert.deepEqual(hits(ev).map((h) => h.damage), [6, 6, 6, 6], 'first crunch attacks once; the third slot crunches');
});

test('crunched slots don\'t build chains', () => {
  const { bout } = run(CRUNCHLING, TD_WATER, 2, ['crunch:claw', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(bout.fighters.A.chain.links, 0);
});

test('one crunch per exchange: later crunches attack once', () => {
  const { ev } = run(CRUNCHLING, TD_WATER, 2, ['crunch:claw', 'crunch:claw', 'crunch:claw'], ['hold', 'hold', 'hold']);
  assert.equal(ev.filter((e) => e.kind === 'note' && e.text.startsWith('One crunch per exchange')).length, 2);
  assert.equal(hits(ev).length, 2 + 1 + 1);
});

test('element breath modifiers: harmless extras add, harmful ones subtract', () => {
  const dmg = (stone: 'water' | 'fire') => hits(run({ name: 'X', morph: 'true-dragon', stone }, { name: 'Y', morph: 'wyrm', stone: 'water' }, 4, ['breath'], ['hold']).ev)[0];
  assert.ok(dmg('water').parts.includes('+2 water breath'));
  assert.ok(dmg('fire').parts.includes('-2 fire breath'));
});
