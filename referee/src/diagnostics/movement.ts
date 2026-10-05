// How dragons move under band movement, by morph: what moves they choose, how far they land in the band, what
// blocks them, what hits them mid-move, and whether a move changed the band the way it meant to.
//   npm run diag:movement -- [--bouts 4] [--skill master] [--rule KEY=VALUE ...]
// Every pairing faces every other --bouts times, with random general styles.

import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { Skill } from '../brain.ts';
import { flag, inWorkers, rulesFromArgs } from '../harness.ts';
import type { Event, Side } from '../referee.ts';
import { CLOSE_EDGE, FAR_EDGE, MELEE_EDGE, PACE, rulesWith } from '../rules.ts';
import { bump, merge, PAIRINGS, play } from './common.ts';

const MOVES = ['approach', 'retreat', 'strafe', 'leap', 'dive'];
const bandIx = (d: number) => (d <= MELEE_EDGE ? 0 : d <= CLOSE_EDGE ? 1 : d <= FAR_EDGE ? 2 : 3);

interface MorphTally {
  slots: number;
  moves: Record<string, number>;
  depth: Record<string, number>;
  outcome: Record<string, number>;
  /** hits taken during a move, by the move's phase */
  hitWhileMoving: Record<string, number>;
  punishedWhileMoving: number;
  evades: number;
  /** the band after each Approach and Retreat, against the band before */
  approach: Record<'farther' | 'same' | 'nearer', number>;
  retreat: Record<'farther' | 'same' | 'nearer', number>;
}

interface Census {
  bouts: number;
  morph: Record<string, MorphTally>;
  /** summed separation (paces) and count, per slot of the bout */
  sepBySlot: Record<string, number>;
  /** the slot each bout first reached Melee, or never */
  firstMelee: number[];
  neverMelee: number;
}

interface Opts { bouts: number; skill: Skill; overrides: Record<string, unknown> }

function run(o: Opts, part: number, parts: number): Census {
  const rules = rulesWith(o.overrides);
  const C: Census = { bouts: 0, morph: {}, sepBySlot: {}, firstMelee: [], neverMelee: 0 };
  let job = 0;
  for (const a of PAIRINGS) for (const b of PAIRINGS) {
    if (a === b) continue;
    for (let i = 0; i < o.bouts; i++, job++) {
      if (job % parts !== part) continue;
      const { ev, me } = play(a, b, job, rules, o.skill);
      const setupOf = (s: Side) => (s === me ? a : b);
      C.bouts++;
      let slotEvents: Event[] = [];
      let prevSep = rules.START_SEPARATION;
      let slot = 0;
      let firstMelee = -1;
      for (const e of ev) {
        if (e.kind !== 'slotEnd') {
          slotEvents.push(e);
          continue;
        }
        slot++;
        bump(C.sepBySlot, String(slot), e.separation / PACE);
        bump(C.sepBySlot, `n${slot}`);
        if (firstMelee < 0 && e.separation <= MELEE_EDGE) firstMelee = slot;
        for (const s of ['A', 'B'] as Side[]) {
          const m = (C.morph[setupOf(s).morph] ??= { slots: 0, moves: {}, depth: {}, outcome: {}, hitWhileMoving: {}, punishedWhileMoving: 0, evades: 0, approach: { farther: 0, same: 0, nearer: 0 }, retreat: { farther: 0, same: 0, nearer: 0 } });
          m.slots++;
          const info = e.plans[s];
          const name = info.label.split(' ')[0].toLowerCase();
          if (!MOVES.includes(name)) continue;
          bump(m.moves, name);
          if (name !== 'strafe') bump(m.depth, /\((short|long)\)/.exec(info.label)?.[1] ?? 'plain');
          if (info.label.includes('→ dodge')) bump(m.outcome, 'blocked → dodge');
          if (info.label.includes('→ roar')) bump(m.outcome, 'leash → roar');
          const other: Side = s === 'A' ? 'B' : 'A';
          for (const h of slotEvents) {
            if (h.kind === 'evade' && h.attacker === other) m.evades++;
            if (h.kind !== 'hit' || h.attacker !== other) continue;
            bump(m.hitWhileMoving, h.tick < info.windup ? 'wind-up' : h.tick < info.windup + info.active ? 'evasive' : 'recovery');
            if (h.tags.includes('punish')) m.punishedWhileMoving++;
          }
          const before = bandIx(prevSep);
          const after = bandIx(e.separation);
          const arr = name === 'retreat' ? m.retreat : name === 'approach' ? m.approach : null;
          if (arr) arr[after > before ? 'farther' : after === before ? 'same' : 'nearer']++;
        }
        prevSep = e.separation;
        slotEvents = [];
      }
      if (firstMelee < 0) C.neverMelee++;
      else C.firstMelee.push(firstMelee);
    }
  }
  return C;
}

if (!isMainThread) {
  parentPort!.postMessage(run(workerData.opts, workerData.part, workerData.parts));
} else {
  const argv = process.argv.slice(2);
  const { overrides, label } = rulesFromArgs(argv);
  const opts: Opts = { bouts: Number(flag(argv, '--bouts', '4')), skill: flag(argv, '--skill', 'master') as Skill, overrides };
  const C = merge(await inWorkers<Census>(new URL(import.meta.url), { opts }));
  const pct = (v: number, n: number) => `${((100 * v) / Math.max(1, n)).toFixed(0)}%`;
  console.log(`Movement census: ${C.bouts} bouts at ${opts.skill} skill, ${label}.`);
  for (const [morph, m] of Object.entries(C.morph)) {
    const moves = Object.values(m.moves).reduce((a, b) => a + b, 0);
    const hits = Object.values(m.hitWhileMoving).reduce((a, b) => a + b, 0);
    const list = (r: Record<string, number>, n: number) => Object.entries(r).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pct(v, n)}`).join(', ');
    const dir = (r: Record<'farther' | 'same' | 'nearer', number>, away: boolean) => {
      const n = r.farther + r.same + r.nearer;
      return `${pct(away ? r.farther : r.nearer, n)} change band as meant, ${pct(r.same, n)} stay`;
    };
    console.log(`\n${morph}: moves in ${pct(moves, m.slots)} of slots (${list(m.moves, moves)}).`);
    console.log(`  Depth: ${list(m.depth, Object.values(m.depth).reduce((a, b) => a + b, 0))}. Outcomes: ${list(m.outcome, moves) || 'none blocked'}.`);
    console.log(`  Hit while moving: ${pct(hits, moves)} of moves (${list(m.hitWhileMoving, hits)}); ${m.punishedWhileMoving} punishes; ${m.evades} evades.`);
    console.log(`  Approach: ${dir(m.approach, false)}. Retreat: ${dir(m.retreat, true)}.`);
  }
  const slots = Object.keys(C.sepBySlot).filter((k) => !k.startsWith('n')).map(Number).sort((a, b) => a - b).slice(0, 9);
  console.log(`\nSeparation by slot (paces): ${slots.map((s) => `${s}: ${(C.sepBySlot[s] / C.sepBySlot[`n${s}`]).toFixed(1)}`).join(', ')}.`);
  const fm = [...C.firstMelee].sort((a, b) => a - b);
  console.log(`First reaches Melee: median slot ${fm[Math.floor(fm.length / 2)] ?? '—'}; never in ${pct(C.neverMelee, C.bouts)} of bouts.`);
}
