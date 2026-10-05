// How chosen pairings fare against the field, and why: win rate, damage dealt and taken by source, Breath accuracy.
//   npm run diag:pairing -- [--morph true-dragon] [--stone fire] [--bouts 40] [--skill master] [--rule KEY=VALUE ...]
// Without filters it takes every pairing. Each faces every other pairing --bouts times, with random general styles.

import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { Skill } from '../brain.ts';
import { flag, inWorkers, rateWithMargin, rulesFromArgs } from '../harness.ts';
import { rulesWith } from '../rules.ts';
import { bump, label, merge, PAIRINGS, play } from './common.ts';

interface Tally {
  n: number;
  w: number;
  timeouts: number;
  exchanges: number;
  breathAimed: number;
  breathLanded: number;
  chargeSlots: number;
  slots: number;
  dealt: Record<string, number>;
  taken: Record<string, number>;
  /** hits taken, by what shaped them */
  takenTags: Record<string, number>;
  /** against each opponent */
  vs: Record<string, { w: number; n: number }>;
}

interface Opts { morph: string; stone: string; bouts: number; skill: Skill; overrides: Record<string, unknown> }

function run(o: Opts, part: number, parts: number): Record<string, Tally> {
  const rules = rulesWith(o.overrides);
  const subjects = PAIRINGS.filter((p) => (!o.morph || p.morph === o.morph) && (!o.stone || p.stone === o.stone));
  const out: Record<string, Tally> = {};
  let job = 0;
  for (const s of subjects) for (const opp of PAIRINGS) {
    if (opp === s) continue;
    for (let i = 0; i < o.bouts; i++, job++) {
      if (job % parts !== part) continue;
      const { bout, ev, me, them } = play(s, opp, job, rules, o.skill);
      const t = (out[label(s)] ??= { n: 0, w: 0, timeouts: 0, exchanges: 0, breathAimed: 0, breathLanded: 0, chargeSlots: 0, slots: 0, dealt: {}, taken: {}, takenTags: {}, vs: {} });
      const won = bout.winner === me;
      t.n++;
      if (won) t.w++;
      const vs = (t.vs[label(opp)] ??= { w: 0, n: 0 });
      vs.n++;
      if (won) vs.w++;
      t.exchanges += bout.exchange;
      for (const e of ev) {
        if (e.kind === 'boutEnd' && e.reason.startsWith('timeout')) t.timeouts++;
        if (e.kind === 'aim' && e.side === me && e.action === 'breath') t.breathAimed++;
        if (e.kind === 'hit' && e.attacker === me) {
          bump(t.dealt, e.action, e.damage);
          if (e.action === 'breath') t.breathLanded++;
        }
        if (e.kind === 'hit' && e.attacker === them) {
          bump(t.taken, e.action, e.damage);
          for (const tag of e.tags) bump(t.takenTags, tag);
        }
        if (e.kind === 'zoneEffect' && e.side === me) bump(t.taken, `zone: ${e.zone}`, e.damage);
        // Zone damage the opponent takes (in a mirror match, some may be its own fire).
        if (e.kind === 'zoneEffect' && e.side === them && e.damage) bump(t.dealt, `zone: ${e.zone}`, e.damage);
        if (e.kind === 'note' && e.side === me && e.tag === 'slam') bump(t.taken, 'slam', bout.rules.SLAM_DAMAGE);
        if (e.kind === 'slotEnd') {
          t.slots++;
          if (e.plans[me].label.includes('(charging)')) t.chargeSlots++;
        }
      }
    }
  }
  return out;
}

if (!isMainThread) {
  parentPort!.postMessage(run(workerData.opts, workerData.part, workerData.parts));
} else {
  const argv = process.argv.slice(2);
  const { overrides, label: rulesLabel } = rulesFromArgs(argv);
  const opts: Opts = { morph: flag(argv, '--morph', ''), stone: flag(argv, '--stone', ''), bouts: Number(flag(argv, '--bouts', '20')), skill: flag(argv, '--skill', 'master') as Skill, overrides };
  const result = merge(await inWorkers<Record<string, Tally>>(new URL(import.meta.url), { opts }));
  const per = (v: number, t: Tally) => (v / t.n).toFixed(1);
  console.log(`Pairings against the field, ${opts.bouts} bouts per opponent at ${opts.skill} skill, ${rulesLabel}.`);
  for (const [k, t] of Object.entries(result).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    const list = (r: Record<string, number>) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([x, v]) => `${x} ${per(v, t)}`).join(', ');
    console.log(`\n${k}: wins ${rateWithMargin(t.w, t.n).trim()} of ${t.n}; ${(100 * t.timeouts / t.n).toFixed(0)}% timeouts; ${per(t.exchanges, t)} exchanges a bout.`);
    console.log(`  Deals ${per(sum(t.dealt), t)} a bout: ${list(t.dealt)}.`);
    console.log(`  Takes ${per(sum(t.taken), t)} a bout: ${list(t.taken)}.`);
    console.log(`  Hits taken carried, per bout: ${list(t.takenTags) || 'nothing extra'}.`);
    console.log(`  Breath lands ${t.breathLanded} of ${t.breathAimed} aimed; charging in ${(100 * t.chargeSlots / Math.max(1, t.slots)).toFixed(0)}% of slots.`);
    console.log(`  Against: ${Object.entries(t.vs).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([x, { w, n }]) => `${x} ${(100 * w / n).toFixed(0)}%`).join(', ')}.`);
  }
}
