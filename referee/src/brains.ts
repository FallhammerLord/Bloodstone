// The brain tournament: does thinking beat habit, do the styles form a triangle, and how do the
// pairings fare when both sides think?
//   npm run brains [-- --skill novice|adept|master]

import { Worker } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { STYLES } from './ai.ts';
import { BRAIN_STYLES, SKILLS, type BrainStyle, type Skill } from './brain.ts';
import type { CoreStone, Morph } from './hatch.ts';
import { seededRandom } from './random.ts';
import type { FighterSetup, Side } from './referee.ts';
import type { Job, Player, Result } from './brains-worker.ts';

const argv = process.argv.slice(2);
const skillArg = argv.indexOf('--skill');
const skill = (skillArg >= 0 ? argv[skillArg + 1] : 'adept') as Skill;
if (!SKILLS.includes(skill)) throw new Error(`Skill is one of ${SKILLS.join(', ')}.`);

const MORPHS: Morph[] = ['true-dragon', 'wyvern', 'wyrm'];
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
const NAMES: Record<Morph, string> = { 'true-dragon': 'True Dragon', wyvern: 'Wyvern', wyrm: 'Wyrm' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const pairings: { label: string; setup: FighterSetup }[] = MORPHS.flatMap((m) =>
  STONES.map((s) => ({ label: `${NAMES[m]} + ${cap(s)}`, setup: { name: `${m}-${s}`, morph: m, stone: s } })),
);

const rng = seededRandom(2026);
// The general styles; the focus brains (claw, bite, breath only) join the style matrix.
const GENERAL = BRAIN_STYLES.filter((x) => !x.endsWith('-focus'));
const jobs: Job[] = [];
const brain = (style: string, seed: number): Player => ({ kind: 'brain', style, skill, seed });
const crude = (style: string, seed: number): Player => ({ kind: 'crude', style, skill, seed });
const add = (group: string, A: FighterSetup, B: FighterSetup, playerA: Player, playerB: Player, challenged?: Side) =>
  jobs.push({ id: jobs.length, group, A, B, playerA, playerB, challenged: challenged ?? (jobs.length % 2 ? 'A' : 'B'), arenaSeed: jobs.length * 31 + 7 });

// 1. Thinking against habit: a balanced brain against each crude style, every pairing against every other.
for (const a of pairings) for (const b of pairings) {
  if (a === b) continue;
  const n = jobs.length;
  if (n % 2) add('crude', a.setup, b.setup, brain('boxer-puncher', n), crude(STYLES[n % 4], n + 1));
  else add('crude', a.setup, b.setup, crude(STYLES[n % 4], n), brain('boxer-puncher', n + 1));
}
// 2. Style against style, on identical dragons so only the style differs.
for (const sa of BRAIN_STYLES) for (const sb of BRAIN_STYLES) {
  if (sa === sb) continue;
  for (let i = 0; i < 12; i++) {
    const p = pairings[Math.floor(rng() * pairings.length)].setup;
    add(`style|${sa}|${sb}`, p, p, brain(sa, jobs.length), brain(sb, jobs.length + 1), i % 2 ? 'A' : 'B');
  }
}
// 3. Pairings when both sides think, with random styles.
for (const a of pairings) for (const b of pairings) {
  if (a === b) continue;
  for (let i = 0; i < 3; i++) {
    const s1 = GENERAL[Math.floor(rng() * GENERAL.length)];
    const s2 = GENERAL[Math.floor(rng() * GENERAL.length)];
    add(`pair|${a.label}|${b.label}`, a.setup, b.setup, brain(s1, jobs.length), brain(s2, jobs.length + 1));
  }
}

// 4. Crunchlings: identical dragons, one carrying Raking Talons (Juvenile), the other nothing.
for (const p of pairings) {
  for (let i = 0; i < 12; i++) {
    const crunchling: FighterSetup = { ...p.setup, shards: [{ shard: 'Raking Talons', grade: 'juvenile', pips: [0] }] };
    const s1 = GENERAL[Math.floor(rng() * GENERAL.length)];
    const s2 = GENERAL[Math.floor(rng() * GENERAL.length)];
    // The crunchling sits on each side equally, and is the challenged dragon half the time (timeouts go to the challenged).
    const challenged: Side = i % 4 < 2 ? 'A' : 'B';
    if (i % 2) add('crunch|A', crunchling, p.setup, brain(s1, jobs.length), brain(s2, jobs.length + 1), challenged);
    else add('crunch|B', p.setup, crunchling, brain(s1, jobs.length), brain(s2, jobs.length + 1), challenged);
  }
}

const workers = Math.max(1, Math.min(availableParallelism(), 8));
const t0 = Date.now();
const chunks: Job[][] = Array.from({ length: workers }, () => []);
jobs.forEach((j, i) => chunks[i % workers].push(j));
const results: Result[] = (await Promise.all(chunks.map((chunk) => new Promise<Result[]>((resolve, reject) => {
  const w = new Worker(new URL('./brains-worker.ts', import.meta.url), { workerData: { jobs: chunk }, execArgv: process.execArgv });
  w.once('message', resolve);
  w.once('error', reject);
})))).flat();
const byId = new Map(results.map((r) => [r.id, r]));

const pct = (w: number, n: number) => `${((100 * w) / Math.max(1, n)).toFixed(0).padStart(3)}%`;
console.log(`Brain tournament at ${skill} skill: ${jobs.length} bouts in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${workers} workers.`);
const ends = { ko: 0, pulse: 0, timeout: 0 };
let ex = 0;
for (const r of results) {
  ends[r.ending]++;
  ex += r.exchanges;
}
console.log(`Endings: ${ends.ko} KO, ${ends.pulse} rim-pulse KO, ${ends.timeout} timeout. Average ${(ex / results.length).toFixed(1)} exchanges per bout.`);
const st = results.reduce((a, r) => a.map((v, i) => v + r.stats[i]), [0, 0, 0, 0, 0, 0, 0, 0]);
console.log(`Breath lands ${pct(st[1], st[0])} of the time and deals ${pct(st[2], st[3])} of all damage. Scales is chosen in ${pct(st[4], st[5])} of slots; charges in ${pct(st[6], st[5])}.`);
const byAttack: Record<string, [number, number, number]> = {};
for (const r of results) for (const [k, v] of Object.entries(r.byAttack)) {
  const t = (byAttack[k] ??= [0, 0, 0]);
  for (let i = 0; i < 3; i++) t[i] += v[i];
}
console.log(`Damage by attack: ${['breath', 'bite', 'claw', 'stomp'].map((k) => {
  const [aimed, landed, dmg] = byAttack[k] ?? [0, 0, 0];
  return `${k} ${pct(dmg, st[3])} (lands ${pct(landed, aimed)})`;
}).join(', ')}.`);
const actionSlots: Record<string, number> = {};
const outcomeCounts: Record<string, number> = {};
for (const r of results) {
  for (const [k, v] of Object.entries(r.actions)) actionSlots[k] = (actionSlots[k] ?? 0) + v;
  for (const [k, v] of Object.entries(r.outcomes)) outcomeCounts[k] = (outcomeCounts[k] ?? 0) + v;
}
const totalSlots = Object.values(actionSlots).reduce((a, b) => a + b, 0);
console.log(`Every action, share of all slots: ${Object.entries(actionSlots).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${pct(v, totalSlots).trim()}`).join(', ')}.`);
console.log(`What came of them, per bout: ${Object.entries(outcomeCounts).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(v / results.length).toFixed(2)}`).join(', ')}.`);
const setup = results.reduce((a, r) => a.map((v, i) => v + r.setup[i]), [0, 0, 0, 0]);
console.log(`Bites right after an Approach: ${pct(setup[0], setup[1])} of ${setup[1]} Bites. Claws right after a Strafe: ${pct(setup[2], setup[3])} of ${setup[3]} Claws.`);

// 1.
const crudeJobs = jobs.filter((j) => j.group === 'crude');
const brainWins = crudeJobs.filter((j) => {
  const r = byId.get(j.id)!;
  return (j.playerA.kind === 'brain' && r.winner === 'A') || (j.playerB.kind === 'brain' && r.winner === 'B');
}).length;
console.log(`\n── Thinking against habit ──\n  A boxer-puncher brain beats the crude AIs ${pct(brainWins, crudeJobs.length)} of ${crudeJobs.length} bouts.`);
for (const st of STYLES) {
  const js = crudeJobs.filter((j) => (j.playerA.kind === 'crude' ? j.playerA.style : j.playerB.style) === st);
  const w = js.filter((j) => {
    const r = byId.get(j.id)!;
    return (j.playerA.kind === 'brain' && r.winner === 'A') || (j.playerB.kind === 'brain' && r.winner === 'B');
  }).length;
  console.log(`    against ${st.padEnd(10)} ${pct(w, js.length)}`);
}

// 2.
const styleWins = new Map<string, { w: number; n: number }>();
for (const j of jobs.filter((x) => x.group.startsWith('style|'))) {
  const [, sa, sb] = j.group.split('|');
  const r = byId.get(j.id)!;
  for (const [x, y, won] of [[sa, sb, r.winner === 'A'], [sb, sa, r.winner === 'B']] as const) {
    const k = `${x}|${y}`;
    const t = styleWins.get(k) ?? { w: 0, n: 0 };
    t.n++;
    if (won) t.w++;
    styleWins.set(k, t);
  }
}
const rate = (x: string, y: string) => {
  const t = styleWins.get(`${x}|${y}`)!;
  return (100 * t.w) / t.n;
};
console.log('\n── Style against style (identical dragons; row\'s win rate against column) ──');
const short: Record<BrainStyle, string> = { swarmer: 'swarm', 'out-boxer': 'outbx', slugger: 'slug', counterpuncher: 'count', 'boxer-puncher': 'boxpn', aerialist: 'aeria', reader: 'readr', 'claw-focus': 'claw', 'bite-focus': 'bite', 'breath-focus': 'brth' };
console.log(`  ${''.padEnd(15)}${BRAIN_STYLES.map((s) => short[s].padStart(6)).join('')}`);
for (const a of BRAIN_STYLES) {
  console.log(`  ${a.padEnd(15)}${BRAIN_STYLES.map((b) => (a === b ? '     ·' : `${rate(a, b).toFixed(0).padStart(5)}%`)).join('')}`);
}
console.log('\n  Overall:');
const overallStyle = BRAIN_STYLES.map((a) => {
  let w = 0;
  let n = 0;
  for (const b of BRAIN_STYLES) {
    if (a === b) continue;
    const t = styleWins.get(`${a}|${b}`)!;
    w += t.w;
    n += t.n;
  }
  return { a, p: (100 * w) / n };
}).sort((x, y) => y.p - x.p);
for (const { a, p } of overallStyle) console.log(`    ${p.toFixed(0).padStart(3)}%  ${a}`);
console.log('\n  Focus brains (one attack only), against the general styles and each other:');
for (const f of BRAIN_STYLES.filter((x) => x.endsWith('-focus'))) {
  const vs = (group: readonly BrainStyle[]) => {
    let w = 0;
    let n = 0;
    for (const o of group) {
      if (o === f) continue;
      const t = styleWins.get(`${f}|${o}`)!;
      w += t.w;
      n += t.n;
    }
    return pct(w, n);
  };
  console.log(`    ${f.padEnd(13)} vs general ${vs(GENERAL)}   vs focus ${vs(BRAIN_STYLES.filter((x) => x.endsWith('-focus')))}`);
}
console.log('\n  The boxing triangle (swarmer > out-boxer > slugger > swarmer):');
for (const [x, y] of [['swarmer', 'out-boxer'], ['out-boxer', 'slugger'], ['slugger', 'swarmer']]) {
  const p = (rate(x, y) + (100 - rate(y, x))) / 2;
  console.log(`    ${x} over ${y}: ${p.toFixed(0)}% ${p > 55 ? '✓' : p < 45 ? '✗ reversed' : '~ even'}`);
}

// 3.
const pairWins = new Map<string, { w: number; n: number }>();
for (const j of jobs.filter((x) => x.group.startsWith('pair|'))) {
  const [, la, lb] = j.group.split('|');
  const r = byId.get(j.id)!;
  for (const [k, won] of [[la, r.winner === 'A'], [lb, r.winner === 'B']] as const) {
    const t = pairWins.get(k) ?? { w: 0, n: 0 };
    t.n++;
    if (won) t.w++;
    pairWins.set(k, t);
  }
}
console.log('\n── Pairings when both sides think ──');
for (const [k, t] of [...pairWins.entries()].sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n)) {
  console.log(`  ${pct(t.w, t.n)}  ${k.padEnd(20)} ${'█'.repeat(Math.round((25 * t.w) / t.n))}`);
}
const group = (f: (label: string) => string) => {
  const m = new Map<string, { w: number; n: number }>();
  for (const [k, t] of pairWins) {
    const g = m.get(f(k)) ?? { w: 0, n: 0 };
    g.w += t.w;
    g.n += t.n;
    m.set(f(k), g);
  }
  return [...m.entries()].sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n);
};
console.log('\n  By morph:');
for (const [k, t] of group((l) => l.split(' + ')[0])) console.log(`    ${pct(t.w, t.n)}  ${k}`);
console.log('  By stone:');
for (const [k, t] of group((l) => l.split(' + ')[1])) console.log(`    ${pct(t.w, t.n)}  ${k}`);
// Per stone, in the pairing bouts: how often each attack lands, what a landed hit is worth, and what the stone takes.
const stones: Record<string, Record<string, [number, number, number]>> = {};
for (const j of jobs.filter((x) => x.group.startsWith('pair|'))) {
  for (const [st, attacks] of Object.entries(byId.get(j.id)!.byStone)) {
    for (const [a, v] of Object.entries(attacks)) {
      const t = ((stones[st] ??= {})[a] ??= [0, 0, 0]);
      for (let i = 0; i < 3; i++) t[i] += v[i];
    }
  }
}
const cell = (v?: [number, number, number]) => (v && v[0] ? `${pct(v[1], v[0])} ×${(v[1] ? v[2] / v[1] : 0).toFixed(1)}` : '    —     ');
console.log('  Accuracy by stone (lands, then average damage per landed hit):');
console.log(`    ${'stone'.padEnd(6)} ${'breath'.padEnd(11)} ${'bite'.padEnd(11)} ${'claw'.padEnd(11)} │ taken: ${'breath'.padEnd(11)} ${'bite'.padEnd(11)} claw`);
for (const st of Object.keys(stones).sort()) {
  const s = stones[st];
  console.log(`    ${st.padEnd(6)} ${cell(s.breath)} ${cell(s.bite)} ${cell(s.claw)} │        ${cell(s['taken-breath'])} ${cell(s['taken-bite'])} ${cell(s['taken-claw'])}`);
}

// 4.
const crunchJobs = jobs.filter((j) => j.group.startsWith('crunch|'));
let cw = 0;
let cDealt = 0;
let pDealt = 0;
let crunchSlots = 0;
let slots = 0;
for (const j of crunchJobs) {
  const r = byId.get(j.id)!;
  const side = j.group.split('|')[1] as Side;
  const plain: Side = side === 'A' ? 'B' : 'A';
  if (r.winner === side) cw++;
  cDealt += r.dealt[side];
  pDealt += r.dealt[plain];
  crunchSlots += r.stats[7];
  slots += r.stats[5] / 2;
}
console.log('\n── Crunchlings (Raking Talons, Juvenile) against identical plain dragons ──');
console.log(`  The crunchling wins ${pct(cw, crunchJobs.length)} of ${crunchJobs.length} bouts and crunches in ${pct(crunchSlots, slots)} of its slots.`);
console.log(`  Damage dealt per bout: crunchling ${(cDealt / crunchJobs.length).toFixed(1)}, plain ${(pDealt / crunchJobs.length).toFixed(1)}.`);
