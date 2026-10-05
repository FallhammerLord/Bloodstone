// A worker for the brain tournament: plays the bouts it's handed and reports who won.

import { parentPort, workerData } from 'node:worker_threads';
import { aiController, type Style } from './ai.ts';
import { brainController, type BrainStyle, type Skill } from './brain.ts';
import { runBout, type Controller } from './bout.ts';
import { newBout, type FighterSetup, type NoteTag, type Side } from './referee.ts';
import { standardBoulders } from './arena.ts';
import * as R from './rules.ts';
import { rulesWith } from './rules.ts';

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
  /** per attack: [aimed, landed, damage] */
  byAttack: Record<string, [number, number, number]>;
  /** per attacker stone, then attack: [aimed, landed, damage]; pairing bouts only (identical dragons tell nothing) */
  byStone: Record<string, Record<string, [number, number, number]>>;
  /** slots spent on each action (both sides) */
  actions: Record<string, number>;
  /** what came of them: revisions, Intimidates landed and cashed, evades, verbs landed and held, slams, and more */
  outcomes: Record<string, number>;
  /** movement census: per morph [paces traveled, bouts, bouts that stayed within 1½ paces of the start]; slots per band */
  travel: Record<string, [number, number, number]>;
  bands: Record<string, number>;
  /** [Bites right after an Approach, all Bites, Claws right after a Strafe, all Claws] */
  setup: [number, number, number, number];
}

const controller = (p: Player): Controller =>
  p.kind === 'brain' ? brainController(p.style as BrainStyle, p.skill, p.seed) : aiController(p.style as Style, p.seed);

const results: Result[] = [];
const rules = rulesWith(workerData.overrides ?? {});
const mine = (workerData.jobs as Job[]).filter((_, i) => i % workerData.parts === workerData.part);
for (const job of mine) {
  const bout = newBout(job.A, job.B, rules.START_SEPARATION / R.PACE, job.challenged, { boulders: standardBoulders(job.arenaSeed, rules), seed: job.arenaSeed }, rules);
  const startPos = { A: { ...bout.fighters.A.pos }, B: { ...bout.fighters.B.pos } };
  const ev = runBout(bout, { A: controller(job.playerA), B: controller(job.playerB) });
  const end = ev.find((e) => e.kind === 'boutEnd');
  const ending = end?.kind === 'boutEnd' && end.reason.startsWith('timeout') ? 'timeout' : ev.some((e) => e.kind === 'pulse' && e.woundsLeft <= 0) ? 'pulse' : 'ko';
  const stats: Result['stats'] = [0, 0, 0, 0, 0, 0, 0, 0];
  const dealt: Record<Side, number> = { A: 0, B: 0 };
  const byAttack: Result['byAttack'] = {};
  const tally = (a: string) => (byAttack[a] ??= [0, 0, 0]);
  const byStone: Result['byStone'] = {};
  const actions: Record<string, number> = {};
  const outcomes: Record<string, number> = {};
  const bump = (k: string) => (outcomes[k] = (outcomes[k] ?? 0) + 1);
  // What each note tag counts toward in the outcomes table.
  const NOTES: Partial<Record<NoteTag, string[]>> = {
    'intimidate-lands': ['intimidate lands'],
    'intimidate-short': ['intimidate falls short'],
    push: ['push lands'],
    pull: ['pull lands'],
    'verb-held': ['verb held by Affinity'],
    'zone-held': ['verb held by Affinity'],
    'push-pull-cancel': ['push and pull cancel'],
    slam: ['slam'],
    'charge-broken': ['charge broken'],
    'meter-fill': ['meter fill'],
    'meter-full': ['meter fill', 'meter full'],
    'meter-spent': ['true-damage hit'],
    lunge: ['lunge'],
    pounce: ['pounce'],
    stoop: ['stoop'],
    'blocked-move': ['blocked move → dodge'],
    gravity: ['gravity drop'],
    'stoop-too-soon': ['stoop too soon'],
    demoralized: ['demoralized'],
    'crunch-capped': ['crunch capped'],
    'boulder-shattered': ['quake shatters boulder'],
  };
  const stoneTally = (s: Side, a: string) => ((byStone[bout.fighters[s].sheet.stone] ??= {})[a] ??= [0, 0, 0]);
  for (const e of ev) {
    if (e.kind === 'revision') bump('revision');
    if (e.kind === 'evade') bump(e.how === 'dodging' ? 'evade by Dodge' : 'evade while moving');
    if (e.kind === 'zoneEffect') bump(`zone: ${e.zone}`);
    if (e.kind === 'hit' && e.tags.includes('intimidate')) bump('intimidate cashed');
    if (e.kind === 'hit' && e.tags.includes('demoralized')) bump('demoralize felt');
    if (e.kind === 'note') for (const k of NOTES[e.tag] ?? []) bump(k);
    if (e.kind === 'aim') {
      tally(e.action)[0]++;
      stoneTally(e.side, e.action)[0]++;
    }
    if (e.kind === 'hit') {
      stoneTally(e.attacker, e.action)[1]++;
      stoneTally(e.attacker, e.action)[2] += e.damage;
      // What each stone takes from attacks aimed at it: [aimed at it, landed on it, damage].
      const def: Side = e.attacker === 'A' ? 'B' : 'A';
      stoneTally(def, `taken-${e.action}`)[1]++;
      stoneTally(def, `taken-${e.action}`)[2] += e.damage;
    }
    if (e.kind === 'aim') stoneTally(e.side === 'A' ? 'B' : 'A', `taken-${e.action}`)[0]++;
    if (e.kind === 'aim' && e.action === 'breath') stats[0]++;
    if (e.kind === 'slotEnd') {
      for (const s of ['A', 'B'] as const) {
        if (e.plans[s].label.includes('(charging)')) stats[6]++;
        if (e.plans[s].label.includes('(crunched)')) stats[7]++;
      }
    }
    if (e.kind === 'hit') {
      dealt[e.attacker] += e.damage;
      tally(e.action)[1]++;
      tally(e.action)[2] += e.damage;
      stats[3] += e.damage;
      if (e.action === 'breath') {
        stats[1]++;
        stats[2] += e.damage;
      }
    }
  }
  // Bites right after the same side's Approach: how often the lunge's setup comes for free.
  const setup: Result['setup'] = [0, 0, 0, 0];
  bout.record.forEach((r, i) => {
    for (const s of ['A', 'B'] as const) {
      const prev = i > 0 ? bout.record[i - 1].actions[s] : null;
      if (r.actions[s] === 'bite') {
        setup[1]++;
        if (prev === 'approach') setup[0]++;
      }
      if (r.actions[s] === 'claw') {
        setup[3]++;
        if (prev === 'strafe') setup[2]++;
      }
    }
  });
  for (const r of bout.record) for (const s of ['A', 'B'] as const) actions[r.actions[s]] = (actions[r.actions[s]] ?? 0) + 1;
  // Movement census: how far each dragon travels, and at what range the fight happens.
  const travel: Result['travel'] = {};
  const bands: Result['bands'] = {};
  const start = startPos;
  for (const s of ['A', 'B'] as const) {
    let path = 0;
    let far = 0;
    let prev = start[s];
    for (const e of ev) {
      if (e.kind !== 'slotEnd') continue;
      const p = e.positions[s];
      path += Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
      far = Math.max(far, Math.hypot(p.x - start[s].x, p.y - start[s].y, p.z - start[s].z));
      prev = p;
    }
    const m = bout.fighters[s].sheet.morph;
    const t = (travel[m] ??= [0, 0, 0]);
    t[0] += path / R.PACE;
    t[1]++;
    if (far < 1.5 * R.PACE) t[2]++;
  }
  for (const e of ev) {
    if (e.kind !== 'slotEnd') continue;
    const b = e.separation <= R.MELEE_EDGE ? 'melee' : e.separation <= R.CLOSE_EDGE ? 'close' : e.separation <= R.FAR_EDGE ? 'far' : 'very far';
    bands[b] = (bands[b] ?? 0) + 1;
  }
  for (const r of bout.record) for (const s of ['A', 'B'] as const) {
    stats[5]++;
    if (r.actions[s] === 'scales') stats[4]++;
  }
  results.push({ id: job.id, winner: bout.winner!, exchanges: bout.exchange, ending, stats, dealt, byAttack, setup, byStone, actions, outcomes, travel, bands });
}
parentPort!.postMessage(results);
