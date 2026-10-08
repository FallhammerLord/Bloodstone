// Each test pins a claim from dragon-duel-design.md. If a rule change breaks one, the doc and the
// Referee disagree, and one of them needs updating.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { hatch, matchup } from '../src/hatch.ts';
import { inShape } from '../src/shapes.ts';
import * as R from '../src/rules.ts';
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

test('the grid: base adds first (a disliked stone costs 6 Wounds), then the tertiaries derive', () => {
  // Accuracy = Claw − Evasion, Affinity = Breath − Scales (each at least 3); a preferred stone adds +3 to its own.
  const td = hatch('true-dragon', 'fire');
  assert.deepEqual([td.breath, td.wounds, td.accuracy, td.affinity], [18, 66, 3, 18 - 6 + 3]);
  const tdE = hatch('true-dragon', 'earth');
  assert.deepEqual([tdE.bite, tdE.wounds, tdE.accuracy, tdE.affinity], [15, 60, 3, 9]);
  // Air (Claw 12, Bite 12, Breath 12): a preferred Air stone adds +3 to every Surge trigger, not to a derived stat.
  const wa = hatch('wyvern', 'air');
  assert.deepEqual([wa.claw, wa.bite, wa.breath, wa.wounds, wa.evasion, wa.accuracy, wa.affinity, wa.surgeFill], [12, 12, 12, 60, 9, 3, 9, 3]);
  const wf = hatch('wyvern', 'fire');
  assert.deepEqual([wf.breath, wf.wounds, wf.accuracy, wf.affinity], [18, 54, 3, 15]);
  const ww = hatch('wyrm', 'water');
  assert.deepEqual([ww.affinity, ww.wounds, ww.scales, ww.acumen], [9, 54, 9, 13]);
  const wr = hatch('wyrm', 'air');
  assert.deepEqual([wr.claw, wr.wounds, wr.accuracy, wr.affinity, wr.surgeFill], [12, 48, 6, 3, 0]);
});

test('neutral pairings keep the base tables', () => {
  const h = hatch('true-dragon', 'water');
  assert.equal(h.preference, 'neutral');
  assert.deepEqual([h.wounds, h.evasion, h.scales, h.accuracy, h.acumen], [66, 3, 6, 6, 10]);
  assert.deepEqual([h.claw, h.bite, h.breath, h.affinity], [9, 9, 18, 12]);
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
  assert.deepEqual(timing(R.DEFAULT_RULES, [12, 6, 12], -3, 5), [9, 4, 17]);
  assert.deepEqual(timing(R.DEFAULT_RULES, [12, 6, 12], -5, 3), [7, 8, 15]);
  for (const t of [timing(R.DEFAULT_RULES, [12, 6, 12], 3, 5), timing(R.DEFAULT_RULES, [15, 6, 9], 9, 9)]) {
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
  assert.equal(hitsBy(hits, 'B')[0].damage, 6); // True Dragon + Water's Bite 9 − (Scales 6 pierced to 3)
});

test('chained bites deal 21 to a True Dragon: 6 + 6 + 9 (Bite pierces 3 Scales)', () => {
  const { hits, bout } = fight(TD_WATER, TD_WATER, 4, ['bite', 'bite', 'bite'], ['hold', 'hold', 'hold']);
  assert.deepEqual(hits.map((h) => h.damage), [6, 6, 9]);
  assert.equal(bout.fighters.B.wounds, 66 - 21);
});

test('a chain needs each link to land', () => {
  // The first bite is out of reach (Far); B then steps in a band, and the next two count as links 1 and 2, so no +3.
  // (B's slow approach is still in recovery at tick 12, so link 1 also punishes.)
  const { hits } = fight(TD_WATER, TD_WATER, 7, ['bite', 'bite', 'bite'], ['hold', 'approach', 'hold']);
  assert.deepEqual(hits.map((h) => h.damage), [6 + R.DEFAULT_RULES.PUNISH_BONUS, 6]);
});

test('breath skips Evasion and applies the matchup', () => {
  // Wyrm + Water (Breath 18) against an approaching True Dragon + Earth (Affinity 15 − 6 = 9): 18 − 9 + 3 + 2. The move's evasive
  // window has closed by tick 12, so the Breath also catches it in recovery (+3 punish). (A full-band strafe leaves the
  // jet's line by geometry.)
  const { hits } = fight({ name: 'Tide', morph: 'wyrm', stone: 'water' }, { name: 'Clod', morph: 'true-dragon', stone: 'earth' }, 7, ['breath'], ['approach']);
  assert.equal(hitsBy(hits, 'A')[0].damage, 18 - 9 + R.DEFAULT_RULES.MATCHUP + R.DEFAULT_RULES.ELEMENT_BREATH_MOD.water + R.DEFAULT_RULES.PUNISH_BONUS, 'Potency 18, Affinity 9, +3 matchup, +2 Water, +3 punish');
});

test('breath cooldown 2: a second breath in the same exchange holds instead', () => {
  const { events } = fight(TD_WATER, TD_WATER, 5, ['breath', 'hold', 'breath'], ['hold', 'hold', 'hold']);
  assert.ok(events.some((e) => e.kind === 'note' && e.text.includes('cooling down')));
});

test('every landed hit deals at least 1', () => {
  // True Dragon + Water claw (3) against Wyrm + Air scales (9).
  const { hits } = fight(TD_WATER, { name: 'Coil', morph: 'wyrm', stone: 'air' }, 2, ['claw:left'], ['hold']);
  assert.equal(hits[0].damage, 1);
});

test('Intimidate adds +3 to the next attack, demoralizes the target, and attacks punish it', () => {
  const { hits } = fight(TD_WATER, TD_WATER, 4, ['intimidate', 'bite', 'intimidate'], ['hold', 'hold', 'bite']);
  assert.equal(hitsBy(hits, 'A')[0].damage, 6 + R.DEFAULT_RULES.INTIMIDATE_BONUS);
  assert.equal(hitsBy(hits, 'B')[0].damage, 6 + R.DEFAULT_RULES.PUNISH_BONUS - R.DEFAULT_RULES.DEMORALIZE);
});

test('Guard adds Scales while guarding', () => {
  const { hits } = fight(TD_WATER, TD_WATER, 4, ['bite'], ['guard']);
  assert.equal(hits[0].damage, 9 - (6 + R.DEFAULT_RULES.GUARD_SCALES - R.DEFAULT_RULES.BITE_PIERCE)); // Bite 9 against Scales 6 + Guard, pierced
});

test('a strafe during the wind-up slips a bite', () => {
  const { hits } = fight(TD_WATER, { name: 'Gale', morph: 'wyvern', stone: 'air' }, 4, ['bite'], ['strafe:ccw']);
  assert.equal(hits.length, 0);
});

test('stomp deals 3 + Scales ÷ 3 true damage and Staggers: the next move runs on half its Evasion', () => {
  // Wyrm + Air has Evasion 6: a strafe evades for 12 ticks; Staggered, Evasion 3 evades for 6 (it still carries its band).
  const { hits, events } = fight(TD_WATER, { name: 'Coil', morph: 'wyrm', stone: 'air' }, 1.5, ['stomp', 'hold'], ['hold', 'strafe:cw']);
  assert.equal(hits[0].damage, R.DEFAULT_RULES.STOMP_DAMAGE + Math.floor(6 / R.DEFAULT_RULES.STOMP_SCALES_DIVISOR.wyrmling)); // True Dragon Scales 6
  const free = fight(TD_WATER, { name: 'Coil', morph: 'wyrm', stone: 'air' }, 1.5, ['hold', 'hold'], ['hold', 'strafe:cw']).events;
  const strafeWindow = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'slotEnd' }> => e.kind === 'slotEnd')[1].plans.B.active;
  assert.ok(strafeWindow(events) < strafeWindow(free), 'the staggered strafe evades for less');
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

test('band moves carry one band for everyone; Evasion buys speed', () => {
  // A Wyvern at Evasion 12 (as a shard might give) and one at its base 9 both retreat one band; 12 gets there first.
  const at = (stone: 'fire' | 'water', tick: number) => {
    const bout = newBout(TD_WATER, { name: 'G', morph: 'wyvern', stone }, 4);
    if (stone === 'fire') bout.fighters.B.sheet.evasion = 12;
    const ev = runExchange(bout, { A: ['hold'].map(parseAction), B: ['retreat'].map(parseAction) }, { trace: true });
    const tr = ev.find((e) => e.kind === 'trace' && e.tick === tick);
    return tr && tr.kind === 'trace' ? tr.positions.B.x : NaN;
  };
  assert.equal(at('fire', 9), at('fire', 29), 'Evasion 12 travels 72 ÷ 12 = 6 ticks: done by tick 9');
  assert.ok(at('water', 9) < at('water', 29), 'Evasion 9 travels 8 ticks: still moving at tick 9');
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
  const ev = runExchange(bout, { A: ['bite', 'guard', 'bite'].map(parseAction), B: ['hold', 'hold', 'hold'].map(parseAction) });
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

test('Guard adds Affinity against breath, as it adds Scales against Bite and Claw', () => {
  const at = (guard: string) => {
    const bout = newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5);
    const ev = runExchange(bout, { A: ['breath'].map(parseAction), B: [guard].map(parseAction) });
    return ev.filter((e) => e.kind === 'hit').map((e) => e.kind === 'hit' && e.damage)[0];
  };
  assert.equal(Number(at('hold')) - Number(at('guard')), 3);
});

test('every dragon strafes a full band: 3 paces of arc at its separation, short or long by Evasion', () => {
  for (const morph of ['true-dragon', 'wyvern', 'wyrm'] as const) {
    const b = newBout(TD_WATER, { name: 'S', morph, stone: 'water' }, 6);
    const before = { ...b.fighters.B.pos };
    runExchange(b, { A: [parseAction('hold')], B: [parseAction('strafe:cw')] });
    const after = b.fighters.B.pos;
    const r = Math.hypot(before.x - b.fighters.A.pos.x, before.y - b.fighters.A.pos.y);
    const ang = Math.abs(Math.atan2(after.y - b.fighters.A.pos.y, after.x - b.fighters.A.pos.x) - Math.atan2(before.y - b.fighters.A.pos.y, before.x - b.fighters.A.pos.x));
    assert.ok(Math.abs(ang * r - R.BAND) <= R.PACE / 2, `${morph}: ${(ang * r / R.PACE).toFixed(2)} paces of arc`);
  }
  const wyv = (depth: string) => {
    const b = newBout(TD_WATER, { name: 'S', morph: 'wyvern', stone: 'water' }, 6);
    const y0 = b.fighters.B.pos.y;
    runExchange(b, { A: [parseAction('hold')], B: [parseAction(`strafe:cw${depth}`)] });
    return Math.abs(b.fighters.B.pos.y - y0);
  };
  assert.ok(wyv(':short') < wyv('') && wyv('') < wyv(':long'), 'Evasion picks the landing');
});

test('the Claw sweeps half into Close at the sides, Melee\'s edge forward, a pace behind', () => {
  const sheet = hatch('true-dragon', 'water');
  const o = { x: 0, y: 0, z: 0 }, aim = { x: R.PACE, y: 0, z: 0 };
  const at = (x: number, y: number) => inShape(R.DEFAULT_RULES, 'claw', sheet, o, aim, { x: x * R.PACE, y: y * R.PACE, z: 0 }, 0);
  assert.ok(at(0, 4), 'level with the shoulders at 4 paces (Close): caught');
  assert.ok(!at(4, 0), 'straight ahead at 4 paces: beyond Melee');
  assert.ok(at(3, 0), 'straight ahead at Melee\'s edge: caught');
  assert.ok(at(-0.9, 2) && !at(-1.5, 2), 'it wraps a pace behind the shoulders');
});
