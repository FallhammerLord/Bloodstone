// A worker for the brain tournament: plays the bouts it's handed and reports who won.

import { parentPort, workerData } from 'node:worker_threads';
import { aiController, type Style } from './ai.ts';
import { brainController, type BrainStyle, type Skill } from './brain.ts';
import { runBout, type Controller } from './bout.ts';
import { newBout, type FighterSetup, type Side } from './referee.ts';
import * as R from './rules.ts';

export interface Player {
  kind: 'brain' | 'crude';
  style: string;
  skill: Skill;
  seed: number;
}

export interface Job {
  id: number;
  group: string;
  A: FighterSetup;
  B: FighterSetup;
  playerA: Player;
  playerB: Player;
  challenged: Side;
  arenaSeed: number;
}

export interface Result {
  id: number;
  winner: Side;
  exchanges: number;
  ending: 'ko' | 'pulse' | 'timeout';
  /** breaths aimed, breaths landed, breath damage, all damage, Scales chosen, slots played, charges, crunches */
  stats: [number, number, number, number, number, number, number, number];
  /** damage dealt by each side */
  dealt: Record<Side, number>;
}

const controller = (p: Player): Controller =>
  p.kind === 'brain' ? brainController(p.style as BrainStyle, p.skill, p.seed) : aiController(p.style as Style, p.seed);

const results: Result[] = [];
for (const job of workerData.jobs as Job[]) {
  const bout = newBout(job.A, job.B, R.START_SEPARATION / R.PACE, job.challenged, { boulders: job.arenaSeed % 4, seed: job.arenaSeed });
  const ev = runBout(bout, { A: controller(job.playerA), B: controller(job.playerB) });
  const end = ev.find((e) => e.kind === 'boutEnd');
  const ending = end?.kind === 'boutEnd' && end.reason.startsWith('timeout') ? 'timeout' : ev.some((e) => e.kind === 'pulse' && e.woundsLeft <= 0) ? 'pulse' : 'ko';
  const stats: Result['stats'] = [0, 0, 0, 0, 0, 0, 0, 0];
  const dealt: Record<Side, number> = { A: 0, B: 0 };
  for (const e of ev) {
    if (e.kind === 'aim' && e.action === 'breath') stats[0]++;
    if (e.kind === 'slotEnd') {
      for (const s of ['A', 'B'] as const) {
        if (e.plans[s].label.includes('(charging)')) stats[6]++;
        if (e.plans[s].label.includes('(crunched)')) stats[7]++;
      }
    }
    if (e.kind === 'hit') {
      dealt[e.attacker] += e.damage;
      stats[3] += e.damage;
      if (e.action === 'breath') {
        stats[1]++;
        stats[2] += e.damage;
      }
    }
  }
  for (const r of bout.record) for (const s of ['A', 'B'] as const) {
    stats[5]++;
    if (r.actions[s] === 'scales') stats[4]++;
  }
  results.push({ id: job.id, winner: bout.winner!, exchanges: bout.exchange, ending, stats, dealt });
}
parentPort!.postMessage(results);
