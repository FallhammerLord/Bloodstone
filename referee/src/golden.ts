// Golden masters: fixed-seed bouts and every scenario, hashed, so a refactor can prove it changed nothing.
//   npm run golden            compare against test/golden/*.json
//   npm run golden -- --write  record new goldens (only in a commit that changes rules on purpose)

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { standardBoulders } from './arena.ts';
import { brainController, BRAIN_STYLES } from './brain.ts';
import { runBout } from './bout.ts';
import type { CoreStone, Morph } from './hatch.ts';
import { newBout, type Event, type FighterSetup } from './referee.ts';
import * as R from './rules.ts';
import { rulesFor, scenarioController, separationOf, type Scenario } from './scenario.ts';

export interface Golden {
  name: string;
  winner: string;
  exchanges: number;
  wounds: string;
  hash: string;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const hash = (ev: Event[]) => createHash('sha256').update(JSON.stringify(ev)).digest('hex').slice(0, 16);

const MORPHS: Morph[] = ['true-dragon', 'wyvern', 'wyrm'];
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
const SETUPS: FighterSetup[] = MORPHS.flatMap((m) => STONES.map((s) => ({ name: `${m}-${s}`, morph: m, stone: s })));

/** Brain bouts on the tournament's rules: every pairing once, styles and seeds rotating. */
export function goldenBouts(count = 144, part = 0, parts = 1): Golden[] {
  const out: Golden[] = [];
  const saved = { ...R.VARIANT };
  Object.assign(R.VARIANT, { breathCharge: true, biteLunge: true, clawPounce: true, breathMandatory: false });
  for (let i = part; i < count; i += parts) {
    const A = SETUPS[i % SETUPS.length];
    const B = SETUPS[Math.floor(i / SETUPS.length) % SETUPS.length];
    const sa = BRAIN_STYLES[i % BRAIN_STYLES.length];
    const sb = BRAIN_STYLES[(i * 7 + 3) % BRAIN_STYLES.length];
    const seed = i * 31 + 7;
    const bout = newBout(A, B, R.START_SEPARATION / R.PACE, i % 2 ? 'A' : 'B', { boulders: standardBoulders(seed), seed });
    const ev = runBout(bout, { A: brainController(sa, 'master', seed), B: brainController(sb, 'master', seed + 1) });
    out.push(summary(`${i} ${A.name}/${sa} v ${B.name}/${sb}`, bout, ev));
  }
  Object.assign(R.VARIANT, saved);
  return out;
}

export function goldenScenarios(): Golden[] {
  const dir = `${ROOT}scenarios/`;
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const sc = JSON.parse(readFileSync(dir + f, 'utf8')) as Scenario;
    const bout = newBout(sc.A, sc.B, separationOf(sc), sc.challenged ?? 'B', sc.arena ?? {});
    const ev = runBout(bout, { A: scenarioController(sc, 'A'), B: scenarioController(sc, 'B') }, rulesFor(sc));
    return summary(f, bout, ev);
  });
}

function summary(name: string, bout: ReturnType<typeof newBout>, ev: Event[]): Golden {
  const end = ev.find((e) => e.kind === 'boutEnd');
  const winner = end?.kind === 'boutEnd' ? `${end.winner ?? '-'}` : '-';
  const F = bout.fighters;
  return { name, winner, exchanges: bout.exchange, wounds: `${F.A.wounds}/${F.B.wounds}`, hash: hash(ev) };
}

export const GOLDEN_FILES = { bouts: `${ROOT}test/golden/bouts.json`, scenarios: `${ROOT}test/golden/scenarios.json` };

export function diff(name: string, want: Golden[], got: Golden[]): string[] {
  const lines: string[] = [];
  if (want.length !== got.length) lines.push(`${name}: ${want.length} recorded, ${got.length} now`);
  for (let i = 0; i < Math.min(want.length, got.length); i++) {
    const w = want[i], g = got[i];
    if (w.hash !== g.hash || w.name !== g.name) lines.push(`${name}: ${g.name}  winner ${w.winner}→${g.winner}  exchanges ${w.exchanges}→${g.exchanges}  wounds ${w.wounds}→${g.wounds}`);
  }
  return lines;
}

/** The bouts spread over worker threads, in order. */
async function goldenBoutsParallel(parts = 4): Promise<Golden[]> {
  const chunks = await Promise.all(Array.from({ length: parts }, (_, part) => new Promise<Golden[]>((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { part, parts }, execArgv: process.execArgv });
    w.once('message', resolve);
    w.once('error', reject);
  })));
  const out: Golden[] = [];
  for (let i = 0; chunks.some((c) => i < c.length * parts); i++) if (chunks[i % parts][Math.floor(i / parts)]) out.push(chunks[i % parts][Math.floor(i / parts)]);
  return out;
}

if (!isMainThread && workerData?.parts) {
  parentPort!.postMessage(goldenBouts(144, workerData.part, workerData.parts));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const got = { bouts: await goldenBoutsParallel(), scenarios: goldenScenarios() };
  if (process.argv.includes('--write')) {
    for (const k of ['bouts', 'scenarios'] as const) writeFileSync(GOLDEN_FILES[k], JSON.stringify(got[k], null, 1) + '\n');
    console.log(`Recorded ${got.bouts.length} bouts and ${got.scenarios.length} scenarios.`);
  } else {
    const lines = (['bouts', 'scenarios'] as const).flatMap((k) => diff(k, JSON.parse(readFileSync(GOLDEN_FILES[k], 'utf8')), got[k]));
    console.log(lines.length ? lines.join('\n') + `\n${lines.length} changed.` : 'Goldens match.');
    if (lines.length) process.exitCode = 1;
  }
}
