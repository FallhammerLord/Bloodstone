// The brain: reads, imagines, chooses by style, keeps its tells, and plays only legal, visible-information moves.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brainController, BRAIN_STYLES, Read } from '../src/brain.ts';
import { runBout, viewOf } from '../src/bout.ts';
import { aiController } from '../src/ai.ts';
import { newBout, type FighterSetup } from '../src/referee.ts';

const WYRM: FighterSetup = { name: 'C', morph: 'wyrm', stone: 'earth' };
const WYVERN: FighterSetup = { name: 'G', morph: 'wyvern', stone: 'air' };

test('every style plays a whole bout without scripting a cooldown action early', () => {
  for (const style of BRAIN_STYLES) {
    const bout = newBout(WYRM, WYVERN, 6.5);
    const ev = runBout(bout, { A: brainController(style, 'novice', 1), B: brainController('boxer-puncher', 'novice', 2) });
    assert.ok(bout.over, style);
    // Altitude plans can fail when an opponent interrupts a leap; cooldowns are always knowable.
    assert.ok(!ev.some((e) => e.kind === 'note' && /cooling down/.test(e.text)), style);
  }
});

test('the same seeds play the same bout', () => {
  const play = () => runBout(newBout(WYRM, WYVERN, 6.5), { A: brainController('slugger', 'novice', 5), B: brainController('aerialist', 'novice', 6) });
  assert.deepEqual(play(), play());
});

test('the read tallies the opponent\'s habits from the public record', () => {
  const bout = newBout(WYRM, WYVERN, 6.5);
  runBout(bout, { A: aiController('brawler', 1), B: aiController('skirmisher', 2) }, { exchangeLimit: 2, timeout: 'challengerForfeits', lateGame: false });
  const read = new Read(viewOf(bout, 'A'), 1);
  // B's habits are now on record; a guess draws from them rather than uniformly.
  let tries = 0;
  const rng = () => ((tries = (tries * 9301 + 49297) % 233280) / 233280);
  const legal = [{ name: 'retreat' as const }, { name: 'stomp' as const }];
  const picks = Array.from({ length: 200 }, () => read.guess('close', 0, false, legal, rng).name);
  assert.ok(picks.filter((p) => p === 'retreat').length > picks.filter((p) => p === 'stomp').length);
});

test('tells: a novice swarmer opens by closing in from beyond Close', () => {
  const brain = brainController('swarmer', 'novice', 7, 1);
  const view = viewOf(newBout(WYRM, WYVERN, 8), 'A');
  assert.equal(brain.script(view)[0].name, 'approach');
});

test('tells: a novice reader opens by intimidating', () => {
  const brain = brainController('reader', 'novice', 7, 1);
  assert.equal(brain.script(viewOf(newBout(WYRM, WYVERN, 5), 'A'))[0].name, 'intimidate');
});

test('with no habits seen yet, a brain expects a breath at Far when the opponent\'s breath is ready', () => {
  const read = new Read(viewOf(newBout(WYRM, WYVERN, 7.5), 'A'), 1);
  const legal = [{ name: 'breath' as const }, { name: 'scales' as const }, { name: 'hold' as const }];
  assert.equal(read.likeliest('far', 0, true, legal).name, 'breath');
});

test('focus brains attack only with their focus, and still move and guard', () => {
  for (const [style, attack] of [['claw-focus', 'claw'], ['bite-focus', 'bite'], ['breath-focus', 'breath']] as const) {
    const bout = newBout(WYRM, WYVERN, 6.5);
    runBout(bout, { A: brainController(style, 'novice', 3), B: brainController('boxer-puncher', 'novice', 4) });
    const mine = bout.record.map((r) => r.actions.A);
    const attacks = mine.filter((a) => ['bite', 'claw', 'breath', 'stomp'].includes(a));
    assert.ok(attacks.every((a) => a === attack), `${style}: ${attacks.join(', ')}`);
    assert.ok(mine.some((a) => !['bite', 'claw', 'breath', 'stomp', 'hold'].includes(a)), `${style} also moves or guards`);
  }
});
