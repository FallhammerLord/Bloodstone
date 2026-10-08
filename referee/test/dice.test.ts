// The Evasion test's pair-off dice [Proposed].

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, cloneBout, type Event } from '../src/referee.ts';
import { odds, pairOff, poolOf, rollEvasion, type Dice } from '../src/referee/dice.ts';
import * as R from '../src/rules.ts';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

test('pair-off: the first pair that differs decides; an unbroken chain goes to the bigger pool, else the defender as a near miss', () => {
  assert.equal(pairOff([6, 5, 2], [6, 4, 4]), 'hit', '5 beats 4 at the second pair');
  assert.equal(pairOff([6, 3], [6, 5, 1]), 'evaded', '5 beats 3 at the second pair');
  assert.equal(pairOff([6, 6, 1], [6, 6]), 'hit', 'the chain holds through the defender\'s pool: the attacker has a die left');
  assert.equal(pairOff([4], [4, 1]), 'evaded', 'the chain holds through the attacker\'s pool: the defender has a die left');
  assert.equal(pairOff([5, 2], [5, 2]), 'nearMiss');
  assert.equal(pairOff([], [3]), 'evaded');
  assert.equal(pairOff([3], []), 'hit');
});

test('a die per 3 points, on both sides', () => {
  assert.deepEqual([poolOf(12, 3), poolOf(9, 3), poolOf(8, 3), poolOf(2, 3), poolOf(-3, 3)], [4, 3, 2, 0, 0]);
});

test('the exact odds: equal pools near even, and every row and column in order', () => {
  assert.ok(near(odds(1, 1).hit, 5 / 12, 1e-9));
  assert.ok(near(odds(1, 1).nearMiss, 1 / 6, 1e-9));
  assert.ok(near(odds(4, 3).hit, 0.6197, 1e-4));
  assert.ok(near(odds(2, 1).hit, 0.7454, 1e-4));
  assert.equal(odds(5, 4).nearMiss, 0, 'unequal pools never end in a near miss');
  for (let a = 1; a <= 8; a++) {
    for (let e = 1; e <= 8; e++) {
      if (a < 8) assert.ok(odds(a + 1, e).hit > odds(a, e).hit, `more attack dice help: ${a}→${a + 1} against ${e}`);
      if (e < 8) assert.ok(odds(a, e + 1).hit < odds(a, e).hit, `more Evasion dice defend: ${e}→${e + 1} against ${a}`);
    }
  }
});

test('rolled dice match the exact odds', () => {
  const d: Dice = { mode: 'roll', seed: 7, n: 0 };
  const n = 20000;
  let hit = 0, nm = 0;
  for (let i = 0; i < n; i++) {
    const r = rollEvasion(d, 3, 3).result;
    if (r === 'hit') hit++;
    if (r === 'nearMiss') nm++;
  }
  const o = odds(3, 3);
  assert.ok(near(hit / n, o.hit, 0.015), `hits ${hit / n} against ${o.hit}`);
  assert.ok(near(nm / n, o.nearMiss, 0.005), `near misses ${nm / n} against ${o.nearMiss}`);
});

test('an imagined test lands when its chance beats the luck quantile', () => {
  const o = odds(3, 3);
  assert.equal(rollEvasion({ mode: 'quantile', u: o.hit - 0.01 }, 3, 3).result, 'hit');
  assert.equal(rollEvasion({ mode: 'quantile', u: o.hit + o.nearMiss / 2 }, 3, 3).result, 'nearMiss');
  assert.equal(rollEvasion({ mode: 'quantile', u: 0.99 }, 3, 3).result, 'evaded');
});

test('a cloned bout replays the same dice', () => {
  const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, { name: 'B', morph: 'wyvern', stone: 'water' }, 2, 'B', { seed: 11 });
  const c = cloneBout(bout);
  assert.deepEqual(rollEvasion(bout.dice, 4, 3), rollEvasion(c.dice, 4, 3));
  assert.notDeepEqual(bout.dice, { mode: 'roll', seed: 11, n: 0 }, 'the stream moved on');
});

test('in a bout, a Claw on a dodging dragon rolls the dice, and the evade shows them', () => {
  // True Dragon + Air's Claw 12 (4 dice) against a dodging Wyvern + Water (Evasion 9 + 3: 4 dice). Over many seeds both
  // outcomes happen, and every evade names its dice.
  let evades = 0, hits = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, { name: 'B', morph: 'wyvern', stone: 'water' }, 2, 'B', { seed });
    const ev: Event[] = runExchange(bout, { A: ['claw:left'].map(parseAction), B: ['dodge'].map(parseAction) });
    const evade = ev.find((e) => e.kind === 'evade');
    if (evade && evade.kind === 'evade') {
      evades++;
      assert.match(evade.text, /\(\d( \d)* against \d( \d)*\)/);
    }
    if (ev.some((e) => e.kind === 'hit' && e.attacker === 'A')) hits++;
  }
  assert.ok(evades > 10 && hits > 10, `evades ${evades}, hits ${hits}`);
});

test('with HIT_DICE off, Accuracy against Evasion decides, as before', () => {
  // Accuracy 9 against a dodging Wyvern's 12: evaded every time.
  for (let seed = 1; seed <= 5; seed++) {
    const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, { name: 'B', morph: 'wyvern', stone: 'water' }, 2, 'B', { seed }, R.rulesWith({ HIT_DICE: 0 }));
    const ev = runExchange(bout, { A: ['claw:left'].map(parseAction), B: ['dodge'].map(parseAction) });
    assert.ok(ev.some((e) => e.kind === 'evade' && e.text.includes('beats Accuracy')));
  }
});
