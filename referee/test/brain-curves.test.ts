// The brains' Wounds curve, and the slugger's lean on whichever attack gets through the opponent's defenses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewOf } from '../src/bout.ts';
import { woundsRisk } from '../src/brain/archetypes.ts';
import { discover } from '../src/brain/discover.ts';
import type { Context } from '../src/brain/features.ts';
import { situation } from '../src/brain/options.ts';
import { prior } from '../src/brain/priors.ts';
import { worth } from '../src/brain/probe.ts';
import { newBout, type FighterSetup, type SlotRecord } from '../src/referee.ts';
import { ARCHETYPES } from '../src/brain/archetypes.ts';
import { shardPromise, shardScore } from '../src/brain/hatchery.ts';
import { hatch } from '../src/hatch.ts';
import { shardPool } from '../src/shards.ts';
import * as R from '../src/rules.ts';

const TD_AIR: FighterSetup = { name: 'T', morph: 'true-dragon', stone: 'air' };
const WYRM: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'earth' };

test('damage coming in weighs more as its own Wounds run down, by each style\'s nerve', () => {
  // The boxer-puncher (curve 2): ×1 full, ×1.5 at half, ×2.28 at a fifth.
  assert.equal(woundsRisk(1, 'boxer-puncher'), 1);
  assert.equal(woundsRisk(0.5, 'boxer-puncher'), 1.5);
  assert.ok(Math.abs(woundsRisk(0.2, 'boxer-puncher') - 2.28) < 1e-9);
  assert.equal(woundsRisk(-1, 'boxer-puncher'), 3, 'clamped at an empty pool');
  // At a fifth left the slugger barely flinches; the out-boxer weighs damage nearly three times over.
  assert.ok(woundsRisk(0.2, 'slugger') < 1.4 && woundsRisk(0.2, 'out-boxer') > 2.9);
});

test('discovery: nothing seen trusts the board; Claws that land light pull the Claw\'s share down', () => {
  const bout = newBout(TD_AIR, WYRM, 2);
  const mine = worth(bout, 'A');
  const view = viewOf(bout, 'A');
  assert.deepEqual(discover(view, mine), { bite: 1, claw: 1, breath: 1, stomp: 1 });
  // Two Claws landed at Melee and dealt nothing (a Guard soaked them): the share falls to 2 ÷ 4 of the board's worth.
  const pool = bout.fighters.B.sheet.wounds;
  const rec = (i: number): SlotRecord => ({
    exchange: 0, slot: i, separation: 2 * 300, z: { A: 0, B: 0 }, wounds: { A: 42, B: pool }, actions: { A: 'claw', B: 'guard' },
    landed: { A: true, B: false }, breathReady: { A: true, B: true },
  });
  const seen = { ...view, record: [rec(0), rec(1)] };
  const punch = discover(seen, mine);
  assert.ok(Math.abs((punch.claw ?? 0) - 0.5) < 1e-9, `claw ${punch.claw}`);
  assert.equal(punch.bite, 1);
});

test('the slugger leans on what gets through: Claws turned aside, it reaches for the Bite', () => {
  const bout = newBout(TD_AIR, WYRM, 2);
  const s = situation(bout.fighters.A, 0, bout.rules);
  const mine = worth(bout, 'A');
  const ctx = (punch: Context['punch']): Context => ({ mine, theirs: worth(bout, 'B'), punch });
  const ratio = (style: 'slugger' | 'boxer-puncher', punch: Context['punch']) =>
    prior(style, ctx(punch), 'melee', s, { name: 'bite' }) / prior(style, ctx(punch), 'melee', s, { name: 'claw', sweep: 'left' });
  const blunted = { bite: 1, claw: 0.3, breath: 1, stomp: 1 };
  assert.ok(ratio('slugger', blunted) > 2 * ratio('slugger', {}), 'the slugger shifts toward the Bite');
  assert.equal(ratio('boxer-puncher', blunted), ratio('boxer-puncher', {}), 'the boxer-puncher has no heavy goal');
});

test('a wounded dragon reaches for its Guard sooner', () => {
  const bout = newBout(TD_AIR, WYRM, 2);
  const ctx: Context = { mine: worth(bout, 'A'), theirs: worth(bout, 'B') };
  const full = prior('boxer-puncher', ctx, 'melee', situation(bout.fighters.A, 0, bout.rules), { name: 'guard' });
  bout.fighters.A.wounds = 8;
  const low = prior('boxer-puncher', ctx, 'melee', situation(bout.fighters.A, 0, bout.rules), { name: 'guard' });
  assert.ok(low > full);
});

test('BASE_WOUNDS sets the baseline pool (60); morph swings and a disliked stone\'s −6 stay flat on top', () => {
  const pools = (rules?: R.Rules) => (['true-dragon', 'wyvern', 'wyrm', 'drake'] as const).map((m) => newBout({ name: 'X', morph: m, stone: 'water' }, TD_AIR, 6, 'B', {}, rules).fighters.A.sheet.wounds);
  assert.deepEqual(pools(), [66, 60, 54, 48], 'Drake + Water is disliked: 54 − 6');
  assert.deepEqual(pools(R.rulesWith({ BASE_WOUNDS: 36 })), [42, 36, 30, 24], 'the old baseline');
});

test('damage counts against the 36-point pool the brains were tuned on: a hit keeps its worth against misses and tempo', () => {
  // The same Bite deals the same points; against a Wyrm's 54 (60 baseline) instead of 30 (36), counted ×60 ÷ 36.
  const bite = (rules?: R.Rules) => worth(newBout(TD_AIR, WYRM, 2, 'B', {}, rules), 'A').attack.melee.bite ?? 0;
  assert.ok(Math.abs(bite() - bite(R.rulesWith({ BASE_WOUNDS: 36 })) * (30 / 54) * (60 / 36)) < 1e-9);
});

test('a brain values an attribute chip by the stack it can still complete, as fully as a Technique', () => {
  const sheet = hatch('true-dragon', 'water');
  const pebble = shardPool('wyrmling').find((s) => s.name === 'Pebblescale')!;
  for (const style of ARCHETYPES) {
    const single = shardScore(style, pebble, sheet, 0);
    assert.ok(shardPromise(style, pebble, sheet, 0, 3) >= single, style);
    assert.equal(shardPromise(style, pebble, sheet, 0, 1), single, `${style}: with one pip free, only the single row counts`);
  }
  // The measured table: a lone Pebblescale is worth less than its share of the full stack for at least one style.
  assert.ok(ARCHETYPES.some((style) => shardPromise(style, pebble, sheet, 0, 3) > shardScore(style, pebble, sheet, 0) + 0.1));
});

test('the slugger loads up: it reaches for Intimidate, and for a Guard while its Surge has room, more than the even keel', () => {
  const bout = newBout(TD_AIR, WYRM, 2);
  bout.fighters.A.meter = 10;
  const s = situation(bout.fighters.A, 0, bout.rules);
  const ctx: Context = { mine: worth(bout, 'A'), theirs: worth(bout, 'B') };
  const p = (style: 'slugger' | 'boxer-puncher', name: 'intimidate' | 'guard') => prior(style, ctx, 'melee', s, { name });
  assert.ok(p('slugger', 'intimidate') > p('boxer-puncher', 'intimidate'));
  assert.ok(p('slugger', 'guard') > prior('slugger', ctx, 'melee', situation({ ...bout.fighters.A, meter: 100 }, 0, bout.rules), { name: 'guard' }), 'an empty meter pulls harder than a full one');
});
