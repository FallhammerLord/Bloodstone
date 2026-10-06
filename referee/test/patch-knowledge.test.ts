// Patch knowledge: small fixed situations, one per core rule, where a brain must know how the game plays now.
// When a rule changes, the test for it changes too, so the brains' patch notes can't be missed silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boutFromView, scriptFor } from '../src/brain/controller.ts';
import { seededRandom } from '../src/random.ts';
import { inStoopReach, positionValue } from '../src/brain/value.ts';
import { bandWorth, idealBands } from '../src/brain/styles.ts';
import { viewOf } from '../src/bout.ts';
import { newBout, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const WYRM_EARTH: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'earth' };
const TD_FIRE: FighterSetup = { name: 'F', morph: 'true-dragon', stone: 'fire' };
const TD_WATER: FighterSetup = { name: 'W', morph: 'true-dragon', stone: 'water' };
const WYVERN_AIR: FighterSetup = { name: 'G', morph: 'wyvern', stone: 'air' };

test('Bite reaches through Close, Melee included: a biter is at home at Melee', () => {
  const bout = newBout(WYRM_EARTH, TD_FIRE, 1.5);
  assert.ok(idealBands(bout.fighters.A, { claw: 0, bite: 1, breath: 0 }).includes('melee'));
  assert.ok(idealBands(bout.fighters.A, { claw: 0, bite: 1, breath: 0 }).includes('close'));
  // No position penalty at Melee: backing out to Close is a choice (it outranges a Claw), never a habit.
  assert.ok(positionValue('bite-focus', 'melee', bout.fighters.A, bout.fighters.B) >= positionValue('bite-focus', 'close', bout.fighters.A, bout.fighters.B));
});

test('a Breath at Melee is lost to any hit: a breather is not at home at Melee', () => {
  const bout = newBout(TD_FIRE, WYRM_EARTH, 1.5);
  const worth = bandWorth(bout.fighters.A, { claw: 0, bite: 0, breath: 1 });
  assert.ok(worth.melee < worth.close && worth.melee < worth.far);
  assert.ok(!idealBands(bout.fighters.A, { claw: 0, bite: 0, breath: 1 }).includes('melee'));
});

test('a brain knows who is challenged, so it knows who a timeout favors', () => {
  for (const challenged of ['A', 'B'] as const) {
    const bout = newBout(TD_FIRE, WYRM_EARTH, 6.5, challenged);
    assert.equal(viewOf(bout, 'A').challenged, challenged);
    assert.equal(boutFromView(viewOf(bout, 'A')).challenged, challenged);
  }
});

test('a stoop carries a band: a Wyvern hovering at Close threatens one, at Far it does not', () => {
  const close = newBout(WYVERN_AIR, TD_WATER, 4);
  close.fighters.A.pos = { ...close.fighters.A.pos, z: 2 * R.BAND };
  assert.ok(inStoopReach(close.rules, close.fighters.A, close.fighters.B));
  const far = newBout(WYVERN_AIR, TD_WATER, 8);
  far.fighters.A.pos = { ...far.fighters.A.pos, z: R.BAND };
  assert.ok(!inStoopReach(far.rules, far.fighters.A, far.fighters.B));
});

test('a dragon imagines playing its shards: Riposte Talons puts Dodge in more of its scripts', () => {
  const dodges = (setup: FighterSetup) => {
    const bout = newBout(setup, TD_WATER, 1.5);
    const f = bout.fighters.A;
    const rng = seededRandom(9);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      n += scriptFor('boxer-puncher', { f, rules: bout.rules, globalSlot: 0, z: 0, readyAt: {} }, bout.fighters.B, 1.5 * R.PACE, rng, true).filter((a) => a.name === 'dodge').length;
    }
    return n;
  };
  const plain = dodges(TD_WATER);
  const riposte = dodges({ ...TD_WATER, shards: [{ shard: 'Riposte Talons', grade: 'wyrmling', pips: [0] }] });
  assert.ok(riposte > plain * 1.3, `${plain} → ${riposte}`);
});

test('Ash Gland is pulled for redesign: no brain can draft it', async () => {
  const { shardPool } = await import('../src/shards.ts');
  assert.ok(!shardPool('wyrmling').some((s) => s.name === 'Ash Gland'));
});
