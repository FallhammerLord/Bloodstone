// The living ladder: a population of tamers, each raising one wyrmling at a time. A dragon fights dragons on its own
// rung (its pips of shards) until it wins or dies; three straight wins earn a pick from the last victim's spoils and
// a step up. A full three-pip array makes a wyrmling champion, who retires. A dead or retired dragon's tamer hatches
// another. Tamers learn: skill rises with the best rung they've reached, and their drafts lean toward builds that
// have won for them and away from builds that died, on curves: novelty fades as a tamer hatches more dragons, and a
// build's record counts for more the more fights it has. At a spoils pick a tamer can seat a shard, or melt one into
// Ichor (the tamer's, surviving its dragons) and freeze a shard of its choosing, or bank the Ichor and keep chasing.
//   npm run gauntlet [-- --tamers N] [--rounds N] [--seed N] [--json file] [--cards file]

import { writeFileSync } from 'node:fs';
import { BRAIN_STYLES, type BrainStyle, type Skill } from './brain.ts';
import { chooseSpoils, DROPS, draftDragon, ICHOR, Picks } from './brain/hatchery.ts';
import type { Job, Result } from './brains-worker.ts';
import { flag, inWorkers, rateWithMargin, WORKERS } from './harness.ts';
import { hatch } from './hatch.ts';
import { seededRandom } from './random.ts';
import type { FighterSetup, Side } from './referee.ts';
import { findShard, WYRMLING_PIPS, type Shard } from './shards.ts';

const argv = process.argv.slice(2);
const TAMERS = Number(flag(argv, '--tamers', '200'));
const ROUNDS = Number(flag(argv, '--rounds', '60'));
const seed = Number(flag(argv, '--seed', '2026'));
const jsonFile = flag(argv, '--json', '');
const cardsFile = flag(argv, '--cards', '');
const STREAK = 3;
/** A rung's skill for unclaimed dragons, and a tamer's skill from the best rung it has reached. */
const SKILL_AT: Skill[] = ['novice', 'adept', 'master'];
const skillAt = (pips: number): Skill => SKILL_AT[Math.min(pips, 2)];
/**
 * The learning curves. Novelty fades with experience: its weight is 1 ÷ (1 + dragons hatched ÷ fade). A build's
 * record weighs in as scale × (win rate − ½) × n ÷ (n + trust), n its fights: one lucky win barely moves a draft,
 * ten fights mostly decide it, and a proven build outweighs novelty.
 */
const LEARN = { fade: 5, scale: 4, trust: 4 };

const rng = seededRandom(seed);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
const shuffle = <T>(xs: T[]) => {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
};
const SYL = ['ka', 'ren', 'vel', 'mor', 'ash', 'tor', 'ila', 'quen', 'dra', 'sul', 'bryn', 'ost', 'yra', 'gal', 'thi', 'ven', 'cor', 'ush', 'lin', 'zar'];
const name = (n: number) => {
  const s = Array.from({ length: n }, () => pick(SYL)).join('');
  return s[0].toUpperCase() + s.slice(1);
};
const EPITHET = ['Ash', 'Brine', 'Cinder', 'Dusk', 'Ember', 'Flint', 'Gale', 'Hollow', 'Iron', 'Mire', 'Rime', 'Slate', 'Storm', 'Thorn', 'Vane'];
const TAIL = ['claw', 'fang', 'wing', 'crest', 'maw', 'tail', 'horn', 'eye', 'spine', 'heart'];
const dragonName = () => `${pick(EPITHET)}${pick(TAIL)}`;

interface Dragon {
  name: string;
  setup: FighterSetup;
  build: string;
  pips: number;
  streak: number;
  wins: number;
  losses: number;
  born: number;
  nth: number;
}
interface Tamer {
  id: number;
  name: string;
  style: BrainStyle;
  best: number;
  wins: number;
  losses: number;
  hatched: number;
  champions: string[];
  prefs: Map<string, { w: number; d: number }>;
  picks: Picks;
  ichor: number;
  history: string[];
  dragon: Dragon | null;
  graveyard: string[];
}
const skillOf = (t: Tamer) => skillAt(t.best);
const buildOf = (s: FighterSetup) => `${s.morph} + ${s.stone}`;
const shardsOf = (s: FighterSetup) => (s.shards ?? []).map((x) => x.shard);
const kit = (s: FighterSetup) => `${buildOf(s)}${s.shards?.length ? `, ${shardsOf(s).join(', ')}` : ''}`;

const tamers: Tamer[] = Array.from({ length: TAMERS }, (_, id) => ({
  id, name: `${name(2)} ${name(1)}`, style: BRAIN_STYLES[id % BRAIN_STYLES.length], best: 0, wins: 0, losses: 0, hatched: 0,
  champions: [], prefs: new Map(), picks: new Picks(), ichor: 0, history: [], dragon: null, graveyard: [],
}));
const wildPicks = new Picks();

// The census.
type Rate = { w: number; n: number };
const tally = (m: Map<string, Rate>, k: string, won: boolean) => {
  const t = m.get(k) ?? { w: 0, n: 0 };
  t.n++;
  if (won) t.w++;
  m.set(k, t);
};
const count = (m: Map<string, number>, k: string, by = 1) => m.set(k, (m.get(k) ?? 0) + by);
const buildFights = new Map<string, Rate>();
const rungFights = [new Map<string, Rate>(), new Map<string, Rate>(), new Map<string, Rate>()];
const rungField = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
const hatches = new Map<string, number>();
const hatchesByThird = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
const climbed = new Map<string, number>();
const championBuilds = new Map<string, number>();
const styleFights = new Map<string, Rate>();
const styleChampions = new Map<string, number>();
const skillFights = new Map<string, Rate>();
const spoilPicks = new Map<string, number>();
const melted = new Map<string, number>();
const frozen = new Map<string, number>();
let banks = 0;
const hall: string[] = [];
const ends = { ko: 0, pulse: 0, timeout: 0 };
let bouts = 0;

function hatchFor(t: Tamer, round: number) {
  const bias = (b: string) => {
    const p = t.prefs.get(b);
    const n = p ? p.w + p.d : 0;
    return n ? LEARN.scale * (p!.w / n - 0.5) * (n / (n + LEARN.trust)) : 0;
  };
  const novelty = 1 / (1 + t.hatched / LEARN.fade);
  const setup = draftDragon(t.style, skillOf(t), rng, t.picks, dragonName(), { pips: 0, bias, novelty });
  t.hatched++;
  t.dragon = { name: setup.name, setup, build: buildOf(setup), pips: 0, streak: 0, wins: 0, losses: 0, born: round, nth: t.hatched };
  count(hatches, t.dragon.build);
  count(hatchesByThird[Math.min(2, Math.floor((3 * round) / ROUNDS))], t.dragon.build);
  t.history.push(`R${round} · hatches #${t.hatched} ${setup.name} (${t.dragon.build}) as a ${skillOf(t)}`);
}

const pref = (t: Tamer, b: string) => {
  const p = t.prefs.get(b) ?? { w: 0, d: 0 };
  t.prefs.set(b, p);
  return p;
};

const t0 = Date.now();
for (let round = 1; round <= ROUNDS; round++) {
  for (const t of tamers) if (!t.dragon) hatchFor(t, round);
  // Each rung pairs its dragons at random; an odd one out meets an unclaimed dragon of its rung.
  type Side_ = { tamer: Tamer | null; setup: FighterSetup; style: BrainStyle; skill: Skill; pips: number };
  const bouts_: [Side_, Side_][] = [];
  for (let rung = 0; rung < WYRMLING_PIPS; rung++) {
    const here = shuffle(tamers.filter((t) => t.dragon!.pips === rung));
    const side = (t: Tamer): Side_ => ({ tamer: t, setup: t.dragon!.setup, style: t.style, skill: skillOf(t), pips: rung });
    for (let i = 0; i + 1 < here.length; i += 2) bouts_.push([side(here[i]), side(here[i + 1])]);
    if (here.length % 2) {
      const style = pick(BRAIN_STYLES);
      const setup = draftDragon(style, skillAt(rung), rng, wildPicks, `an unclaimed ${style}'s ${dragonName()}`, { pips: rung });
      bouts_.push([side(here[here.length - 1]), { tamer: null, setup, style, skill: skillAt(rung), pips: rung }]);
    }
  }
  const jobs: Job[] = bouts_.map(([a, b], i) => ({
    id: i, group: 'gauntlet', A: a.setup, B: b.setup,
    playerA: { kind: 'brain', style: a.style, skill: a.skill, seed: bouts * 2 + i * 2 + seed },
    playerB: { kind: 'brain', style: b.style, skill: b.skill, seed: bouts * 2 + i * 2 + 1 + seed },
    challenged: rng() < 0.5 ? 'A' : 'B', arenaSeed: (bouts + i) * 31 + 7 + seed,
  }));
  const results: Result[] = (await inWorkers<Result[]>(new URL('./brains-worker.ts', import.meta.url), { jobs })).flat();
  const byId = new Map(results.map((r) => [r.id, r]));

  for (const [i, pair] of bouts_.entries()) {
    const r = byId.get(i)!;
    ends[r.ending]++;
    const how = `${r.ending === 'ko' ? 'KO' : r.ending === 'pulse' ? 'rim pulse' : 'timeout'} in exchange ${r.exchanges}`;
    const winSide: Side = r.winner;
    const [w, l] = winSide === 'A' ? pair : [pair[1], pair[0]];
    const rung = w.pips;
    for (const s of pair) count(rungField[rung], buildOf(s.setup));
    for (const s of [w, l]) {
      const won = s === w;
      tally(rungFights[rung], buildOf(s.setup), won);
      if (!s.tamer) continue;
      tally(buildFights, buildOf(s.setup), won);
      tally(styleFights, s.style, won);
      tally(skillFights, s.skill, won);
    }
    const who = (s: Side_) => (s.tamer ? `${s.tamer.name}'s ${s.setup.name}` : s.setup.name);
    const foe = (s: Side_) => `${who(s)} (${kit(s.setup)}; ${s.style}, ${s.skill})`;

    // The loser dies.
    if (l.tamer) {
      const t = l.tamer;
      const d = t.dragon!;
      t.losses++;
      d.losses++;
      pref(t, d.build).d++;
      t.history.push(`R${round} · ✗ ${d.name} (${kit(d.setup)}) falls to ${foe(w)}, ${how}. Record ${d.wins}–1.`);
      t.graveyard.push(`${d.name}: ${kit(d.setup)}, ${d.wins} wins, fell in round ${round}`);
      t.dragon = null;
    }
    // The victor's streak, and spoils on the third straight kill.
    if (w.tamer) {
      const t = w.tamer;
      const d = t.dragon!;
      t.wins++;
      d.wins++;
      d.streak++;
      pref(t, d.build).w++;
      t.history.push(`R${round} · ✓ ${d.name} slays ${foe(l)}, ${how}. Streak ${d.streak}.`);
      if (d.streak >= STREAK) {
        d.streak = 0;
        const owned = new Set(shardsOf(d.setup));
        const spoils: Shard[] = [findShard(DROPS.morph[l.setup.morph], 'wyrmling'), findShard(DROPS.stone[l.setup.stone], 'wyrmling'),
          ...(l.setup.shards ?? []).map((s) => findShard(s.shard, s.grade))]
          .filter((s, k, all) => all.findIndex((x) => x.name === s.name) === k);
        const choice = chooseSpoils(t.style, skillOf(t), hatch(d.setup.morph, d.setup.stone), spoils, WYRMLING_PIPS - d.pips, owned, t.ichor, rng);
        const offer = spoils.map((s) => s.name).join(', ');
        let seat: Shard | null = null;
        if (choice?.kind === 'seat') {
          seat = choice.shard;
          count(spoilPicks, seat.name);
          t.history.push(`R${round} · ◆ ${d.name} takes ${seat.name} from the spoils (of ${offer}).`);
        } else if (choice) {
          t.ichor += ICHOR.meltPerPip * choice.melt.pips;
          count(melted, choice.melt.name);
          if (choice.kind === 'freeze') {
            seat = choice.shard;
            t.ichor -= ICHOR.freezePerPip * seat.pips;
            count(frozen, seat.name);
            t.history.push(`R${round} · ❄ ${d.name} melts ${choice.melt.name} from the spoils (of ${offer}) and freezes ${seat.name} from ${t.name}'s Ichor (${t.ichor} left).`);
          } else {
            banks++;
            t.history.push(`R${round} · ♨ ${d.name} melts ${choice.melt.name} from the spoils (of ${offer}) and banks it: ${t.name} holds ${t.ichor} Ichor. It stays on rung ${d.pips} to chase a better shard.`);
          }
        }
        if (seat) {
          const pips = Array.from({ length: seat.pips }, (_, k) => d.pips + k);
          d.setup = { ...d.setup, shards: [...(d.setup.shards ?? []), { shard: seat.name, grade: seat.grade, pips }] };
          if (d.pips === 0) count(climbed, d.build);
          d.pips += seat.pips;
          const was = skillOf(t);
          t.best = Math.max(t.best, d.pips);
          if (skillOf(t) !== was) t.history.push(`R${round} · ${t.name} is now ${skillOf(t)}.`);
        }
        if (d.pips >= WYRMLING_PIPS) {
          t.champions.push(`${d.name} (${kit(d.setup)}), ${d.wins}–0, round ${round}`);
          count(championBuilds, d.build);
          count(styleChampions, t.style);
          hall.push(`R${round}  ${d.name.padEnd(12)} ${kit(d.setup).padEnd(62)} ${t.name} (${t.style}), dragon #${d.nth}, ${d.wins}–0`);
          t.history.push(`R${round} · ★ ${d.name} becomes a wyrmling champion and retires.`);
          t.dragon = null;
        }
      }
    }
  }
  bouts += bouts_.length;
}

// ── Report ──
const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
const share = (m: Map<string, number>, k: string) => (100 * (m.get(k) ?? 0)) / Math.max(1, total(m));
const builds = [...hatches.keys()].sort((a, b) => (buildFights.get(b)!.w / buildFights.get(b)!.n) - (buildFights.get(a)!.w / buildFights.get(a)!.n));
const pct = (x: number) => `${x.toFixed(0).padStart(3)}%`;
const rungRate = (rung: number, b: string) => {
  const t = rungFights[rung].get(b);
  return t && t.n >= 10 ? `${pct((100 * t.w) / t.n)} of ${String(t.n).padEnd(4)}` : '      —     ';
};

console.log(`The living ladder: ${TAMERS} tamers, ${ROUNDS} rounds, ${bouts} bouts in ${((Date.now() - t0) / 1000).toFixed(0)} s on ${WORKERS} workers.`);
console.log(`Three straight wins earn a spoils pick; a full ${WYRMLING_PIPS}-pip array makes a wyrmling champion. Tamers start as novices: adept from rung 1, master from rung 2.`);
console.log(`Endings: ${pct((100 * ends.ko) / bouts)} KO, ${pct((100 * ends.pulse) / bouts)} rim pulse, ${pct((100 * ends.timeout) / bouts)} timeout.`);
const dragons = total(hatches);
console.log(`Dragons hatched ${dragons}; ${total(climbed)} earned a first shard (${pct((100 * total(climbed)) / dragons)}); ${hall.length} became champions.`);

console.log('\n── Builds: tamers\' dragons. Win rate overall, then by rung (win rate of fights there, every dragon on the rung counted) ──');
console.log(`  ${'build'.padEnd(20)} ${'win rate'.padEnd(9)} hatched  1st shard  champs │ ${'rung 0'.padEnd(12)} ${'rung 1'.padEnd(12)} ${'rung 2'.padEnd(12)} │ field share 0 / 1 / 2`);
for (const b of builds) {
  const f = buildFights.get(b)!;
  console.log(`  ${b.padEnd(20)} ${rateWithMargin(f.w, f.n)}  ${pct(share(hatches, b))}    ${pct((100 * (climbed.get(b) ?? 0)) / hatches.get(b)!)}     ${String(championBuilds.get(b) ?? 0).padStart(4)}   │ ${rungRate(0, b)} ${rungRate(1, b)} ${rungRate(2, b)} │ ${pct(share(rungField[0], b))} / ${pct(share(rungField[1], b))} / ${pct(share(rungField[2], b))}`);
}
console.log('\n  Learning: share of hatches in each third of the run');
for (const b of [...hatches.keys()].sort((a, c) => share(hatchesByThird[2], c) - share(hatchesByThird[2], a))) {
  console.log(`    ${b.padEnd(20)} ${hatchesByThird.map((m) => pct(share(m, b))).join(' → ')}`);
}
console.log('\n── Styles: tamers\' win rate, and champions raised ──');
for (const [s, f] of [...styleFights].sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n)) {
  console.log(`  ${rateWithMargin(f.w, f.n)}  ${s.padEnd(15)} champions ${styleChampions.get(s) ?? 0}`);
}
console.log('\n── Skill: win rate of tamers\' dragons by their tamer\'s skill (they meet their own rung) ──');
for (const s of SKILL_AT) if (skillFights.get(s)) console.log(`  ${rateWithMargin(skillFights.get(s)!.w, skillFights.get(s)!.n)}  ${s}`);
const list = (m: Map<string, number>) => '  ' + [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ');
console.log(`\n── Spoils: ${total(spoilPicks)} seated, ${total(frozen)} frozen from Ichor, ${banks} banked (melted to chase) ──`);
console.log('  Seated from the spoils:');
console.log(list(spoilPicks));
console.log('  Frozen from Ichor:');
console.log(list(frozen));
console.log('  Melted:');
console.log(list(melted));
const ichors = tamers.map((t) => t.ichor);
console.log(`  Ichor held at the end: ${ichors.reduce((a, b) => a + b, 0)} across ${ichors.filter((x) => x > 0).length} tamers (most ${Math.max(...ichors)}).`);
console.log(`\n── Hall of champions (${hall.length}) ──`);
for (const h of hall) console.log('  ' + h);

const card = (t: Tamer) => {
  const d = t.dragon;
  return [
    `### ${t.name}`,
    '',
    '| | |',
    '|---|---|',
    `| Tamer ID | DT-${String(t.id).padStart(4, '0')} |`,
    `| Style | ${t.style} |`,
    `| Skill | ${skillOf(t)} (best rung ${t.best}) |`,
    `| Record | ${t.wins}–${t.losses} |`,
    `| Ichor | ${t.ichor} |`,
    `| Dragons hatched | ${t.hatched}, lost ${t.losses} |`,
    `| Champions | ${t.champions.length ? t.champions.join('; ') : 'none yet'} |`,
    `| Current dragon | ${d ? `${d.name} (${kit(d.setup)}), rung ${d.pips}, streak ${d.streak}, ${d.wins}–0` : 'none'} |`,
    `| Favored builds | ${[...t.prefs].sort((a, b) => (b[1].w - 4 * b[1].d) - (a[1].w - 4 * a[1].d)).slice(0, 3).map(([k, p]) => `${k} (${p.w} wins, ${p.d} deaths)`).join('; ')} |`,
    '',
    '**Match history**',
    '',
    ...t.history.map((h) => `- ${h}`),
    '',
  ].join('\n');
};
const chosen = tamers[0];
const decorated = [...tamers].sort((a, b) => b.champions.length - a.champions.length || b.wins - a.wins)[0];
console.log(`\nChosen tamer: ${chosen.name} (${chosen.style}), ${chosen.wins}–${chosen.losses}, ${chosen.hatched} dragons, ${chosen.champions.length} champions.`);
console.log(`Most decorated: ${decorated.name} (${decorated.style}), ${decorated.wins}–${decorated.losses}, ${decorated.hatched} dragons, ${decorated.champions.length} champions.`);
if (cardsFile) {
  writeFileSync(cardsFile, `# Living ladder: tamer cards\n\nSeed ${seed}, ${TAMERS} tamers, ${ROUNDS} rounds.\n\n## The chosen tamer\n\n${card(chosen)}\n## The most decorated tamer\n\n${decorated === chosen ? 'The chosen tamer.\n' : card(decorated)}`);
  console.log(`Wrote ${cardsFile}.`);
}
if (jsonFile) {
  const obj = <V>(m: Map<string, V>) => Object.fromEntries(m);
  writeFileSync(jsonFile, JSON.stringify({
    seed, tamers: TAMERS, rounds: ROUNDS, bouts, endings: ends, hatches: obj(hatches), climbed: obj(climbed), champions: obj(championBuilds),
    buildFights: obj(buildFights), rungFights: rungFights.map(obj), rungField: rungField.map(obj), hatchesByThird: hatchesByThird.map(obj),
    styles: obj(styleFights), styleChampions: obj(styleChampions), skills: obj(skillFights), spoils: obj(spoilPicks), frozen: obj(frozen), melted: obj(melted), banks, hall,
  }, null, 1) + '\n');
  console.log(`Wrote ${jsonFile}.`);
}
