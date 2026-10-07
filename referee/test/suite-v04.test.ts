// Suite v0.4 (Ken's 2026-10-07 notes): each change does what the notes say, and SUITE_V03 restores the old rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, type Bout, type Event, type FighterSetup } from '../src/referee.ts';
import { findShard, type Grade } from '../src/shards.ts';
import * as R from '../src/rules.ts';
import type { Rules } from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const TD_FIRE: FighterSetup = { name: 'Ember', morph: 'true-dragon', stone: 'fire' };
const V03 = R.rulesWith({ ...R.SUITE_V03 });
const withTech = (base: FighterSetup, shard: string, grade: Grade = 'wyrmling'): FighterSetup => ({
  ...base, shards: [{ shard, grade, pips: shard === 'Lance Throat' ? [0, 1] : [0] }],
});
const bout = (a: FighterSetup, b: FighterSetup, sep: number, r: Rules = R.DEFAULT_RULES) => newBout(a, b, sep, 'B', {}, r);
const run = (b: Bout, A: string[], B: string[]) => runExchange(b, { A: A.map(parseAction), B: B.map(parseAction) });
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');
const notes = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'note' }> => e.kind === 'note').map((e) => e.text);
const slotPlans = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'slotEnd' }> => e.kind === 'slotEnd').map((e) => e.plans);

test('Thornscale (free): attackers into a Guard take 3, and the Guard keeps its Scales and its whole window', () => {
  const b = bout(TD_WATER, withTech(TD_WATER, 'Thornscale'), 4);
  const ev = run(b, ['bite'], ['guard']);
  assert.equal(b.fighters.A.wounds, b.fighters.A.sheet.wounds - 3, 'the biter takes the thorns');
  assert.ok(!hits(ev)[0].parts.join(' ').includes('Thornscale'), 'no Scales penalty');
  const plain = slotPlans(run(bout(TD_WATER, TD_WATER, 4), ['hold'], ['guard']))[0].B;
  const thorned = slotPlans(run(bout(TD_WATER, withTech(TD_WATER, 'Thornscale'), 4), ['hold'], ['guard']))[0].B;
  assert.deepEqual([thorned.active, thorned.recovery], [plain.active, plain.recovery]);
});

test('Elemental Mantle: +3 Affinity against Breath while Guarding, and no Scales cost against Claw', () => {
  // Water into a Wyrm + Earth (Affinity 3, 6 Guarding), well clear of the damage floor.
  const WYRM_EARTH: FighterSetup = { name: 'Clay', morph: 'wyrm', stone: 'earth' };
  const breath = (b: FighterSetup) => hits(run(bout(TD_WATER, b, 4), ['breath'], ['guard']))[0].damage;
  assert.equal(breath(WYRM_EARTH) - breath(withTech(WYRM_EARTH, 'Elemental Mantle')), 3);
  const claw = (b: FighterSetup) => hits(run(bout(TD_WATER, b, 2), ['claw:left'], ['guard']))[0].damage;
  assert.equal(claw(withTech(TD_WATER, 'Elemental Mantle')), claw(TD_WATER));
  assert.equal(findShard('Mantle Wings', 'wyrmling').name, 'Elemental Mantle', 'the old name still seats');
  assert.equal(findShard('Ash Gland', 'wyrmling').name, 'Ashbreath');
});

test('Lance Throat (pierce3): a Wyrmling pierces 3 Affinity at Close', () => {
  const ev = run(bout(withTech(TD_WATER, 'Lance Throat'), TD_WATER, 4), ['breath'], ['hold']);
  assert.ok(hits(ev)[0].parts.join(' ').includes('Lance Throat pierces 3'));
  const old = run(bout(withTech(TD_WATER, 'Lance Throat'), TD_WATER, 4, V03), ['breath'], ['hold']);
  assert.ok(!hits(old)[0].parts.join(' ').includes('Lance Throat'), 'v0.3: a Wyrmling pierces only at Far');
});

test('Ashbreath: a landed Breath deals full damage and Blinds for Affinity ÷ 3 slots', () => {
  const plain = bout(TD_FIRE, TD_WATER, 4);
  const ashen = bout(withTech(TD_FIRE, 'Ashbreath'), TD_WATER, 4);
  const d = (b: Bout) => hits(run(b, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']))[0].damage;
  assert.equal(d(ashen), d(plain), 'full damage');
  // True Dragon + Fire: Affinity 15, so 5 slots: slots 2 to 6. Exchange 2 ends Blinded; exchange 3 doesn't.
  const blind: boolean[] = [];
  for (let i = 0; i < 2; i++) {
    run(ashen, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
    blind.push(ashen.fighters.B.status.blinded);
  }
  assert.deepEqual(blind, [true, false]);
});

test('Sapping Bellow (reset): the opponent\'s chain resets, and the Intimidate keeps its +3', () => {
  const b = bout(TD_WATER, withTech(TD_WATER, 'Sapping Bellow'), 2);
  b.fighters.A.chain = { ...b.fighters.A.chain, action: 'claw', links: 2 };
  run(b, ['hold'], ['intimidate']);
  assert.deepEqual([b.fighters.A.chain.links, b.fighters.A.chain.action], [0, null]);
  assert.equal(b.fighters.B.intimidateBonus, true);
});

test('Goading Roar and Baleful Eye keep the Intimidate\'s +3 (v0.3: they trade it away)', () => {
  for (const shard of ['Goading Roar', 'Baleful Eye']) {
    const now = bout(TD_WATER, withTech(TD_WATER, shard), 2);
    run(now, ['hold'], ['intimidate']);
    assert.equal(now.fighters.B.intimidateBonus, true, shard);
    const old = bout(TD_WATER, withTech(TD_WATER, shard), 2, V03);
    run(old, ['hold'], ['intimidate']);
    assert.equal(old.fighters.B.intimidateBonus, false, `${shard} under v0.3`);
  }
});

test('Elemental Jaws: a Bite adds Affinity ÷ 3, a landed Bite readies Breath, and Breath cools one action longer', () => {
  const bite = (a: FighterSetup) => hits(run(bout(a, TD_WATER, 4), ['bite'], ['hold']))[0].damage;
  assert.equal(bite(withTech(TD_FIRE, 'Elemental Jaws')) - bite(TD_FIRE), 5, 'Affinity 15 ÷ 3');
  const cool = bout(withTech(TD_FIRE, 'Elemental Jaws'), TD_WATER, 4);
  run(cool, ['breath'], ['hold']);
  assert.equal(cool.fighters.A.readyAt.breath, 0 + 2 + 1 + 1, 'cooldown 2, +1');
  const ready = bout(withTech(TD_FIRE, 'Elemental Jaws'), TD_WATER, 4);
  const ev = run(ready, ['breath', 'bite', 'breath'], ['hold', 'hold', 'hold']);
  assert.ok(notes(ev).some((n) => n.includes('readies its Breath')));
  assert.equal(hits(ev).filter((h) => h.action === 'breath').length, 2, 'the bite readied the second breath');
});
