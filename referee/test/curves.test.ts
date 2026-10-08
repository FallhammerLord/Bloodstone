// The three curves [Proposed]: proportional armor (DAMAGE_CURVE), the linear Evasion test (HIT_LINEAR) and
// proportional Accuracy (ACCURACY_CURVE). Each is off by default; CURVES turns on all three.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { rulesFromArgs } from '../src/harness.ts';
import { CORE_MORPHS, hatch, type CoreStone } from '../src/hatch.ts';
import { buildSheet, newBout, runExchange, type Event, type FighterSetup } from '../src/referee.ts';
import { against } from '../src/referee/damage.ts';
import { linearTarget, rollUnder, type Dice } from '../src/referee/dice.ts';
import * as R from '../src/rules.ts';

const ARMOR = R.rulesWith({ DAMAGE_CURVE: 18 });
const LINEAR = R.rulesWith({ HIT_LINEAR: 24 });
const TD_WATER: FighterSetup = { name: 'W', morph: 'true-dragon', stone: 'water' };
const TD_EARTH: FighterSetup = { name: 'E', morph: 'true-dragon', stone: 'earth' };
const WYRM_AIR: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'air' };

const hits = (a: FighterSetup, b: FighterSetup, sep: number, A: string[], B: string[], rules: R.Rules) => {
  const events = runExchange(newBout(a, b, sep, 'B', {}, rules), { A: A.map(parseAction), B: B.map(parseAction) });
  return events.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit' && e.attacker === 'A');
};

// ---- Proportional armor ----

test('armor curve: each point of defense turns aside 1/18 of the attack, never more than five sixths', () => {
  const v = (attack: number, defense: number) => against(ARMOR, attack, defense).v;
  assert.equal(v(6, 6), 4, 'a valley Claw against a baseline hide keeps two thirds (flat: 0)');
  assert.equal(v(12, 6), 8);
  assert.equal(v(18, 9), 9, 'Breath 18 against Affinity 9: the same as flat');
  assert.equal(v(12, 0), 12, 'no defense, the whole attack: a full Surge loses nothing');
  assert.equal(v(18, 18), 3, 'a hit keeps at least DAMAGE_CURVE_KEEP Nths');
  assert.equal(v(15, 9), 7, 'rounded down');
  assert.equal(against(R.DEFAULT_RULES, 6, 6).v, 0, 'off by default: attack minus defense');
});

test('armor curve in a bout: a valley Claw hurts, and Bite pierces before the curve', () => {
  // True Dragon + Earth's Claw 6 against a True Dragon's Scales 6: flat 1 (the floor), curved 4.
  assert.equal(hits(TD_EARTH, TD_WATER, 2, ['claw:left'], ['hold'], R.DEFAULT_RULES)[0].damage, 1);
  assert.equal(hits(TD_EARTH, TD_WATER, 2, ['claw:left'], ['hold'], ARMOR)[0].damage, 4);
  // True Dragon + Water's Claw 9 against a Wyrm's Scales 9: flat 1, curved 4.
  assert.equal(hits(TD_WATER, WYRM_AIR, 2, ['claw:left'], ['hold'], ARMOR)[0].damage, 4);
  // Bite 9 against Scales 6 pierced to 3: 9 × 15 ÷ 18 = 7 (flat 6). The hit names the curve.
  const bite = hits(TD_WATER, TD_WATER, 4, ['bite'], ['hold'], ARMOR)[0];
  assert.equal(bite.damage, 7);
  assert.ok(bite.parts.some((p) => p.startsWith('armor curve')));
});

test('armor curve: riders stay flat on top', () => {
  // Intimidate's +3 adds after the curve: Bite 9 against pierced Scales 3 is 7, then +3.
  const h = hits(TD_WATER, TD_WATER, 4, ['intimidate', 'bite'], ['hold', 'hold'], ARMOR);
  assert.equal(h[0].damage, 7 + R.DEFAULT_RULES.INTIMIDATE_BONUS);
});

// ---- The linear Evasion test ----

test('linear test: even stats land half the time, every point moves it 1/24, and nothing is certain', () => {
  assert.equal(linearTarget(24, 9, 9), 12);
  assert.equal(linearTarget(24, 12, 9), 15, 'Bite 12 against Evasion 9: 15 in 24, 62%');
  assert.equal(linearTarget(24, 11, 9), 14, 'a 2-point chip counts: 9 → 11 Claw is 50% → 58%');
  assert.equal(linearTarget(24, 40, 3), 23);
  assert.equal(linearTarget(24, 3, 40), 1);
});

test('linear test: rolls match the target, and an imagined test lands when its chance beats the quantile', () => {
  const d: Dice = { mode: 'roll', seed: 5, n: 0 };
  const n = 20000;
  let hit = 0;
  for (let i = 0; i < n; i++) if (rollUnder(d, 24, 15).hit) hit++;
  assert.ok(Math.abs(hit / n - 15 / 24) < 0.015, `${hit / n} against ${15 / 24}`);
  assert.equal(rollUnder({ mode: 'quantile', u: 15 / 24 - 0.01 }, 24, 15).hit, true);
  assert.equal(rollUnder({ mode: 'quantile', u: 15 / 24 + 0.01 }, 24, 15).hit, false);
});

test('linear test in a bout: a Claw on a dodging dragon rolls one die, and near misses belong to the phantom band', () => {
  // True Dragon + Air's Claw 12 against a dodging Wyvern (Evasion 9 + 3): 12 in 24. Both outcomes happen, every evade
  // names its die, and the test itself never makes a near miss.
  let evades = 0, landed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const bout = newBout({ name: 'A', morph: 'true-dragon', stone: 'air' }, { name: 'B', morph: 'wyvern', stone: 'water' }, 2, 'B', { seed }, LINEAR);
    const ev = runExchange(bout, { A: ['claw:left'].map(parseAction), B: ['dodge'].map(parseAction) });
    const evade = ev.find((e) => e.kind === 'evade');
    if (evade && evade.kind === 'evade') {
      evades++;
      assert.match(evade.text, /needs 12 or less on a d24, rolls \d+/);
      assert.ok(!ev.some((e) => e.kind === 'nearMiss' && e.tick === evade.tick), 'no near miss from the test');
    }
    if (ev.some((e) => e.kind === 'hit' && e.attacker === 'A')) landed++;
  }
  assert.ok(evades > 15 && landed > 15, `evades ${evades}, hits ${landed}`);
});

// ---- Proportional Accuracy ----

test('Accuracy curve: Claw × (18 − Evasion) ÷ 18, no floor; a preferred Earth stone keeps its +3', () => {
  const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
  const grid = Object.fromEntries(CORE_MORPHS.map((m) => [m, STONES.map((s) => hatch(m, s, 'wyrmling', 18).accuracy)]));
  assert.deepEqual(grid, {
    'true-dragon': [7, 5, 5, 10],
    wyvern: [4, 3, 3, 6],
    wyrm: [6, 4, 4, 8],
    drake: [4, 6, 3, 6],
  });
  assert.equal(hatch('true-dragon', 'air').accuracy, 9, 'off by default: Claw − Evasion');
  assert.equal(buildSheet({ name: 'A', morph: 'true-dragon', stone: 'air' }, R.rulesWith({ ACCURACY_CURVE: 18 })).sheet.accuracy, 10);
});

// ---- Together ----

test('CURVES=on turns on all three', () => {
  const { rules, label } = rulesFromArgs(['--rule', 'CURVES=on']);
  assert.equal(rules.DAMAGE_CURVE, 18);
  assert.equal(rules.HIT_LINEAR, 24);
  assert.equal(rules.ACCURACY_CURVE, 18);
  assert.equal(label, 'CURVES');
});
