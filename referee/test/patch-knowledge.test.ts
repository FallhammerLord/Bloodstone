// Patch knowledge, edition 1: one fixed situation per current rule a brain must know. Most rules reach the brains
// through the Referee itself (probes and imagined exchanges); these check the places where a brain reads a rule
// directly: its legal options, its probed worth, and the features it values.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { features, worth } from '../src/brain.ts';
import { legalActions, situation } from '../src/brain/options.ts';
import { seededRandom } from '../src/random.ts';
import { cloneBout, newBout, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'W', morph: 'true-dragon', stone: 'water' };
const legal = (setup: FighterSetup, z = 0) => {
  const b = newBout(setup, TD_WATER, 6);
  b.fighters.A.pos = { ...b.fighters.A.pos, z };
  return legalActions(situation(b.fighters.A, 0, R.DEFAULT_RULES), seededRandom(1));
};
const outcome = (edit: (after: ReturnType<typeof newBout>) => void) => {
  const before = newBout(TD_WATER, TD_WATER, 4);
  const after = cloneBout(before);
  edit(after);
  const ctx = { mine: worth(before, 'A'), theirs: worth(before, 'B') };
  return features({ before, after, events: [], me: 'A' }, ctx);
};

test('probed worth carries the element wheel: Water breathes harder on Earth than on Fire', () => {
  const on = (stone: 'earth' | 'fire') => worth(newBout(TD_WATER, { name: 'T', morph: 'wyrm', stone }, 6), 'A').attack.far.breath ?? 0;
  assert.ok(on('earth') > on('fire'), `${on('earth')} vs ${on('fire')}`);
});

test('probed worth carries Hardness: a Claw does less to a Wyrm (Hardness 9) than to a Wyvern (3)', () => {
  const on = (morph: 'wyrm' | 'wyvern') => worth(newBout(TD_WATER, { name: 'T', morph, stone: 'water' }, 6), 'A').attack.melee.claw ?? 0;
  assert.ok(on('wyvern') > on('wyrm'));
});

test('probed worth carries a full Surge: true damage', () => {
  const b = newBout(TD_WATER, { name: 'T', morph: 'wyrm', stone: 'water' }, 6);
  const plain = worth(b, 'A').attack.melee.claw ?? 0;
  b.fighters.A.meter = R.METER_MAX;
  assert.ok((worth(b, 'A').attack.melee.claw ?? 0) > plain);
});

test('strafes carry a band, short or long: brains have every landing', () => {
  const seen = new Set<string>();
  for (let i = 1; i <= 40; i++) {
    const b = newBout(TD_WATER, TD_WATER, 6);
    for (const a of legalActions(situation(b.fighters.A, 0, R.DEFAULT_RULES), seededRandom(i))) if (a.name === 'strafe' && !a.shift) seen.add(a.depth ?? 'band');
  }
  assert.deepEqual([...seen].sort(), ['band', 'long', 'short']);
});

test('the Drake can hop; a Wyrm can\'t; a flier can Leap; only a flier aloft can Dive', () => {
  assert.ok(legal({ name: 'D', morph: 'drake', stone: 'earth' }).some((a) => a.name === 'leap'));
  assert.ok(!legal({ name: 'C', morph: 'wyrm', stone: 'earth' }).some((a) => a.name === 'leap'));
  assert.ok(legal({ name: 'G', morph: 'wyvern', stone: 'air' }).some((a) => a.name === 'leap'));
  assert.ok(legal({ name: 'G', morph: 'wyvern', stone: 'air' }, 3 * R.PACE).some((a) => a.name === 'dive'));
});

test('Lockjaw (clamp): a clamped jaw has no Bite to script', () => {
  const b = newBout(TD_WATER, TD_WATER, 2);
  b.fighters.A.marks.clamped = true;
  assert.ok(!legalActions(situation(b.fighters.A, 0, R.DEFAULT_RULES), seededRandom(1)).some((a) => a.name === 'bite' && !a.setup));
});

test('Bellows Chest (mobile): a Breath charge on a Retreat is an option', () => {
  assert.ok(legal({ ...TD_WATER, stone: 'fire', shards: [{ shard: 'Bellows Chest', grade: 'wyrmling', pips: [0, 1] }] }).some((a) => a.name === 'breath' && a.charge && a.move === 'retreat'));
});

test('open setups count as tempo: a lunge, a pounce, a Drake\'s Ravener window', () => {
  assert.ok(outcome((b) => (b.fighters.A.marks.advanced = true)).tempo > 0, 'lunge');
  assert.ok(outcome((b) => (b.fighters.A.marks.strafed = true)).tempo > 0, 'pounce');
  assert.ok(outcome((b) => (b.fighters.A.marks.ravener = 2)).tempo > 0, 'Ravener');
  assert.ok(outcome((b) => (b.fighters.B.intimidateBonus = true)).tempo < 0, 'the opponent\'s held Intimidate');
});

test('lasting harms count as status: clinging ash, a Pin, a Snapping Jaw debt', () => {
  assert.ok(outcome((b) => (b.fighters.B.marks.ashStuck = { owner: 'A', exchange: 1, rattles: false })).status > 0, 'ash on the opponent');
  assert.ok(outcome((b) => (b.fighters.B.pending.pinned = true)).status > 0, 'a Pin');
  assert.ok(outcome((b) => (b.fighters.A.marks.snapDebt = 3)).status < 0, 'its own debt');
});

test('standing in the opponent\'s zone, or on the rim late, counts against ground', () => {
  assert.ok(outcome((b) => b.arena.zones.push({ kind: 'ash', center: { ...b.fighters.A.pos }, radius: R.PACE, lastSlot: 99, owner: 'B' })).ground < 0, 'ash cloud');
  assert.ok(outcome((b) => {
    b.exchange = b.rules.EXCHANGE_LIMIT;
    b.fighters.A.pos = { x: b.rules.ARENA_RADIUS - R.PACE, y: 0, z: 0 };
  }).ground < 0, 'the rim, late');
});

test('Surge: a lead counts, and a full meter counts half again', () => {
  const lead = outcome((b) => (b.fighters.A.meter = 60)).surge;
  const full = outcome((b) => (b.fighters.A.meter = R.METER_MAX)).surge;
  assert.ok(lead > 0 && full > lead + 0.4);
});

test('Talons: a Wyvern aloft over a grounded opponent within stoop reach holds the high ground', () => {
  const before = newBout({ name: 'G', morph: 'wyvern', stone: 'air' }, TD_WATER, 6);
  const after = cloneBout(before);
  after.fighters.A.pos = { ...after.fighters.A.pos, z: 3 * R.PACE };
  const f = features({ before, after, events: [], me: 'A' }, { mine: worth(before, 'A'), theirs: worth(before, 'B') });
  assert.equal(f.perch, 1);
});
