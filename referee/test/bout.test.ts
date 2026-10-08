// Step 2: revisions, the bout runner, late pressure, timeouts, and the AI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction, type ActionSpec } from '../src/actions.ts';
import { crudeController } from '../src/brain.ts';
import { DEFAULT_FORMAT, nextPulse, pulseAt, rimPulse, runBout, viewOf, type Controller } from '../src/bout.ts';
import { newBout, runExchange, type Event, type FighterSetup } from '../src/referee.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const scripted = (exchanges: string[][]): Controller => ({
  name: 'script',
  script: (v) => (exchanges[v.exchange] ?? ['hold', 'hold', 'hold']).map(parseAction),
});
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');

// ---- Revision (§4) ----

test('a revision replaces slot 3 and flashes', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, {
    revise: { A: (_b, _s, m) => (m === 2 ? parseAction('bite') : null) },
  });
  assert.ok(ev.some((e) => e.kind === 'revision' && e.side === 'A' && e.to === 'Bite'));
  assert.equal(hits(ev).length, 1);
});

test('a side sees that the opponent revised, never what to', () => {
  // Controllers see the board and a yes/no flash. No script, revised or not, is part of what they see.
  const view = viewOf(newBout(TD_WATER, TD_WATER, 4), 'A');
  assert.deepEqual(Object.keys(view).sort(), ['arena', 'challenged', 'exchange', 'globalSlot', 'history', 'me', 'opp', 'pulse', 'record', 'rules', 'separation', 'side', 'startWounds']);
  assert.ok(!JSON.stringify(view).includes('slots'));
});

test('one revision per exchange', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, {
    revise: { A: () => parseAction('guard') },
  });
  assert.equal(ev.filter((e) => e.kind === 'revision').length, 1);
});

test('same-moment revisions are simultaneous: neither sees the other\'s flash', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const saw: boolean[] = [];
  const reviser = (_b: unknown, _s: unknown, m: number, opp: boolean): ActionSpec | null => {
    if (m !== 2) return null;
    saw.push(opp);
    return parseAction('guard');
  };
  runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, { revise: { A: reviser, B: reviser } });
  assert.deepEqual(saw, [false, false]);
});

test('a revised slot 3 gets no chain bonus', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['bite', 'bite', 'claw:left'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, {
    revise: { A: (_b, _s, m) => (m === 2 ? parseAction('bite') : null) },
  });
  assert.deepEqual(hits(ev).map((h) => h.damage), [6, 6, 6]); // Bite 9 against Scales 6 pierced to 3; no chain bonus on the revision
});

// ---- Late pressure (§5) ----

function onRim(bout: ReturnType<typeof newBout>) {
  bout.fighters.A.pos = { x: -(R.DEFAULT_RULES.ARENA_RADIUS - R.PACE), y: 0, z: 0 };
}

test('the Barrier Pulse: from exchange 15, every other exchange through 25, then every exchange to the limit', () => {
  const rules = R.DEFAULT_RULES;
  const at = Array.from({ length: rules.EXCHANGE_LIMIT }, (_, i) => i + 1).filter((x) => pulseAt(rules, x));
  assert.deepEqual(at, [15, 17, 19, 21, 23, 25, 26, 27, 28, 29, 30]);
  assert.deepEqual([nextPulse(rules, 1), nextPulse(rules, 16), nextPulse(rules, 26)], [15, 17, 26]);
});

test('the first pulse can\'t kill: it leaves 1 point at worst', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  onRim(bout);
  bout.fighters.A.wounds = 5;
  bout.exchange = R.DEFAULT_RULES.PULSE_START;
  rimPulse(bout);
  assert.equal(bout.fighters.A.wounds, 1);
  assert.equal(bout.over, false);
});

test('through the every-other run a pulse kills only a dragon an earlier pulse hit; then it kills anyone', () => {
  const at = (exchange: number, pulsed: boolean) => {
    const b = newBout(TD_WATER, TD_WATER, 6);
    onRim(b);
    b.fighters.A.wounds = 5;
    b.fighters.A.pulsed = pulsed;
    b.exchange = exchange;
    rimPulse(b);
    return b;
  };
  assert.equal(at(17, false).fighters.A.wounds, 1, 'a fresh dragon survives the every-other run');
  assert.equal(at(17, true).winner, 'B', 'a dragon already pulsed falls');
  assert.equal(at(26, false).winner, 'B', 'every exchange from 26: anyone on the rim');
  assert.equal(at(16, false).fighters.A.wounds, 5, 'no pulse at 16');
});

test('both sides are warned: the view names the next pulse, and an alert opens the exchange before it and the one it ends', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  bout.exchange = 13;
  assert.deepEqual(viewOf(bout, 'A').pulse, { at: 15, lethal: 'never' });
  const ev = runBout(bout, { A: scripted([]), B: scripted([]) }, { ...DEFAULT_FORMAT, exchangeLimit: 15 });
  const warnings = ev.filter((e) => e.kind === 'pulseWarning');
  assert.deepEqual(warnings.map((w) => w.kind === 'pulseWarning' && [w.exchange, w.at]), [[14, 15], [15, 15]]);
});

test('pulses deal a third of maximum Wounds and spare the center', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  onRim(bout);
  bout.exchange = R.DEFAULT_RULES.EXCHANGE_LIMIT;
  const ev = rimPulse(bout);
  assert.equal(bout.fighters.A.wounds, 66 - 22);
  assert.equal(bout.fighters.B.wounds, 66);
  assert.equal(ev.filter((e) => e.kind === 'pulse').length, 1);
});

// ---- Bouts and timeouts (§9) ----

test('a bout runs to the exchange limit, then the challenger forfeits', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6, 'B');
  const ev = runBout(bout, { A: scripted([]), B: scripted([]) });
  assert.equal(bout.exchange, R.DEFAULT_RULES.EXCHANGE_LIMIT);
  assert.equal(bout.winner, 'B');
  assert.ok(ev.some((e) => e.kind === 'boutEnd' && e.reason.startsWith('timeout')));
  assert.equal(bout.fighters.A.wounds, 66, 'timeouts are never lethal');
});

test('open-lobby timeout can go to most Wounds', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4, 'B');
  runBout(bout, { A: scripted([['bite', 'hold', 'hold']]), B: scripted([]) }, { ...DEFAULT_FORMAT, timeout: 'mostWounds' });
  assert.equal(bout.winner, 'A');
});

// ---- AI ----

test('the same seeds play the same bout', () => {
  const play = () => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, { name: 'G', morph: 'wyvern', stone: 'air' }, 6.5);
    return runBout(bout, { A: crudeController(3), B: crudeController(4) });
  };
  assert.deepEqual(play(), play());
});

test('the crude brain never scripts an action that is cooling down', () => {
  for (let seed = 0; seed < 10; seed++) {
    const bout = newBout({ name: 'X', morph: 'wyrm', stone: 'fire' }, { name: 'Y', morph: 'true-dragon', stone: 'earth' }, 6.5);
    const ev = runBout(bout, { A: crudeController(seed), B: crudeController(seed + 100) });
    assert.ok(!ev.some((e) => e.kind === 'note' && e.text.includes('cooling down')), `seed ${seed}`);
  }
});
