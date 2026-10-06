// The balance harness: every core pairing fights every other, under every pair of AI styles,
// as challenger and as challenged. Reports who wins too often.
//   npm run tourney [-- --rounds 2]

import { aiController, STYLES } from './ai.ts';
import { runBout } from './bout.ts';
import { CORE_MORPHS, type CoreStone, type Morph } from './hatch.ts';
import { newBout, type FighterSetup, type Side } from './referee.ts';
import { standardBoulders } from './arena.ts';
import { seededRandom } from './random.ts';
import { findShard, randomLoadout } from './shards.ts';
import * as R from './rules.ts';

const MORPHS: Morph[] = CORE_MORPHS;
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];
const MORPH_NAMES: Record<Morph, string> = { 'true-dragon': 'True Dragon', wyvern: 'Wyvern', wyrm: 'Wyrm', drake: 'Drake' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

interface Entrant {
  key: string;
  label: string;
  setup: FighterSetup;
}

const entrants: Entrant[] = MORPHS.flatMap((morph) =>
  STONES.map((stone) => ({ key: `${morph}/${stone}`, label: `${MORPH_NAMES[morph]} + ${cap(stone)}`, setup: { name: `${morph}-${stone}`, morph, stone } })),
);

const argv = process.argv.slice(2);
const roundsArg = argv.indexOf('--rounds');
const rounds = roundsArg >= 0 ? Number(argv[roundsArg + 1]) : 1;
const withShards = argv.includes('--shards');

const shardTally = new Map<string, { wins: number; bouts: number }>();

interface Tally {
  wins: number;
  bouts: number;
}
const overall = new Map<string, Tally>(entrants.map((e) => [e.key, { wins: 0, bouts: 0 }]));
const head = new Map<string, Tally>(); // "row|col": row's record against col
const endings = { ko: 0, pulse: 0, timeout: 0 };
let exchanges = 0;
let total = 0;

for (const a of entrants) {
  for (const b of entrants) {
    if (a.key === b.key) continue;
    for (let round = 0; round < rounds; round++) {
      for (const styleA of STYLES) {
        for (const styleB of STYLES) {
          for (const challenged of ['A', 'B'] as Side[]) {
            const seed = total * 7919 + 17;
            const rng = seededRandom(seed);
            const la = withShards ? randomLoadout(rng) : undefined;
            const lb = withShards ? randomLoadout(rng) : undefined;
            const bout = newBout({ ...a.setup, shards: la }, { ...b.setup, shards: lb }, R.DEFAULT_RULES.START_SEPARATION / R.PACE, challenged, { boulders: standardBoulders(seed), seed });
            const events = runBout(bout, { A: aiController(styleA, seed), B: aiController(styleB, seed + 1) });
            const end = events.find((e) => e.kind === 'boutEnd');
            if (end?.reason.startsWith('timeout')) endings.timeout++;
            else if (events.some((e) => e.kind === 'pulse' && e.woundsLeft <= 0)) endings.pulse++;
            else endings.ko++;
            exchanges += bout.exchange;
            total++;
            const aWon = bout.winner === 'A';
            const o = overall.get(a.key)!;
            o.bouts++;
            if (aWon) o.wins++;
            const ob = overall.get(b.key)!;
            ob.bouts++;
            if (!aWon) ob.wins++;
            for (const [load, won] of [[la, aWon], [lb, !aWon]] as const) {
              for (const sh of load ?? []) {
                const key = sh.grade && findShard(sh.shard, sh.grade).kind.family === 'technique' ? `${sh.shard} (${sh.grade})` : sh.shard;
                const st = shardTally.get(key) ?? { wins: 0, bouts: 0 };
                st.bouts++;
                if (won) st.wins++;
                shardTally.set(key, st);
              }
            }
            const h = head.get(`${a.key}|${b.key}`) ?? { wins: 0, bouts: 0 };
            h.bouts++;
            if (aWon) h.wins++;
            head.set(`${a.key}|${b.key}`, h);
          }
        }
      }
    }
  }
}

const pct = (t: Tally) => (100 * t.wins) / t.bouts;
const fmt = (n: number) => `${n.toFixed(0).padStart(3)}%`;

console.log(`Tournament: ${total} bouts. Every pairing against every other, ${STYLES.length * STYLES.length} AI style matchups, both as challenger and challenged.`);
console.log(`Endings: ${endings.ko} KO, ${endings.pulse} rim-pulse KO, ${endings.timeout} timeout. Average ${(exchanges / total).toFixed(1)} exchanges per bout.`);
console.log('Arenas: the four rim pillars plus 1d4+2 seeded boulders per bout.');
if (withShards) console.log('Loadouts: every dragon gets a random, seeded 3-pip wyrmling loadout from every built shard at every grade.');
console.log('A fair pairing wins about 50%. These AIs are crude, so read this as "strong in crude hands."\n');

console.log('── Pairings, by win rate ──');
for (const e of [...entrants].sort((x, y) => pct(overall.get(y.key)!) - pct(overall.get(x.key)!))) {
  const p = pct(overall.get(e.key)!);
  const barLen = Math.round(p / 4);
  console.log(`  ${fmt(p)}  ${e.label.padEnd(20)} ${'█'.repeat(barLen)}`);
}

const group = (pick: (e: Entrant) => string) => {
  const m = new Map<string, Tally>();
  for (const e of entrants) {
    const t = overall.get(e.key)!;
    const g = m.get(pick(e)) ?? { wins: 0, bouts: 0 };
    g.wins += t.wins;
    g.bouts += t.bouts;
    m.set(pick(e), g);
  }
  return [...m.entries()].sort((x, y) => pct(y[1]) - pct(x[1]));
};
console.log('\n── By morph ──');
for (const [k, t] of group((e) => MORPH_NAMES[e.setup.morph])) console.log(`  ${fmt(pct(t))}  ${k}`);
console.log('\n── By stone ──');
for (const [k, t] of group((e) => cap(e.setup.stone))) console.log(`  ${fmt(pct(t))}  ${k}`);

// Combine both seatings of each matchup, then list the most one-sided.
console.log('\n── Most one-sided matchups ──');
const pairs: { a: Entrant; b: Entrant; p: number }[] = [];
for (let i = 0; i < entrants.length; i++) {
  for (let j = i + 1; j < entrants.length; j++) {
    const a = entrants[i];
    const b = entrants[j];
    const ab = head.get(`${a.key}|${b.key}`)!;
    const ba = head.get(`${b.key}|${a.key}`)!;
    const p = (100 * (ab.wins + (ba.bouts - ba.wins))) / (ab.bouts + ba.bouts);
    pairs.push(p >= 50 ? { a, b, p } : { a: b, b: a, p: 100 - p });
  }
}
for (const { a, b, p } of pairs.sort((x, y) => y.p - x.p).slice(0, 10)) {
  console.log(`  ${fmt(p)}  ${a.label} over ${b.label}`);
}

if (withShards) {
  // Technique grades vary in power, so they are listed per grade; ranks are by win rate of dragons carrying them.
  const rows = [...shardTally.entries()].filter(([, t]) => t.bouts >= 30).sort((x, y) => pct(y[1]) - pct(x[1]));
  console.log('\n── Shards, by win rate of dragons carrying them (random 3-pip loadouts) ──');
  for (const [k, t] of rows.slice(0, 12)) console.log(`  ${fmt(pct(t))}  ${k}`);
  console.log('  ...');
  for (const [k, t] of rows.slice(-8)) console.log(`  ${fmt(pct(t))}  ${k}`);
}
