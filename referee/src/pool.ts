// Pools several brain tournaments (their --json files) into one report, so independent seeds tighten the margins.
//   npm run pool -- run1.json run2.json run3.json

import { readFileSync } from 'node:fs';
import { rateWithMargin } from './harness.ts';

type Rate = { w: number; n: number };
const runs = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
if (!runs.length) {
  console.error('Usage: npm run pool -- run1.json run2.json ...');
  process.exit(1);
}
const add = (key: string) => {
  const out: Record<string, Rate> = {};
  for (const r of runs) for (const [k, v] of Object.entries(r[key] as Record<string, Rate>)) {
    const t = (out[k] ??= { w: 0, n: 0 });
    t.w += v.w;
    t.n += v.n;
  }
  return Object.entries(out).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n);
};
const bouts = runs.reduce((a, r) => a + r.bouts, 0);
const ends = runs.reduce((a, r) => ({ ko: a.ko + r.endings.ko, pulse: a.pulse + r.endings.pulse, timeout: a.timeout + r.endings.timeout }), { ko: 0, pulse: 0, timeout: 0 });
console.log(`${runs.length} tournaments pooled (${runs.map((r) => `${r.skill} seed ${r.seed ?? 2026}, ${r.rules}`).join('; ')}): ${bouts} bouts.`);
console.log(`Endings: ${(100 * ends.ko / bouts).toFixed(0)}% KO, ${(100 * ends.pulse / bouts).toFixed(0)}% rim pulse, ${(100 * ends.timeout / bouts).toFixed(0)}% timeout.`);
for (const [title, key] of [['Morphs', 'morphs'], ['Stones', 'stones'], ['Pairings', 'pairings'], ['Styles (identical dragons)', 'styles']] as const) {
  console.log(`\n${title}:`);
  for (const [k, t] of add(key)) console.log(`  ${rateWithMargin(t.w, t.n)}  ${k}`);
}
const crunch = runs.reduce((a, r) => ({ w: a.w + r.crunchling.w, n: a.n + r.crunchling.n }), { w: 0, n: 0 });
console.log(`\nCrunchling against a plain twin: ${rateWithMargin(crunch.w, crunch.n).trim()}.`);
