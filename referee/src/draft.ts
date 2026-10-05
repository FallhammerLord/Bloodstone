// The hatch tournament: every brain drafts its own egg, bloodstone and wyrmling-grade shards by its playstyle, then
// fights every other style. It answers what each style builds, and how those builds fare: the meta, not the balance.
//   npm run draft [-- --skill novice|adept|master] [--bouts N] [--seed N] [--json file]
// Ladders: novices draft no shards, adepts one pip's worth, masters a full three-pip array. Bouts stay within a ladder.

import { writeFileSync } from 'node:fs';
import { BRAIN_STYLES, type BrainStyle, type Skill } from './brain.ts';
import { draftDragon, LADDER_PIPS, Picks } from './brain/hatchery.ts';
import type { Job, Player, Result } from './brains-worker.ts';
import { flag, inWorkers, rateWithMargin, WORKERS } from './harness.ts';
import { seededRandom } from './random.ts';
import type { FighterSetup, Side } from './referee.ts';

const argv = process.argv.slice(2);
const skill = flag(argv, '--skill', 'master') as Skill;
const bouts = Number(flag(argv, '--bouts', '16'));
const seed = Number(flag(argv, '--seed', '2026'));
const jsonFile = flag(argv, '--json', '');


const draftRng = seededRandom(seed * 7 + 3);
const picks = new Picks();
const jobs: Job[] = [];
for (const sa of BRAIN_STYLES) for (const sb of BRAIN_STYLES) {
  if (sa === sb) continue;
  for (let i = 0; i < bouts; i++) {
    const id = jobs.length;
    const A = draftDragon(sa, skill, draftRng, picks, sa);
    const B = draftDragon(sb, skill, draftRng, picks, sb);
    const player = (style: BrainStyle, s: number): Player => ({ kind: 'brain', style, skill, seed: s });
    jobs.push({ id, group: `draft|${sa}|${sb}`, A, B, playerA: player(sa, id * 2 + seed), playerB: player(sb, id * 2 + 1 + seed), challenged: i % 2 ? 'A' : 'B', arenaSeed: id * 31 + 7 + seed });
  }
}


const t0 = Date.now();
const results: Result[] = (await inWorkers<Result[]>(new URL('./brains-worker.ts', import.meta.url), { jobs })).flat();
const byId = new Map(results.map((r) => [r.id, r]));

type Rate = { w: number; n: number };
const tally = (m: Map<string, Rate>, k: string, won: boolean) => {
  const t = m.get(k) ?? { w: 0, n: 0 };
  t.n++;
  if (won) t.w++;
  m.set(k, t);
};
const styleRates = new Map<string, Rate>();
const pairingRates = new Map<string, Rate>();
const morphRates = new Map<string, Rate>();
const stoneRates = new Map<string, Rate>();
const shardRates = new Map<string, Rate>();
const styleBuilds = new Map<string, Map<string, number>>();
const styleShards = new Map<string, Map<string, number>>();
const bump = (m: Map<string, Map<string, number>>, style: string, k: string) => {
  const inner = m.get(style) ?? new Map<string, number>();
  inner.set(k, (inner.get(k) ?? 0) + 1);
  m.set(style, inner);
};
const loadoutRates = new Map<string, Rate>();
const loadoutWins = new Map<string, Map<string, Rate>>();
const ends = { ko: 0, pulse: 0, timeout: 0 };
for (const j of jobs) {
  const r = byId.get(j.id)!;
  ends[r.ending]++;
  for (const [setup, side, style] of [[j.A, 'A', j.playerA.style], [j.B, 'B', j.playerB.style]] as [FighterSetup, Side, string][]) {
    const won = r.winner === side;
    const pairing = `${setup.morph} + ${setup.stone}`;
    tally(styleRates, style, won);
    tally(pairingRates, pairing, won);
    tally(morphRates, setup.morph, won);
    tally(stoneRates, setup.stone, won);
    bump(styleBuilds, style, pairing);
    const loadout = `${style} · ${pairing} · ${(setup.shards ?? []).map((s) => s.shard).sort().join(', ') || 'no shards'}`;
    tally(loadoutRates, loadout, won);
    const against = loadoutWins.get(loadout) ?? new Map<string, Rate>();
    tally(against, style === j.playerA.style ? j.playerB.style : j.playerA.style, won);
    loadoutWins.set(loadout, against);
    for (const s of setup.shards ?? []) {
      tally(shardRates, s.shard, won);
      bump(styleShards, style, s.shard);
    }
  }
}
const sorted = (m: Map<string, Rate>) => [...m.entries()].sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
/** The effective number of builds a style uses: e^entropy of its picks. 1 means one build always. */
const spread = (m: Map<string, number>) => {
  const n = [...m.values()].reduce((a, b) => a + b, 0);
  return Math.exp(-[...m.values()].reduce((a, c) => a + (c / n) * Math.log(c / n), 0));
};
const top = (m: Map<string, number>, k: number) => {
  const n = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([x, c]) => `${x} ${((100 * c) / n).toFixed(0)}%`).join(', ');
};

console.log(`Hatch tournament at ${skill} skill (${LADDER_PIPS[skill]} pips of wyrmling-grade shards each): ${jobs.length} bouts in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${WORKERS} workers.`);
console.log('Every brain drafted its egg, bloodstone and shards by its playstyle. Win rates carry a 95% margin (±).');
console.log(`Endings: ${(100 * ends.ko / jobs.length).toFixed(0)}% KO, ${(100 * ends.pulse / jobs.length).toFixed(0)}% rim pulse, ${(100 * ends.timeout / jobs.length).toFixed(0)}% timeout.`);
console.log('\n── Styles: win rate, and what they hatched (spread = effective number of builds) ──');
for (const [style, t] of sorted(styleRates)) {
  console.log(`  ${rateWithMargin(t.w, t.n)}  ${style.padEnd(15)} spread ${spread(styleBuilds.get(style)!).toFixed(1)}  ${top(styleBuilds.get(style)!, 3)}`);
  if (styleShards.get(style)) console.log(`  ${''.padEnd(25)}shards: ${top(styleShards.get(style)!, 4)}`);
}
const pickRate = (m: Map<string, Rate>, k: string) => (100 * (m.get(k)?.n ?? 0)) / (2 * jobs.length);
console.log('\n── Hatched builds: how often drafted, and win rate when drafted ──');
for (const [k, t] of sorted(pairingRates)) console.log(`  ${rateWithMargin(t.w, t.n)}  ${k.padEnd(20)} drafted ${pickRate(pairingRates, k).toFixed(0)}%`);
console.log('\n  By morph:');
for (const [k, t] of sorted(morphRates)) console.log(`    ${rateWithMargin(t.w, t.n)}  ${k.padEnd(12)} drafted ${pickRate(morphRates, k).toFixed(0)}%`);
console.log('  By stone:');
for (const [k, t] of sorted(stoneRates)) console.log(`    ${rateWithMargin(t.w, t.n)}  ${k.padEnd(12)} drafted ${pickRate(stoneRates, k).toFixed(0)}%`);
if (shardRates.size) {
  console.log('\n── Shards: how often drafted (share of dragons), and win rate when drafted (30+ dragons) ──');
  for (const [k, t] of sorted(shardRates).filter(([, t]) => t.n >= 30)) console.log(`  ${rateWithMargin(t.w, t.n)}  ${k.padEnd(20)} on ${pickRate(shardRates, k).toFixed(0)}% of dragons`);
}

/** Wilson lower bound at 95%: ranks a 7–1 record below a 30–6 one. */
const wilson = (t: Rate) => {
  const z = 1.96, p = t.w / t.n;
  return (p + z * z / (2 * t.n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * t.n)) / t.n)) / (1 + z * z / t.n);
};
const champions = [...loadoutRates.entries()].filter(([, t]) => t.n >= 6).sort((a, b) => wilson(b[1]) - wilson(a[1]));
console.log('\n── Champions: whole drafted dragons (style · build · shards), 6+ bouts, ranked by the low end of their 95% range ──');
for (const [k, t] of champions.slice(0, 15)) {
  const lost = [...loadoutWins.get(k)!.entries()].filter(([, r]) => r.w < r.n).sort((a, b) => (b[1].n - b[1].w) - (a[1].n - a[1].w)).slice(0, 3).map(([s, r]) => `${s} ${r.n - r.w}`).join(', ');
  console.log(`  ${String(t.w).padStart(2)}–${String(t.n - t.w).padEnd(2)} ${rateWithMargin(t.w, t.n)}  ${k}${lost ? `   lost to: ${lost}` : ''}`);
}
console.log('\n  Each style\'s champion:');
for (const style of BRAIN_STYLES) {
  const best = champions.find(([k]) => k.startsWith(`${style} ·`));
  if (best) console.log(`    ${String(best[1].w).padStart(2)}–${String(best[1].n - best[1].w).padEnd(2)} ${rateWithMargin(best[1].w, best[1].n)}  ${best[0]}`);
}

if (jsonFile) {
  const obj = (m: Map<string, Rate>) => Object.fromEntries(m);
  writeFileSync(jsonFile, JSON.stringify({
    skill, seed, bouts: jobs.length, endings: ends,
    styles: obj(styleRates), pairings: obj(pairingRates), morphs: obj(morphRates), stones: obj(stoneRates), shards: obj(shardRates),
    builds: Object.fromEntries([...styleBuilds].map(([s, m]) => [s, Object.fromEntries(m)])),
    loadouts: obj(loadoutRates),
    shardPicks: Object.fromEntries([...styleShards].map(([s, m]) => [s, Object.fromEntries(m)])),
  }, null, 1) + '\n');
  console.log(`\nWrote ${jsonFile}.`);
}
