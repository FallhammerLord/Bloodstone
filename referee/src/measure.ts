// Measures what drafting brains need to know, so they draft on results, not vibes:
//   sheets: each style's win rate on each of the 12 hatched sheets, against the field (random general styles and sheets);
//   shards: each style's win-rate change from each wyrmling-grade shard, in paired bouts (the same bout with the shard
//           and without it: same opponent, arena and seeds), on random sheets.
// Each cell is shrunk toward its row's pooled value (a sheet's rate across styles, a shard's change across styles), so
// a style's own number only moves the estimate as far as its sample supports. Writes src/brain/measured.json.
//   npm run measure [-- --skill adept] [--n 24] [--seed N] [--rule KEY=VALUE ...] [--out file]
// Rerun after any rules patch: the table is the brains' knowledge of what wins.

import { writeFileSync } from 'node:fs';
import { BRAIN_STYLES, type BrainStyle, type Skill } from './brain.ts';
import type { Job, Result } from './brains-worker.ts';
import { flag, inWorkers, rulesFromArgs, WORKERS } from './harness.ts';
import type { CoreStone, Morph } from './hatch.ts';
import { seededRandom } from './random.ts';
import type { FighterSetup } from './referee.ts';
import { setPoolRules, shardPool } from './shards.ts';

const argv = process.argv.slice(2);
const skill = flag(argv, '--skill', 'adept') as Skill;
const N = Number(flag(argv, '--n', '24'));
const seed = Number(flag(argv, '--seed', '2026'));
const { rules: runRules, overrides, label: rulesLabel } = rulesFromArgs(argv);
setPoolRules(runRules);
const outFile = flag(argv, '--out', '');
const SHEET_TRUST = 12;
const SHARD_TRUST = 24;

const MORPHS: Morph[] = ['true-dragon', 'wyvern', 'wyrm'];
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
const SHEETS = MORPHS.flatMap((morph) => STONES.map((stone) => ({ morph, stone, key: `${morph} + ${stone}` })));
const GENERAL = BRAIN_STYLES.filter((s) => !s.endsWith('-focus'));
const shards = shardPool('wyrmling');
const rng = seededRandom(seed);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];

const jobs: Job[] = [];
const meta: { kind: 'sheet' | 'with' | 'without'; style: BrainStyle; key: string; pair: number; morph?: Morph }[] = [];
const add = (kind: 'sheet' | 'with' | 'without', style: BrainStyle, key: string, A: FighterSetup, B: FighterSetup, opp: string, s: number, pair: number, morph?: Morph) => {
  const id = jobs.length;
  jobs.push({ id, group: 'measure', A, B, playerA: { kind: 'brain', style, skill, seed: s }, playerB: { kind: 'brain', style: opp, skill, seed: s + 1 },
    challenged: s % 2 ? 'A' : 'B', arenaSeed: s * 31 + 7 });
  meta.push({ kind, style, key, pair, morph });
};
let s = seed * 1000;
for (const style of BRAIN_STYLES) {
  for (const sh of SHEETS) {
    for (let i = 0; i < N; i++) {
      const o = pick(SHEETS);
      add('sheet', style, sh.key, { name: style, morph: sh.morph, stone: sh.stone }, { name: 'field', morph: o.morph, stone: o.stone }, pick(GENERAL), (s += 2), 0);
    }
  }
  for (const shard of shards) {
    for (let i = 0; i < N; i++) {
      const me = pick(SHEETS), o = pick(SHEETS), opp = pick(GENERAL);
      s += 2;
      const base = { name: style, morph: me.morph, stone: me.stone };
      const B = { name: 'field', morph: o.morph, stone: o.stone };
      add('with', style, shard.name, { ...base, shards: [{ shard: shard.name, grade: shard.grade, pips: Array.from({ length: shard.pips }, (_, k) => k) }] }, B, opp, s, i, me.morph);
      add('without', style, shard.name, base, B, opp, s, i, me.morph);
    }
  }
}

const t0 = Date.now();
const results: Result[] = (await inWorkers<Result[]>(new URL('./brains-worker.ts', import.meta.url), { jobs, overrides })).flat();
const won = new Map(results.map((r) => [r.id, r.winner === 'A']));

type Cell = { w: number; n: number };
const sheetCells = new Map<string, Cell>();
const shardCells = new Map<string, Cell>(); // w = sum of (with − without) over pairs
const morphCells = new Map<string, Cell>(); // the same, by the carrier's morph
for (const [id, m] of meta.entries()) {
  const k = `${m.style}|${m.key}`;
  const win = won.get(id) ? 1 : 0;
  if (m.kind === 'sheet') {
    const c = sheetCells.get(k) ?? { w: 0, n: 0 };
    c.w += win;
    c.n++;
    sheetCells.set(k, c);
  } else {
    for (const key of [k, `morph:${m.morph}|${m.key}`]) {
      const c = (key === k ? shardCells : morphCells).get(key) ?? { w: 0, n: 0 };
      c.w += m.kind === 'with' ? win : -win;
      if (m.kind === 'with') c.n++;
      (key === k ? shardCells : morphCells).set(key, c);
    }
  }
}
const pooled = (cells: Map<string, Cell>, key: string) => {
  let w = 0, n = 0;
  for (const [k, c] of cells) if (k.endsWith(`|${key}`)) { w += c.w; n += c.n; }
  return n ? w / n : 0;
};
const round = (x: number) => Math.round(x * 1000) / 1000;
const sheets: Record<string, Record<string, number>> = {};
const shardTable: Record<string, Record<string, number>> = {};
for (const style of BRAIN_STYLES) {
  sheets[style] = {};
  shardTable[style] = {};
  for (const sh of SHEETS) {
    const c = sheetCells.get(`${style}|${sh.key}`)!;
    sheets[style][sh.key] = round((c.w + SHEET_TRUST * pooled(sheetCells, sh.key)) / (c.n + SHEET_TRUST));
  }
  for (const shard of shards) {
    const c = shardCells.get(`${style}|${shard.name}`)!;
    shardTable[style][shard.name] = round((c.w + SHARD_TRUST * pooled(shardCells, shard.name)) / (c.n + SHARD_TRUST));
  }
}
// --out writes elsewhere (a comparison run), leaving the brains' table alone.
const out = outFile ? new URL(outFile, `file://${process.cwd()}/`) : new URL('./brain/measured.json', import.meta.url);
writeFileSync(out, JSON.stringify({ skill, n: N, seed, rules: rulesLabel, bouts: jobs.length, sheets, shards: shardTable,
  pooled: { sheets: Object.fromEntries(SHEETS.map((x) => [x.key, round(pooled(sheetCells, x.key))])), shards: Object.fromEntries(shards.map((x) => [x.name, round(pooled(shardCells, x.name))])) } }, null, 1) + '\n');

console.log(`Measured ${jobs.length} bouts at ${skill} skill, ${rulesLabel}, in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${WORKERS} workers.`);
console.log('\nSheets, pooled across styles (win rate against the field):');
for (const x of [...SHEETS].sort((a, b) => pooled(sheetCells, b.key) - pooled(sheetCells, a.key))) console.log(`  ${(100 * pooled(sheetCells, x.key)).toFixed(0).padStart(3)}%  ${x.key}`);
console.log('\nShards, pooled across styles (change in win rate from carrying it):');
for (const x of [...shards].sort((a, b) => pooled(shardCells, b.name) - pooled(shardCells, a.name))) console.log(`  ${(100 * pooled(shardCells, x.name)).toFixed(0).padStart(4)} pts  ${x.name}`);
console.log('\nShards by the carrier\'s morph (change in win rate; True Dragon / Wyvern / Wyrm):');
for (const x of shards) {
  const byMorph = (['true-dragon', 'wyvern', 'wyrm'] as Morph[]).map((m) => { const c = morphCells.get(`morph:${m}|${x.name}`); return c && c.n ? `${(100 * c.w / c.n).toFixed(0).padStart(4)}` : '   —'; });
  console.log(`  ${x.name.padEnd(20)} ${byMorph.join(' / ')}`);
}
console.log('\nEach style\'s best sheet and best shard:');
for (const style of BRAIN_STYLES) {
  const bs = Object.entries(sheets[style]).sort((a, b) => b[1] - a[1])[0];
  const bd = Object.entries(shardTable[style]).sort((a, b) => b[1] - a[1])[0];
  console.log(`  ${style.padEnd(15)} ${bs[0].padEnd(20)} ${(100 * bs[1]).toFixed(0)}%   ${bd[0]} ${(100 * bd[1]).toFixed(0).padStart(3)} pts`);
}
console.log(`\nWrote ${out.pathname}.`);
