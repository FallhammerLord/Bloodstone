// Techniques (dragonshards-technique.md): one or two checks each, at the grades that change behavior.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, type Bout, type Event, type FighterSetup, type ShardSetup } from '../src/referee.ts';
import type { Grade } from '../src/shards.ts';
import * as R from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const withTech = (base: FighterSetup, shard: string, grade: Grade, extra: ShardSetup[] = []): FighterSetup => {
  const pips = grade === 'elder' || grade === 'venerable' ? [0, 1] : [0];
  const wide = shard === 'Lance Throat' ? (grade === 'elder' || grade === 'venerable' ? [0, 1, 2] : [0, 1]) : pips;
  return { ...base, shards: [{ shard, grade, pips: wide }, ...extra] };
};
const run = (bout: Bout, A: string[], B: string[], opts = {}) => runExchange(bout, { A: A.map(parseAction), B: B.map(parseAction) }, opts);
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');
const notes = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'note' }> => e.kind === 'note').map((e) => e.text);
const slotPlans = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'slotEnd' }> => e.kind === 'slotEnd').map((e) => e.plans);

test('Snapping Jaw: faster wind-up, slower recovery; Adult terms are lighter', () => {
  const plan = (g: Grade) => slotPlans(run(newBout(withTech(TD_WATER, 'Snapping Jaw', g), TD_WATER, 4), ['bite'], ['hold']))[0].A;
  assert.deepEqual([plan('wyrmling').windup, plan('wyrmling').recovery], [9, 17]);
  assert.deepEqual([plan('juvenile').windup, plan('juvenile').recovery], [7, 17]);
  assert.deepEqual([plan('adult').windup, plan('adult').recovery], [7, 15]);
});

test('Snapping Jaw Elder: a Bite that interrupts deals +3', () => {
  // The fast bite (active from tick 7) catches a slow Stomp's wind-up.
  const ev = run(newBout(withTech(TD_WATER, 'Snapping Jaw', 'elder'), TD_WATER, 2), ['bite'], ['stomp']);
  const h = hits(ev)[0];
  assert.ok(h.interrupt);
  assert.equal(h.damage, 6 + 3);
});

test('Lockjaw: a landed Bite Pins; nothing is forced; a Venerable\'s next Bite gains +3', () => {
  const free = run(newBout(withTech(TD_WATER, 'Lockjaw', 'juvenile'), TD_WATER, 4), ['bite', 'claw:left'], ['hold', 'retreat']);
  assert.ok(notes(free).some((n) => n.startsWith('Pinned')), 'the target is Pinned');
  assert.ok(!notes(free).some((n) => n.includes('becomes a Bite')), 'the biter keeps its scripted Claw');
  const ven = run(newBout(withTech(TD_WATER, 'Lockjaw', 'venerable'), TD_WATER, 4), ['bite', 'bite'], ['hold', 'hold']);
  assert.ok(hits(ven)[1].parts.includes('+3 Lockjaw follow-up'));
});

test('Hamstring Hooks: a landed Claw Staggers; Venerable keeps it from Leaping', () => {
  const ev = run(newBout(withTech(TD_WATER, 'Hamstring Hooks', 'venerable'), TD_WATER, 2), ['claw:left'], ['hold', 'leap']);
  assert.ok(notes(ev).some((n) => n.startsWith('Hamstring Hooks: Staggered')));
  assert.ok(notes(ev).some((n) => n.startsWith("Hamstrung: can't Leap")));
});

test('Scything Forelimbs: the claw arc widens', () => {
  // At 4 paces a plain claw falls short; a scything one reaches.
  const plain = run(newBout(TD_WATER, TD_WATER, 4), ['claw:left'], ['hold']);
  const scy = run(newBout(withTech(TD_WATER, 'Scything Forelimbs', 'juvenile'), TD_WATER, 4), ['claw:left'], ['hold']);
  assert.equal(hits(plain).length, 0);
  assert.equal(hits(scy).length, 1);
});

test('Ratchet Claws Elder: a Claw chain holds through a hitless exchange and resumes 3 ticks faster', () => {
  const air: FighterSetup = { name: 'Ash', morph: 'true-dragon', stone: 'air' };
  const bout = newBout(withTech(air, 'Ratchet Claws', 'elder'), TD_WATER, 2);
  run(bout, ['claw:left', 'claw:left', 'hold'], ['hold', 'hold', 'hold']);
  const quiet = run(bout, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(notes(quiet).some((n) => n.startsWith('Ratchet Claws')));
  const ev = run(bout, ['claw:left', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(slotPlans(ev)[0].A.windup, 6 - 3);
  assert.ok(hits(ev)[0].parts.some((x) => x.includes('Ratchet Claws')), 'the third link\'s bonus pays for the hold');
});

test('Lance Throat: breath narrows to a line reaching Far\'s outer edge, and pierces Affinity from Juvenile', () => {
  // Fire's blast reaches 8 paces (center 7½, radius ½); the lance reaches 9.
  const fire: FighterSetup = { name: 'E', morph: 'true-dragon', stone: 'fire' };
  assert.equal(hits(run(newBout(fire, TD_WATER, 8.5), ['breath'], ['hold'])).length, 0);
  const ev = run(newBout(withTech(fire, 'Lance Throat', 'juvenile'), TD_WATER, 8.5), ['breath'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.equal(hits(ev)[0].damage, 15 - (6 - 3), 'Potency 15, Affinity 6 pierced to 3, Fire and Water neutral');
});

test('Smoldering Maw: −3 on the hit, then the area lingers and stings at slot end', () => {
  const ev = run(newBout(withTech(TD_WATER, 'Smoldering Maw', 'juvenile'), TD_WATER, 4), ['breath', 'hold'], ['hold', 'hold']);
  assert.equal(hits(ev)[0].damage, 1, 'Water into Water: 9 − 6 − 3 floors at 1');
  const stings = ev.filter((e) => e.kind === 'zoneEffect' && e.zone === 'smolder');
  assert.equal(stings.length, 2, 'the slot it lands and the next');
});

test('Ash Gland: no damage, and the target can\'t revise next exchange', () => {
  const bout = newBout(withTech(TD_WATER, 'Ash Gland', 'juvenile'), TD_WATER, 4);
  const ev = run(bout, ['breath'], ['hold']);
  assert.equal(hits(ev)[0].damage, 0);
  let asked = false;
  run(bout, ['hold'], ['hold'], { revise: { B: () => { asked = true; return null; } } });
  assert.equal(asked, false);
});

test('Stooping Pinions: a dive from 3 paces up adds +3 to the next attack', () => {
  const bout = newBout(withTech({ name: 'G', morph: 'wyvern', stone: 'water' }, 'Stooping Pinions', 'juvenile'), TD_WATER, 3);
  bout.fighters.A.pos = { ...bout.fighters.A.pos, z: 3 * R.PACE };
  const ev = run(bout, ['dive', 'bite'], ['hold', 'hold']);
  assert.ok(hits(ev)[0].parts.includes('+3 Stooping Pinions'));
});

test('Sidewinder Spine: a strafe can shift toward the opponent', () => {
  const bout = newBout(withTech({ name: 'C', morph: 'wyrm', stone: 'water' }, 'Sidewinder Spine', 'juvenile'), TD_WATER, 6);
  run(bout, ['strafe:cw:in'], ['hold']);
  const sep = Math.hypot(bout.fighters.A.pos.x - bout.fighters.B.pos.x, bout.fighters.A.pos.y - bout.fighters.B.pos.y);
  assert.ok(sep < 5.2 * R.PACE && sep > 4.8 * R.PACE, `about one pace closer, got ${sep / R.PACE}`);
});

test('Bounding Haunches: an Approach carries twice as far', () => {
  const plain = newBout(TD_WATER, TD_WATER, 8);
  const bound = newBout(withTech(TD_WATER, 'Bounding Haunches', 'juvenile'), TD_WATER, 8);
  run(plain, ['approach'], ['hold']);
  run(bound, ['approach'], ['hold']);
  assert.equal(bound.fighters.A.pos.x - plain.fighters.A.pos.x, 3 * R.EVASION_STEP);
});

test('Thornscale: attackers landing into Scales take 3', () => {
  const bout = newBout(TD_WATER, withTech(TD_WATER, 'Thornscale', 'juvenile'), 2);
  run(bout, ['claw:left'], ['scales']);
  assert.equal(bout.fighters.A.wounds, 36 - 3);
});

test('Riposte Talons: a successful Dodge earns a free claw', () => {
  // A Wyvern dodging (Evasion 9 + 3) beats a True Dragon's Accuracy 6.
  const bout = newBout(TD_WATER, withTech({ name: 'G', morph: 'wyvern', stone: 'water' }, 'Riposte Talons', 'juvenile'), 4);
  const ev = run(bout, ['bite'], ['dodge']);
  assert.ok(ev.some((e) => e.kind === 'evade'));
  assert.equal(bout.fighters.A.wounds, 36 - 3);
});

test('Mantle Wings: Scales adds Affinity against breath', () => {
  const plain = hits(run(newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, TD_WATER, 5), ['breath'], ['scales']))[0].damage;
  const mantle = hits(run(newBout({ name: 'E', morph: 'true-dragon', stone: 'fire' }, withTech(TD_WATER, 'Mantle Wings', 'juvenile'), 5), ['breath'], ['scales']))[0].damage;
  assert.equal(plain - mantle, 3);
});

test('Sapping Bellow: strips the opponent\'s next chain bonus instead of granting +3', () => {
  const ev = run(newBout(withTech(TD_WATER, 'Sapping Bellow', 'juvenile'), TD_WATER, 4), ['intimidate', 'hold', 'hold'], ['hold', 'bite', 'bite']);
  // B's chain only reaches two links here; check the bellow took hold instead of a +3.
  assert.ok(notes(ev).some((n) => n.startsWith('Sapping Bellow')));
  assert.ok(!notes(ev).some((n) => n.startsWith('Intimidate lands')));
});

test('Baleful Eye: intimidating in slot 1 or 2 shows the opponent\'s slot 3 at the revision window', () => {
  const seen: (string | null)[] = [];
  run(newBout(withTech(TD_WATER, 'Baleful Eye', 'elder'), TD_WATER, 4), ['intimidate', 'hold', 'hold'], ['hold', 'hold', 'breath'], {
    revise: { A: (_b: unknown, _s: unknown, _m: unknown, _o: unknown, r: string | null) => { seen.push(r); return null; } },
  });
  assert.deepEqual(seen, ['Breath', 'Breath']);
});

test('Goading Roar: a Retreat next slot stings for 3', () => {
  const bout = newBout(withTech(TD_WATER, 'Goading Roar', 'juvenile'), TD_WATER, 4);
  run(bout, ['intimidate', 'hold'], ['hold', 'retreat']);
  assert.equal(bout.fighters.B.wounds, 36 - 3);
});
