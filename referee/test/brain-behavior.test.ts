// Brain behavior: fixed spots where a style's choice is clear. Each runs 20 seeds at master skill with tells off,
// so these check what the values, leanings and look-ahead choose, and stay robust to a near-tie or two.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brainController, type BrainStyle } from '../src/brain.ts';
import { viewOf } from '../src/bout.ts';
import { newBout, type Bout, type FighterSetup } from '../src/referee.ts';

const TD: FighterSetup = { name: 'T', morph: 'true-dragon', stone: 'water' };

/** How often each action opens the style's script, over 20 seeds. */
function openers(style: BrainStyle, sep: number, tweak: (b: Bout) => void = () => {}): Record<string, number> {
  const tally: Record<string, number> = {};
  for (let seed = 1; seed <= 20; seed++) {
    const bout = newBout(TD, TD, sep);
    tweak(bout);
    const first = brainController(style, 'master', seed, 0).script(viewOf(bout, 'A'))[0].name;
    tally[first] = (tally[first] ?? 0) + 1;
  }
  return tally;
}

test('claw-focus at Melee opens with a Claw, or a Strafe to set up a pounce', () => {
  const t = openers('claw-focus', 2);
  assert.ok((t.claw ?? 0) + (t.strafe ?? 0) >= 16);
});

test('bite-focus at Close opens with a Bite', () => {
  assert.ok((openers('bite-focus', 4).bite ?? 0) >= 16);
});

test('breath-focus at Far opens with a Breath', () => {
  assert.ok((openers('breath-focus', 7).breath ?? 0) >= 13);
});

test('a swarmer beyond Close closes in', () => {
  assert.ok((openers('swarmer', 7).approach ?? 0) >= 14);
});

test('an out-boxer at Melee rarely closes in or claws', () => {
  const t = openers('out-boxer', 2);
  assert.ok((t.approach ?? 0) + (t.claw ?? 0) <= 2, JSON.stringify(t));
});

test('a full Acumen meter opens with an attack to spend it, at Close', () => {
  const t = openers('boxer-puncher', 4, (b) => (b.fighters.A.meter = 100));
  assert.ok((t.breath ?? 0) + (t.bite ?? 0) + (t.claw ?? 0) >= 14, JSON.stringify(t));
});
