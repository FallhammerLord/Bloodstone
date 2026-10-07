// The brains: archetypes play whole bouts legally and repeatably, keep distinct habits that follow from their goals,
// and read their skill from the dragon.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARCHETYPES, brainController, crudeController, skillOf, type Archetype } from '../src/brain.ts';
import { runBout, viewOf } from '../src/bout.ts';
import { newBout, type Bout, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const WYRM: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'earth' };
const WYVERN: FighterSetup = { name: 'G', morph: 'wyvern', stone: 'air' };
const TD: FighterSetup = { name: 'T', morph: 'true-dragon', stone: 'water' };

test('every archetype, and the crude brain, plays a whole bout without scripting a cooldown action early', () => {
  for (const style of ARCHETYPES) {
    const bout = newBout(WYRM, WYVERN, 6.5);
    const ev = runBout(bout, { A: brainController(style, 'novice', 1), B: crudeController(2) });
    assert.ok(bout.over, style);
    assert.ok(!ev.some((e) => e.kind === 'note' && /cooling down/.test(e.text)), style);
  }
});

test('the same seeds play the same bout', () => {
  const play = () => runBout(newBout(WYRM, WYVERN, 6.5), { A: brainController('slugger', 'novice', 5), B: brainController('out-boxer', 'novice', 6) });
  assert.deepEqual(play(), play());
});

test('skill follows the dragon\'s shard pips: none novice, a pip or two adept, a full array master', () => {
  const at = (shards: FighterSetup['shards']) => skillOf(newBout({ ...TD, shards }, TD, 6).fighters.A);
  assert.equal(at([]), 'novice');
  assert.equal(at([{ shard: 'Heartgrit', pips: [0] }]), 'adept');
  assert.equal(at([{ shard: 'Heartgrit', pips: [0] }, { shard: 'Pebblescale', pips: [1] }, { shard: 'Milk Fang', pips: [2] }]), 'master');
});

/** How often each action opens an archetype's script from a fixed state, over 20 seeds. */
function openers(style: Archetype, setup: (b: Bout) => void, sep: number, a: FighterSetup = TD, b: FighterSetup = TD): Record<string, number> {
  const tally: Record<string, number> = {};
  for (let seed = 1; seed <= 20; seed++) {
    const bout = newBout(a, b, sep);
    setup(bout);
    const first = brainController(style, 'novice', seed).script(viewOf(bout, 'A'))[0].name;
    tally[first] = (tally[first] ?? 0) + 1;
  }
  return tally;
}

test('goals show in play: from Far, a swarmer closes in more often than an out-boxer', () => {
  const closes = (s: Archetype) => {
    const t = openers(s, () => {}, 7.5, { name: 'B', morph: 'true-dragon', stone: 'earth' }, { name: 'B', morph: 'true-dragon', stone: 'earth' });
    return (t.approach ?? 0) + (t.leap ?? 0);
  };
  assert.ok(closes('swarmer') > closes('out-boxer'), `swarmer ${closes('swarmer')}, out-boxer ${closes('out-boxer')}`);
});

test('goals show in play: at Melee against a harder hitter, an out-boxer backs off more often than a swarmer', () => {
  const backs = (s: Archetype) => {
    const t = openers(s, () => {}, 2, { name: 'W', morph: 'wyvern', stone: 'water' }, { name: 'B', morph: 'true-dragon', stone: 'earth' });
    return (t.retreat ?? 0) + (t.strafe ?? 0) + (t.dodge ?? 0);
  };
  assert.ok(backs('out-boxer') > backs('swarmer'), `out-boxer ${backs('out-boxer')}, swarmer ${backs('swarmer')}`);
});

test('a brain sees only the public view: the opponent\'s planned script never reaches it', () => {
  const bout = newBout(TD, TD, 6);
  const view = viewOf(bout, 'A');
  assert.ok(!('scripts' in view));
  assert.equal(view.rules, bout.rules);
  assert.equal(view.separation, Math.round(6 * R.PACE / 2) * 2);
});

test('attribute shards stack in drafting; a Technique never duplicates', async () => {
  const { canAdd } = await import('../src/brain/hatchery.ts');
  const { findShard } = await import('../src/shards.ts');
  const sinew = findShard('Coiled Sinew');
  const jaw = findShard('Snapping Jaw', 'wyrmling');
  assert.ok(canAdd([{ name: 'Coiled Sinew' }, { name: 'Coiled Sinew' }], sinew));
  assert.ok(!canAdd([{ name: 'Snapping Jaw' }], jaw));
});
