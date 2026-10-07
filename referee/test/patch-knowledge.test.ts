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

test('probed worth carries Scales: a Claw does less to a Wyrm (Scales 9) than to a Wyvern (3)', () => {
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

test('a cashed setup pays: a lunging Bite that lands counts as payoff', () => {
  const before = newBout(TD_WATER, TD_WATER, 4);
  const after = cloneBout(before);
  const events = [
    { kind: 'slotStart', exchange: 1, slot: 1 },
    { kind: 'note', tick: 0, side: 'A', tag: 'lunge', text: 'Lunges.' },
    { kind: 'hit', tick: 12, attacker: 'A', action: 'bite', damage: 6, parts: [], tags: [], interrupt: false, trade: false, woundsLeft: 36 },
  ] as Parameters<typeof features>[0]['events'];
  const f = features({ before, after, events, me: 'A' }, { mine: worth(before, 'A'), theirs: worth(before, 'B') });
  assert.equal(f.payoff, 1);
  assert.equal(f.free, 1, 'and it took nothing back that slot: a free hit');
});

test('a hit traded for a hit is not free', () => {
  const before = newBout(TD_WATER, TD_WATER, 4);
  const events = [
    { kind: 'slotStart', exchange: 1, slot: 1 },
    { kind: 'hit', tick: 12, attacker: 'A', action: 'claw', damage: 3, parts: [], tags: [], interrupt: false, trade: true, woundsLeft: 39 },
    { kind: 'hit', tick: 12, attacker: 'B', action: 'claw', damage: 3, parts: [], tags: [], interrupt: false, trade: true, woundsLeft: 39 },
  ] as Parameters<typeof features>[0]['events'];
  assert.equal(features({ before, after: cloneBout(before), events, me: 'A' }, { mine: worth(before, 'A'), theirs: worth(before, 'B') }).free, 0);
});

test('pursuit: when the opponent backs off, keeping its reach counts, losing it counts against', () => {
  const run = (endSep: number) => {
    const before = newBout({ name: 'D', morph: 'drake', stone: 'earth' }, TD_WATER, 4);
    const after = cloneBout(before);
    after.record.push({ exchange: 1, slot: 0, separation: 4 * R.PACE, z: { A: 0, B: 0 }, wounds: { A: 30, B: 42 }, actions: { A: 'approach', B: 'retreat' }, landed: { A: false, B: false }, breathReady: { A: true, B: true }, meterFull: { A: false, B: false } });
    after.fighters.B.pos = { x: after.fighters.A.pos.x + endSep * R.PACE, y: 0, z: 0 };
    return features({ before, after, events: [], me: 'A' }, { mine: worth(before, 'A'), theirs: worth(before, 'B') }).pursuit;
  };
  assert.equal(run(4), 1, 'kept Close');
  assert.equal(run(9.5), -1, 'let it slip beyond Far');
});

test('Ravener: a Drake values revising slot 3 into a safe Approach over a Bite from beyond reach', async () => {
  const { value } = await import('../src/brain.ts');
  const { simulateSlot } = await import('../src/referee.ts');
  const base = newBout({ name: 'D', morph: 'drake', stone: 'earth' }, TD_WATER, 8);
  base.exchange = 1;
  base.globalSlot = 2;
  const ctx = { mine: worth(base, 'A'), theirs: worth(base, 'B') };
  const slot3 = (name: 'approach' | 'bite') => {
    const b = cloneBout(base);
    const events = simulateSlot(b, { A: { name }, B: { name: 'hold' } });
    return value('swarmer', { before: base, after: b, events, me: 'A' }, ctx);
  };
  assert.ok(slot3('approach') > slot3('bite'), `${slot3('approach')} vs ${slot3('bite')}`);
});
