// Step 2: revisions, the bout runner, late pressure, timeouts, and the AI.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction, type ActionSpec } from '../src/actions.ts';
import { aiController, STYLES } from '../src/ai.ts';
import { DEFAULT_RULES, rimPulse, runBout, viewOf, type Controller } from '../src/bout.ts';
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
  assert.deepEqual(Object.keys(view).sort(), ['exchange', 'globalSlot', 'history', 'me', 'opp', 'separation', 'side', 'startWounds']);
  assert.ok(!JSON.stringify(view).includes('slots'));
});

test('one revision per exchange', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, {
    revise: { A: () => parseAction('scales') },
  });
  assert.equal(ev.filter((e) => e.kind === 'revision').length, 1);
});

test('same-moment revisions are simultaneous: neither sees the other\'s flash', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const saw: boolean[] = [];
  const reviser = (_b: unknown, _s: unknown, m: number, opp: boolean): ActionSpec | null => {
    if (m !== 2) return null;
    saw.push(opp);
    return parseAction('scales');
  };
  runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, { revise: { A: reviser, B: reviser } });
  assert.deepEqual(saw, [false, false]);
});

test('a revised slot 3 gets no chain bonus', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['bite', 'bite', 'claw:left'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) }, {
    revise: { A: (_b, _s, m) => (m === 2 ? parseAction('bite') : null) },
  });
  assert.deepEqual(hits(ev).map((h) => h.damage), [6, 6, 6]);
});

// ---- Late pressure (§5) ----

function onRim(bout: ReturnType<typeof newBout>) {
  bout.fighters.A.pos = { x: -(R.ARENA_RADIUS - R.PACE), y: 0, z: 0 };
}

test('pulse 1 can\'t kill: it leaves 1 point at worst', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  onRim(bout);
  bout.fighters.A.wounds = 5;
  bout.exchange = DEFAULT_RULES.exchangeLimit - 2; // pulse 1
  rimPulse(bout, DEFAULT_RULES);
  assert.equal(bout.fighters.A.wounds, 1);
  assert.equal(bout.over, false);
});

test('pulse 2 kills only a dragon pulse 1 already hit', () => {
  const fresh = newBout(TD_WATER, TD_WATER, 6);
  onRim(fresh);
  fresh.fighters.A.wounds = 5;
  fresh.exchange = DEFAULT_RULES.exchangeLimit - 1;
  rimPulse(fresh, DEFAULT_RULES);
  assert.equal(fresh.fighters.A.wounds, 1);

  const pulsed = newBout(TD_WATER, TD_WATER, 6);
  onRim(pulsed);
  pulsed.fighters.A.wounds = 5;
  pulsed.fighters.A.pulsed = true;
  pulsed.exchange = DEFAULT_RULES.exchangeLimit - 1;
  rimPulse(pulsed, DEFAULT_RULES);
  assert.equal(pulsed.over, true);
  assert.equal(pulsed.winner, 'B');
});

test('pulses deal a third of maximum Wounds and spare the center', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6);
  onRim(bout);
  bout.exchange = DEFAULT_RULES.exchangeLimit;
  const ev = rimPulse(bout, DEFAULT_RULES);
  assert.equal(bout.fighters.A.wounds, 36 - 12);
  assert.equal(bout.fighters.B.wounds, 36);
  assert.equal(ev.filter((e) => e.kind === 'pulse').length, 1);
});

// ---- Bouts and timeouts (§9) ----

test('a bout runs to the exchange limit, then the challenger forfeits', () => {
  const bout = newBout(TD_WATER, TD_WATER, 6, 'B');
  const ev = runBout(bout, { A: scripted([]), B: scripted([]) });
  assert.equal(bout.exchange, DEFAULT_RULES.exchangeLimit);
  assert.equal(bout.winner, 'B');
  assert.ok(ev.some((e) => e.kind === 'boutEnd' && e.reason.startsWith('timeout')));
  assert.equal(bout.fighters.A.wounds, 36, 'timeouts are never lethal');
});

test('open-lobby timeout can go to most Wounds', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4, 'B');
  runBout(bout, { A: scripted([['bite', 'hold', 'hold']]), B: scripted([]) }, { ...DEFAULT_RULES, timeout: 'mostWounds' });
  assert.equal(bout.winner, 'A');
});

// ---- AI ----

test('the same seeds play the same bout', () => {
  const play = () => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, { name: 'G', morph: 'wyvern', stone: 'air' }, 6.5);
    return runBout(bout, { A: aiController('mixed', 3), B: aiController('guardian', 4) });
  };
  assert.deepEqual(play(), play());
});

test('the AI never scripts an action that is cooling down', () => {
  for (const a of STYLES) {
    for (const b of STYLES) {
      for (let seed = 0; seed < 5; seed++) {
        const bout = newBout({ name: 'X', morph: 'wyrm', stone: 'fire' }, { name: 'Y', morph: 'true-dragon', stone: 'earth' }, 6.5);
        const ev = runBout(bout, { A: aiController(a, seed), B: aiController(b, seed + 100) });
        assert.ok(!ev.some((e) => e.kind === 'note' && e.text.includes('cooling down')), `${a} vs ${b}, seed ${seed}`);
      }
    }
  }
});
