// Each test pins a claim from dragon-duel-design.md. If a rule change breaks one, the doc and the
// Referee disagree, and one of them needs updating.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { hatch, matchup } from '../src/hatch.ts';
import { newBout, runExchange, timing, type Event, type FighterSetup, type Side } from '../src/referee.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const TD_AIR: FighterSetup = { name: 'Ash', morph: 'true-dragon', stone: 'air' };

function fight(a: FighterSetup, b: FighterSetup, sep: number, A: string[], B: string[]) {
  const bout = newBout(a, b, sep);
  const events = runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) });
  const hits = events.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');
  return { bout, events, hits };
}

const hitsBy = (hits: Extract<Event, { kind: 'hit' }>[], side: Side) => hits.filter((h) => h.attacker === side);

// ---- Hatching (§2) ----

test('swing table: every pairing in the design doc, with derived knock-ons', () => {
  const td = hatch('true-dragon', 'fire');
  assert.deepEqual([td.breath, td.wounds, td.affinity], [15, 30, 6]);
  const tdE = hatch('true-dragon', 'earth');
  assert.deepEqual([tdE.bite, tdE.wounds], [9, 42]);
  const wa = hatch('wyvern', 'air');
  assert.deepEqual([wa.claw, wa.evasion, wa.accuracy], [12, 6, 3]);
  const wf = hatch('wyvern', 'fire');
  assert.deepEqual([wf.breath, wf.evasion, wf.affinity, wf.accuracy], [9, 12, 0, 9]);
  const ww = hatch('wyrm', 'water');
  assert.deepEqual([ww.affinity, ww.hardness], [9, 3]);
  const wr = hatch('wyrm', 'air');
  assert.deepEqual([wr.claw, wr.hardness], [6, 9]);
});

test('neutral pairings keep the base tables', () => {
  const h = hatch('true-dragon', 'water');
  assert.equal(h.preference, 'neutral');
  assert.deepEqual([h.wounds, h.evasion, h.hardness, h.accuracy], [36, 3, 3, 6]);
  assert.deepEqual([h.claw, h.bite, h.breath, h.affinity], [3, 9, 9, 6]);
});

test('element wheel: each element beats the three clockwise of it; opposites are neutral', () => {
  assert.equal(matchup('water', 'earth'), 1);
  assert.equal(matchup('earth', 'fire'), 1);
  assert.equal(matchup('fire', 'air'), 1);
  assert.equal(matchup('air', 'water'), 1);
  assert.equal(matchup('earth', 'water'), -1);
  assert.equal(matchup('water', 'fire'), 0);
  assert.equal(matchup('earth', 'air'), 0);
  assert.equal(matchup('water', 'magma'), 1);
  assert.equal(matchup('water', 'lightning'), -1);
});

// ---- Timing (§4) ----

test('timing shifts move the active window; the action stays 30 ticks', () => {
  assert.deepEqual(timing([12, 6, 12], -3, 5), [9, 4, 17]);
  assert.deepEqual(timing([12, 6, 12], -5, 3), [7, 8, 15]);
  for (const t of [timing([12, 6, 12], 3, 5), timing([15, 6, 9], 9, 9)]) {
    assert.equal(t[0] + t[1] + t[2], 30);
    assert.ok(t[1] >= 3, 'active window floor');
  }
});

// ---- Combat (§4) ----

test('footsies at Melee: claw interrupts bite', () => {
  const { hits } = fight(TD_AIR, TD_WATER, 2, ['claw:left'], ['bite']);
  assert.equal(hitsBy(hits, 'A').length, 1);
  assert.equal(hitsBy(hits, 'A')[0].interrupt, true);
  assert.equal(hitsBy(hits, 'B').length, 0);
});

test('footsies at Close: bite lands, claw only reaches the arc edge', () => {
  const { hits } = fight(TD_AIR, TD_WATER, 4, ['claw:left'], ['bite']);
  assert.equal(hitsBy(hits, 'A').length, 0);
  assert.equal(hitsBy(hits, 'B').length, 1);
  assert.equal(hitsBy(hits, 'B')[0].damage, 6); // baseline bite: 9 − 3
});

test('chained bites deal 21 to a True Dragon: 6 + 6 + 9', () => {
  const { hits, bout } = fight(TD_WATER, TD_WATER, 4, ['bite', 'bite', 'bite'], ['hold', 'hold', 'hold']);
  assert.deepEqual(hits.map((h) => h.damage), [6, 6, 9]);
  assert.equal(bout.fighters.B.wounds, 36 - 21);
});

test('a chain needs each link to land', () => {
  // B steps in during the first bite, which misses; the next two bites count as links 1 and 2, so no +3.
  const { hits } = fight(TD_WATER, TD_WATER, 6, ['bite', 'bite', 'bite'], ['approach', 'hold', 'hold']);
  assert.deepEqual(hits.map((h) => h.damage), [6, 6]);
});

test('breath skips Evasion and applies the matchup', () => {
  // Wyrm + Water (Breath 9) against True Dragon + Earth (Affinity 0): 9 − 0 + 3.
  const { hits } = fight({ name: 'Tide', morph: 'wyrm', stone: 'water' }, { name: 'Clod', morph: 'true-dragon', stone: 'earth' }, 7, ['breath'], ['strafe:cw']);
  assert.equal(hitsBy(hits, 'A')[0].damage, 12);
});

test('breath cooldown 2: a second breath in the same exchange holds instead', () => {
  const { events } = fight(TD_WATER, TD_WATER, 5, ['breath', 'hold', 'breath'], ['hold', 'hold', 'hold']);
  assert.ok(events.some((e) => e.kind === 'note' && e.text.includes('cooling down')));
});

test('every landed hit deals at least 1', () => {
  // True Dragon + Water claw (3) against Wyrm + Air hardness (9).
  const { hits } = fight(TD_WATER, { name: 'Coil', morph: 'wyrm', stone: 'air' }, 2, ['claw:left'], ['hold']);
  assert.equal(hits[0].damage, 1);
});

test('Intimidate adds +3 to the next attack, and attacks punish it', () => {
  const { hits } = fight(TD_WATER, TD_WATER, 4, ['intimidate', 'bite', 'intimidate'], ['hold', 'hold', 'bite']);
  assert.equal(hitsBy(hits, 'A')[0].damage, 9); // 6 + 3 Intimidate
  assert.equal(hitsBy(hits, 'B')[0].damage, 9); // 6 + 3 punish
});

test('Scales adds Hardness while guarding', () => {
  const { hits } = fight(TD_WATER, TD_WATER, 4, ['bite'], ['scales']);
  assert.equal(hits[0].damage, 3); // 9 − (3 + 3)
});

test('a strafe during the wind-up slips a bite', () => {
  const { hits } = fight(TD_WATER, { name: 'Gale', morph: 'wyvern', stone: 'air' }, 4, ['bite'], ['strafe:ccw']);
  assert.equal(hits.length, 0);
});

test('stomp deals 3 true damage and Staggers: the next move goes half as far', () => {
  // Wyrm + Air has Evasion 6: a retreat normally carries 2 paces; Staggered, 1.
  const { hits, bout } = fight(TD_WATER, { name: 'Coil', morph: 'wyrm', stone: 'air' }, 1.5, ['stomp', 'hold'], ['hold', 'retreat']);
  assert.equal(hits[0].damage, 3);
  assert.equal(bout.fighters.B.pos.x - bout.fighters.A.pos.x, Math.round(2.5 * 300));
});

test('the leash turns a retreat at Very Far into a roar', () => {
  const { events, bout } = fight(TD_WATER, TD_WATER, 11.5, ['retreat'], ['hold']);
  assert.ok(events.some((e) => e.kind === 'note' && e.text.includes('roar')));
  assert.ok(bout.fighters.B.pos.x - bout.fighters.A.pos.x <= 12 * 300);
});

test('the same scripts always produce the same fight', () => {
  const run = () =>
    fight({ name: 'Ember', morph: 'true-dragon', stone: 'fire' }, { name: 'Gale', morph: 'wyvern', stone: 'air' }, 6.5,
      ['breath', 'approach', 'bite'], ['strafe:cw', 'approach', 'claw:left']).events;
  assert.deepEqual(run(), run());
});

test('Evasion beyond the one-band cap buys timing: the move finishes sooner', () => {
  // Wyvern + Fire (Evasion 12) and Wyvern + Water (Evasion 9) both retreat one band; 12 gets there first.
  const at = (stone: 'fire' | 'water', tick: number) => {
    const bout = newBout(TD_WATER, { name: 'G', morph: 'wyvern', stone }, 4);
    const ev = runExchange(bout, { A: ['hold'].map(parseAction), B: ['retreat'].map(parseAction) }, { trace: true });
    const tr = ev.find((e) => e.kind === 'trace' && e.tick === tick);
    return tr && tr.kind === 'trace' ? tr.positions.B.x : NaN;
  };
  assert.equal(at('fire', 20), at('fire', 29), 'Evasion 12 has finished by tick 20');
  assert.ok(at('water', 20) < at('water', 26), 'Evasion 9 is still moving');
  assert.equal(at('fire', 29), at('water', 29), 'both carry exactly one band');
});

// ---- Chains across exchanges ----

test('a chain carries across exchanges', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  runExchange(bout, { A: ['bite', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  const ev = runExchange(bout, { A: ['bite', 'bite', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.deepEqual(ev.filter((e) => e.kind === 'hit').map((e) => e.kind === 'hit' && e.damage), [6, 9]);
});

test('other actions don\'t break a chain', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  const ev = runExchange(bout, { A: ['bite', 'scales', 'bite'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  const ev2 = runExchange(bout, { A: ['retreat', 'approach', 'bite'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  const dmg = [...ev, ...ev2].filter((e) => e.kind === 'hit').map((e) => e.kind === 'hit' && e.damage);
  assert.deepEqual(dmg, [6, 6, 9]);
});

test('a chain lapses only after a whole exchange without a landed hit', () => {
  const bout = newBout(TD_WATER, TD_WATER, 4);
  runExchange(bout, { A: ['bite', 'bite', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  const quiet = runExchange(bout, { A: ['hold', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.ok(quiet.some((e) => e.kind === 'note' && e.text.includes('chain lapses')));
  const ev = runExchange(bout, { A: ['bite', 'hold', 'hold'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
  assert.deepEqual(ev.filter((e) => e.kind === 'hit').map((e) => e.kind === 'hit' && e.damage), [6], 'link 1 again, not link 3');
});

test('Scales adds Affinity against breath, as it adds Hardness against Bite and Claw', () => {
  const at = (guard: string) => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
    const ev = runExchange(bout, { A: ['breath'].map(parseAction), B: [guard].map(parseAction) });
    return ev.filter((e) => e.kind === 'hit').map((e) => e.kind === 'hit' && e.damage)[0];
  };
  assert.equal(Number(at('hold')) - Number(at('scales')), 3);
});
