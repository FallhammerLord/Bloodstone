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

const TD_AIR: FighterSetup = { name: 'T', morph: 'true-dragon', stone: 'air' };
const WYRM: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'earth' };

test('damage coming in weighs more as its own Wounds run down: ×1 full, ×1.5 at half, ×2.28 at a fifth', () => {
  assert.equal(woundsRisk(1), 1);
  assert.equal(woundsRisk(0.5), 1.5);
  assert.ok(Math.abs(woundsRisk(0.2) - 2.28) < 1e-9);
  assert.equal(woundsRisk(-1), 3, 'clamped at an empty pool');
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
