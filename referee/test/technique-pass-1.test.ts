// Technique parity pass 1 [Proposed]: each variant behind its rule key does what technique-parity-pass-1.md says.
// At base (every key's first value) nothing changes; the other test files and the goldens hold that.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAction } from '../src/actions.ts';
import { newBout, runExchange, type Bout, type Event, type FighterSetup, type ShardSetup } from '../src/referee.ts';
import type { Grade } from '../src/shards.ts';
import * as R from '../src/rules.ts';
import { ashCloud } from '../src/referee/techniques.ts';
import { runSlot } from '../src/referee/exchange.ts';
import { dist } from '../src/geometry.ts';
import type { Rules } from '../src/rules.ts';

const TD_WATER: FighterSetup = { name: 'Brine', morph: 'true-dragon', stone: 'water' };
const TD_FIRE: FighterSetup = { name: 'Ember', morph: 'true-dragon', stone: 'fire' };
const WYVERN_WATER: FighterSetup = { name: 'Gale', morph: 'wyvern', stone: 'water' };
const withTech = (base: FighterSetup, shard: string, grade: Grade, extra: ShardSetup[] = []): FighterSetup => {
  const two = shard === 'Lance Throat' || shard === 'Bellows Chest';
  const pips = grade === 'elder' || grade === 'venerable' ? (two ? [0, 1, 2] : [0, 1]) : two ? [0, 1] : [0];
  return { ...base, shards: [{ shard, grade, pips }, ...extra] };
};
// Each variant against suite v0.2, one key at a time.
const rules = (o: Partial<Rules>) => R.rulesWith({ ...R.SUITE_V02, ...o });
const bout = (a: FighterSetup, b: FighterSetup, sep: number, r: Rules) => newBout(a, b, sep, 'B', {}, r);
const run = (b: Bout, A: string[], B: string[]) => runExchange(b, { A: A.map(parseAction), B: B.map(parseAction) });
const hits = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit');
const notes = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'note' }> => e.kind === 'note').map((e) => e.text);
const slotPlans = (ev: Event[]) => ev.filter((e): e is Extract<Event, { kind: 'slotEnd' }> => e.kind === 'slotEnd').map((e) => e.plans);

test('Snapping Jaw (borrow): a snapped Bite in slot 3 delays the next exchange\'s slot-1 wind-up by 3; a Hold clears the debt', () => {
  const r = rules({ TECH_SNAPPING_JAW: 'borrow' });
  const b = bout(withTech(TD_WATER, 'Snapping Jaw', 'wyrmling'), TD_WATER, 4, r);
  const first = slotPlans(run(b, ['hold', 'hold', 'bite'], ['hold', 'hold', 'hold']));
  assert.deepEqual([first[2].A.windup, first[2].A.recovery], [9, 15], 'wind-up −3, recovery +3: the active window keeps its length');
  const next = slotPlans(run(b, ['scales', 'hold', 'hold'], ['hold', 'hold', 'hold']));
  assert.equal(next[0].A.windup, 3 + 3, 'the next slot\'s Scales winds up 3 later');
  const held = bout(withTech(TD_WATER, 'Snapping Jaw', 'wyrmling'), TD_WATER, 4, r);
  const ev = slotPlans(run(held, ['bite', 'hold', 'scales'], ['hold', 'hold', 'hold']));
  assert.equal(ev[2].A.windup, 3, 'a Hold between settles the debt');
});

test('Snapping Jaw (borrow_dmg): a snapped Bite deals 3 less', () => {
  const plain = hits(run(bout(withTech(TD_WATER, 'Snapping Jaw', 'wyrmling'), TD_WATER, 4, rules({ TECH_SNAPPING_JAW: 'borrow' })), ['bite'], ['hold']))[0].damage;
  const dmg = hits(run(bout(withTech(TD_WATER, 'Snapping Jaw', 'wyrmling'), TD_WATER, 4, rules({ TECH_SNAPPING_JAW: 'borrow_dmg' })), ['bite'], ['hold']))[0].damage;
  assert.equal(plain - dmg, 3);
});

test('Lockjaw (clamp): a final-link Bite Pins and the next slot rejects a Bite; at Adult the follow-up Bite lands without a Pin', () => {
  const r = rules({ TECH_LOCKJAW: 'clamp' });
  const w = bout(withTech(TD_WATER, 'Lockjaw', 'wyrmling'), TD_WATER, 4, r);
  run(w, ['bite', 'bite', 'hold'], ['hold', 'hold', 'hold']);
  const ev = run(w, ['bite', 'bite', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(notes(ev).some((n) => n.startsWith('Lockjaw: Pinned next slot; the jaw clamps')), 'the third link Pins');
  assert.ok(notes(ev).some((n) => n.startsWith("Lockjaw: the jaw is still clamped")), 'and the next Bite is refused');
  const a = bout(withTech(TD_WATER, 'Lockjaw', 'adult'), TD_WATER, 4, r);
  const ad = run(a, ['bite', 'bite', 'hold'], ['hold', 'hold', 'hold']);
  assert.equal(hits(ad).length, 2, 'the follow-up Bite lands');
  assert.equal(notes(ad).filter((n) => n.startsWith('Lockjaw: Pinned')).length, 1, 'but only the first Pins');
});

test('Ratchet Claws (escalate): three landed Claws deal +0, +1, +2 from the ratchet; a Bite between resets it', () => {
  const r = rules({ TECH_RATCHET_CLAWS: 'escalate' });
  const ratchet = (h: Extract<Event, { kind: 'hit' }>) => Number(/\+(\d) ratchet/.exec(h.parts.join(' '))?.[1] ?? 0);
  const b = bout(withTech(TD_WATER, 'Ratchet Claws', 'wyrmling'), TD_WATER, 1.5, r);
  assert.deepEqual(hits(run(b, ['claw:left', 'claw:left', 'claw:left'], ['hold', 'hold', 'hold'])).map(ratchet), [0, 1, 2]);
  const reset = bout(withTech(TD_WATER, 'Ratchet Claws', 'wyrmling'), TD_WATER, 1.5, r);
  assert.deepEqual(hits(run(reset, ['claw:left', 'bite', 'claw:left'], ['hold', 'hold', 'hold'])).filter((h) => h.action === 'claw').map(ratchet), [0, 0]);
});

test('Thornscale (window): a Bite into a thorned guard takes 3; the guard closes 3 ticks early', () => {
  const r = rules({ TECH_THORNSCALE: 'window' });
  const b = bout(TD_WATER, withTech(TD_WATER, 'Thornscale', 'wyrmling'), 4, r);
  const ev = run(b, ['bite'], ['scales']);
  assert.ok(notes(ev).some((n) => n.startsWith('Thornscale: takes 3')));
  assert.equal(b.fighters.A.wounds, b.fighters.A.sheet.wounds - 3);
  const plans = slotPlans(run(bout(TD_WATER, withTech(TD_WATER, 'Thornscale', 'wyrmling'), 4, r), ['hold'], ['scales']));
  const base = slotPlans(run(bout(TD_WATER, TD_WATER, 4, r), ['hold'], ['scales']));
  assert.equal(base[0].B.active - plans[0].B.active, 3);
});

test('Mantle Wings (verbguard): a guarded Water jet deals its damage and pushes nothing', () => {
  const r = rules({ TECH_MANTLE_WINGS: 'verbguard' });
  const b = bout(TD_WATER, withTech(TD_WATER, 'Mantle Wings', 'wyrmling'), 4, r);
  const ev = run(b, ['breath'], ['scales']);
  assert.equal(hits(ev).length, 1, 'the jet lands');
  assert.ok(!ev.some((e) => e.kind === 'note' && e.tag === 'push'), 'and pushes nothing');
});

test('Bellows Chest (mobile): a Retreat-charge carries a band and releases with +3; a Bite breaks it and meets no guard', () => {
  const r = rules({ TECH_BELLOWS_CHEST: 'mobile' });
  const b = bout(withTech(TD_FIRE, 'Bellows Chest', 'wyrmling'), TD_WATER, 4, r);
  const ev = run(b, ['charge:breath:retreat', 'breath'], ['hold', 'hold']);
  assert.ok(Math.abs(b.fighters.A.pos.x - b.fighters.B.pos.x) >= 6.5 * R.PACE, 'it retreated a band');
  assert.ok(hits(ev).some((h) => h.action === 'breath' && h.tags.includes('charged')), 'and the release is charged');
  const broken = bout(withTech(TD_FIRE, 'Bellows Chest', 'wyrmling'), TD_WATER, 2, r);
  const bev = run(broken, ['charge:breath:retreat'], ['bite']);
  assert.ok(notes(bev).includes('The hit breaks the charge.'));
  assert.ok(!hits(bev)[0].parts.join(' ').includes('Scales'), 'a moving charge doesn\'t guard');
});

test('Lance Throat (pierce): at Far it pierces 3 Affinity; a Water lance pushes nothing', () => {
  const r = rules({ TECH_LANCE_THROAT: 'pierce' });
  const wyrm: FighterSetup = { name: 'Eel', morph: 'wyrm', stone: 'water' };
  const lanced = hits(run(bout(withTech(TD_WATER, 'Lance Throat', 'wyrmling'), wyrm, 7, r), ['breath'], ['hold']))[0];
  assert.ok(lanced.parts.join(' ').includes('Lance Throat pierces 3'), lanced.parts.join(' '));
  const ev = run(bout(withTech(TD_WATER, 'Lance Throat', 'wyrmling'), TD_WATER, 4, r), ['breath'], ['hold']);
  assert.equal(hits(ev).length, 1);
  assert.ok(!ev.some((e) => e.kind === 'note' && e.tag === 'push'), 'verbless');
});

test('Smoldering Maw (linger): a Fire lane lingers a slot longer; Water verb ground pushes a dragon ending a slot in it', () => {
  const lane = (r: Rules) => {
    const b = bout(withTech(TD_FIRE, 'Smoldering Maw', 'wyrmling'), TD_WATER, 4, r);
    run(b, ['breath'], ['hold']);
    return b.arena.zones.find((z) => z.kind === 'burning')!.lastSlot;
  };
  assert.equal(lane(rules({ TECH_SMOLDERING_MAW: 'linger' })) - lane(rules({})), 1);
  // Breathe in slot 3 so the ground lingers into the next exchange; then stand the target on it (the jet's own push
  // carried it clear).
  const b = bout(withTech(TD_WATER, 'Smoldering Maw', 'juvenile'), TD_FIRE, 4, rules({ TECH_SMOLDERING_MAW: 'linger' }));
  const ev = run(b, ['hold', 'hold', 'breath'], ['hold', 'hold', 'hold']);
  const z = b.arena.zones.find((x) => x.kind === 'smolder')!;
  assert.ok(ev.some((e) => e.kind === 'zone' && e.zone === 'smolder'), 'verb ground forms');
  assert.ok(z.floor && z.center.z === 0, 'on the floor');
  b.fighters.B.pos = { ...z.center, x: z.center.x + R.PACE / 2 };
  const before = { ...b.fighters.B.pos };
  const next = run(b, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(next.some((e) => e.kind === 'zoneEffect' && e.zone === 'smolder'), 'the dragon ending the slot in it feels it');
  assert.ok(Math.abs(b.fighters.B.pos.x - before.x) >= R.PACE - 1, 'and is pushed a pace from the center');
});

test('Ash Gland (cloud): the ash clings through the exchange, then falls as a cloud that hangs for the bout', () => {
  const r = rules({ TECH_ASH_GLAND: 'cloud' });
  // Slot by slot: a Fire breather (its verb doesn't move the target) lands in slot 1.
  const b = bout(withTech(TD_FIRE, 'Ash Gland', 'wyrmling'), TD_WATER, 4, r);
  b.exchange = 1;
  const ev: Event[] = [];
  runSlot(b, 0, { A: parseAction('breath'), B: parseAction('hold') }, ev, false);
  assert.ok(hits(ev)[0].parts.some((p) => p.includes('Ash Gland')), 'the breath keeps its damage, less 3');
  assert.ok(b.fighters.B.marks.ashStuck, 'the ash clings');
  runSlot(b, 1, { A: parseAction('hold'), B: parseAction('retreat') }, ev, false);
  assert.ok(b.fighters.B.status.blinded, 'Blinded in slot 2');
  runSlot(b, 2, { A: parseAction('hold'), B: parseAction('retreat') }, ev, false);
  assert.ok(b.fighters.B.status.blinded, 'and in slot 3, wherever it went');
  assert.ok(!b.arena.zones.some((z) => z.kind === 'ash'), 'no cloud yet');
  // Over a whole exchange: at its end the ash falls where the dragon stands, and hangs.
  const c = bout(withTech(TD_FIRE, 'Ash Gland', 'wyrmling'), TD_WATER, 4, r);
  run(c, ['breath', 'hold', 'hold'], ['hold', 'retreat', 'retreat']);
  const z = c.arena.zones.find((x) => x.kind === 'ash')!;
  assert.ok(z && dist(z.center, c.fighters.B.pos) === 0, 'the cloud falls at the dragon');
  assert.equal(c.fighters.B.marks.ashStuck, null);
  for (let i = 0; i < 3; i++) run(c, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(c.arena.zones.some((x) => x.kind === 'ash'), 'it hangs for the rest of the bout');
  assert.ok(c.fighters.B.pending.blinded, 'and Blinds whoever ends a slot inside');
  // ASH_CLOUD_EXCHANGES bounds it.
  const d = bout(withTech(TD_FIRE, 'Ash Gland', 'wyrmling'), TD_WATER, 4, rules({ TECH_ASH_GLAND: 'cloud', ASH_CLOUD_EXCHANGES: 1 }));
  run(d, ['breath', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  run(d, ['hold', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  assert.ok(!d.arena.zones.some((x) => x.kind === 'ash'), 'one exchange, then it fades');
});

test('Ash Gland (cloud), Juvenile: a breath that misses still clouds where it strikes, a sphere', () => {
  const r = rules({ TECH_ASH_GLAND: 'cloud' });
  const air = bout(withTech(TD_FIRE, 'Ash Gland', 'juvenile'), TD_WATER, 4, r);
  const ground = { ...air.fighters.B.pos };
  air.fighters.B.pos = { ...ground, z: R.PACE };
  ashCloud(air, 'A', ground, 12, []);
  assert.ok(air.fighters.B.pending.blinded, 'a flier a pace above the strike point is caught as it forms');
});

test('Stooping Pinions (nostack): a Dive into a stoop gets no +3; a Dive into a Bite gets +3', () => {
  const r = rules({ TECH_STOOPING_PINIONS: 'nostack' });
  const gale = withTech(WYVERN_WATER, 'Stooping Pinions', 'juvenile');
  const bite = bout(gale, TD_WATER, 3, r);
  bite.fighters.A.pos = { ...bite.fighters.A.pos, z: 3 * R.PACE };
  assert.ok(hits(run(bite, ['dive', 'bite'], ['hold', 'hold']))[0].parts.includes('+3 Stooping Pinions'));
  // Dive from two bands to one, then stoop next exchange (aloft since it began): no +3 on the stoop.
  const stoop = bout(gale, TD_WATER, 4, r);
  stoop.fighters.A.pos = { ...stoop.fighters.A.pos, z: 2 * R.BAND };
  run(stoop, ['leap', 'hold', 'dive'], ['hold', 'hold', 'hold']);
  const ev = run(stoop, ['claw:left', 'hold', 'hold'], ['hold', 'hold', 'hold']);
  const h = hits(ev).find((x) => x.tags.includes('stoop'));
  if (h) assert.ok(!h.parts.includes('+3 Stooping Pinions'));
});

test('Sapping Bellow (gland, provisional): a landed Breath demoralizes', () => {
  const b = bout(withTech(TD_WATER, 'Sapping Bellow', 'wyrmling'), TD_FIRE, 4, rules({ TECH_SAPPING_BELLOW: 'gland' }));
  const ev = run(b, ['breath'], ['hold']);
  assert.ok(notes(ev).some((n) => n.startsWith('Sapping Bellow: the breath demoralizes')));
  assert.ok(b.fighters.B.marks.demoralized);
});

test('Baleful Eye is cut, and Ash Gland returns only as the cloud', async () => {
  const { shardPool, setPoolRules } = await import('../src/shards.ts');
  assert.ok(!shardPool('wyrmling').some((s) => s.name === 'Baleful Eye'));
  assert.ok(shardPool('wyrmling').some((s) => s.name === 'Ash Gland'), 'suite v0.3 seats the cloud');
  setPoolRules(rules({}));
  assert.ok(!shardPool('wyrmling').some((s) => s.name === 'Ash Gland'), 'pulled under v0.2');
  setPoolRules(R.DEFAULT_RULES);
});
