// The living ladder: a population of tamers, each raising one wyrmling at a time. A dragon fights dragons on its own
// rung (its pips of shards) until it wins or dies; three straight wins earn a pick from the last victim's spoils and
// a step up. A full three-pip array makes a wyrmling champion, who retires. A dead or retired dragon's tamer hatches
// another. Tamers learn: skill rises with the best rung they've reached, and their drafts lean toward builds that
// have won for them and away from builds that died, on curves: novelty fades as a tamer hatches more dragons, and a
// build's record counts for more the more fights it has. At a spoils pick a tamer can seat a shard, or melt one into
// Ichor (the tamer's, surviving its dragons) and freeze a shard of its choosing, or bank the Ichor and keep chasing;
// it plans the whole array, working with what the field is likely to offer and its odds of living to the next pick.
// Yields [Proposed]: before a bout or at an exchange boundary a tamer may yield to save its dragon, paying the victor
// Ichor by the ladder (novice 1, adept 2, master 3), or a shard from its array when short. Timeouts don't kill
// either: the victor is paid the same Ichor. A yield or timeout counts toward the victor's streak; a pick it earns
// waits for the next kill, since only a slain dragon leaves spoils.
//   npm run gauntlet [-- --tamers N] [--rounds N] [--seed N] [--json file] [--cards file] [--carry file] [--save file]
// Seasons: --save writes every tamer's state at the end; --carry reads a saved roster and keeps its champion tamers
// (any tamer who raised a champion) for this season, rerolling the rest fresh.

import { readFileSync, writeFileSync } from 'node:fs';
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
const carryFile = flag(argv, '--carry', '');
const saveFile = flag(argv, '--save', '');
const kills = Number(flag(argv, '--kills', '3'));
const STREAK = kills;
/** A yield's price, and a timeout's purse, in Ichor: one per skill rank of the ladder (rung) the dragon is on. */
const priceAt = (rung: number) => Math.min(rung, 2) + 1;
/** A dragon's worth to its tamer, in Ichor: its seated pips at freeze price, plus its streak toward the next pick. */
const PICK_ICHOR = 2;
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

/** What a tamer carries between seasons. Their dragons don't: every season hatches fresh. */
interface SavedTamer {
  name: string;
  style: BrainStyle;
  best: number;
  wins: number;
  losses: number;
  hatched: number;
  ichor: number;
  champions: string[];
  prefs: Record<string, { w: number; d: number }>;
}
// Last season's champion tamers return: those who raised a champion in the saved season.
const carried = carryFile ? JSON.parse(readFileSync(carryFile, 'utf8')) as { season?: number; tamers: SavedTamer[] } : null;
const lastSeason = carried?.season ?? 1;
const SEASON = carried ? lastSeason + 1 : 1;
const veterans: SavedTamer[] = carried ? carried.tamers.filter((t) => t.champions.some((c) => c.includes(`season ${lastSeason}`))) : [];
const tamers: Tamer[] = Array.from({ length: Math.max(TAMERS, veterans.length) }, (_, id) => {
  const v = veterans[id];
  return {
    id, name: v?.name ?? `${name(2)} ${name(1)}`, style: v?.style ?? BRAIN_STYLES[id % BRAIN_STYLES.length], best: v?.best ?? 0,
    wins: v?.wins ?? 0, losses: v?.losses ?? 0, hatched: v?.hatched ?? 0, champions: v ? [...v.champions] : [],
    prefs: new Map(Object.entries(v?.prefs ?? {})), picks: new Picks(), ichor: v?.ichor ?? 0,
    history: v ? [`Veteran: carries ${v.wins}–${v.losses}, ${v.hatched} dragons, ${v.champions.length} champion${v.champions.length === 1 ? '' : 's'}, ${v.ichor} Ichor.`] : [],
    dragon: null, graveyard: [],
  };
});
const isVeteran = (t: Tamer) => t.id < veterans.length;
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
const matchups = new Map<string, Rate>();
const yields = { before: 0, during: 0, ichor: 0, ransom: 0, paid: 0 };
const timeoutPurse = { paid: 0, minted: 0 };
const yieldsBySkill = new Map<string, number>();
const melted = new Map<string, number>();
const frozen = new Map<string, number>();
let banks = 0;
const hall: string[] = [];
const ends = { ko: 0, pulse: 0, timeout: 0, yield: 0 };
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
type Side_ = { tamer: Tamer | null; setup: FighterSetup; style: BrainStyle; skill: Skill; pips: number };
/** A shard list for a setup. */
const shardList = (f: FighterSetup) => (f.shards ?? []).map((x) => findShard(x.shard, x.grade));
/** Reseats an array from pip 0 after a shard leaves it. */
const reseat = (shards: Shard[]): FighterSetup['shards'] => {
  let at = 0;
  return shards.map((sh) => ({ shard: sh.name, grade: sh.grade, pips: Array.from({ length: sh.pips }, () => at++) }));
};
const worthOf = (d: Dragon) => PICK_ICHOR * d.pips + (PICK_ICHOR * Math.min(d.streak, STREAK)) / STREAK + 0.5;
/** Can this tamer pay a yield's price, in Ichor or a shard? */
const canPay = (t: Tamer, d: Dragon) => t.ichor >= priceAt(d.pips) || d.pips > 0;
/** The chance a dragon of this build beats that one, as the tamer reads it: masters by matchup, adepts by build. */
function odds(me: Side_, them: Side_): number {
  const shrink = (r: Rate | undefined) => (r ? (r.w + 2) / (r.n + 4) : 0.5);
  if (me.skill === 'master') return shrink(matchups.get(`${buildOf(me.setup)}|${buildOf(them.setup)}`));
  const mine = shrink(rungFights[me.pips].get(buildOf(me.setup))), theirs = shrink(rungFights[me.pips].get(buildOf(them.setup)));
  return mine / (mine + theirs);
}
/** A tamer's pre-bout yield: when its dragon's expected loss outweighs the price and what a win would bring. */
function yieldsBefore(s: Side_, them: Side_): boolean {
  if (!s.tamer || s.skill === 'novice' || !canPay(s.tamer, s.tamer.dragon!)) return false;
  const lose = 1 - odds(s, them);
  return lose * worthOf(s.tamer.dragon!) - (1 - lose) * (PICK_ICHOR / STREAK + priceAt(s.pips)) > priceAt(s.pips);
}
/** The chance a dragon reaches its next pick: three straight wins at its build's rate on its rung, its own record leaning in. */
function reachOf(t: Tamer, d: Dragon): number {
  const r = rungFights[Math.min(d.pips, 2)].get(d.build);
  const base = r ? (r.w + 2) / (r.n + 4) : 0.5;
  const p = (d.wins + 4 * base) / (d.wins + d.losses + 4);
  return p ** STREAK;
}
/** What the next victims on a rung are likely to drop: a few draws from the field there. */
function likelyOffers(rung: number): Shard[][] {
  const field = [...rungField[Math.min(rung, 2)]];
  const total = field.reduce((a, [, n]) => a + n, 0);
  if (!total) return [];
  return Array.from({ length: 3 }, () => {
    let x = rng() * total;
    const [b] = field.find(([, n]) => (x -= n) <= 0) ?? field[field.length - 1];
    const [morph, stone] = b.split(' + ') as [FighterSetup['morph'], FighterSetup['stone']];
    return [findShard(DROPS.morph[morph], 'wyrmling'), findShard(DROPS.stone[stone], 'wyrmling')];
  });
}

/** What a slain dragon leaves: its morph's and its stone's generated drops, and its intact array. */
const spoilsOf = (f: FighterSetup): Shard[] => [findShard(DROPS.morph[f.morph], 'wyrmling'), findShard(DROPS.stone[f.stone], 'wyrmling'), ...shardList(f)]
  .filter((sh, k, all) => all.findIndex((x) => x.name === sh.name) === k);

/** A pick from an offer (a slain dragon's spoils, or a yielder's array as ransom), planned as an array. Returns the shard taken. */
function spoilsPick(t: Tamer, d: Dragon, spoils: Shard[], round: number, source = 'the spoils'): Shard | null {
  const choice = chooseSpoils(t.style, skillOf(t), hatch(d.setup.morph, d.setup.stone), {
    offer: spoils, seated: shardList(d.setup), room: WYRMLING_PIPS - d.pips, ichor: t.ichor, reach: reachOf(t, d), likely: likelyOffers(d.pips),
  }, rng);
  const offer = `${source}: ${spoils.map((x) => x.name).join(', ')}`;
  let seat: Shard | null = null;
  if (choice?.kind === 'seat') {
    seat = choice.shard;
    count(spoilPicks, seat.name);
    t.history.push(`R${round} · ◆ ${d.name} takes ${seat.name} from ${offer}.`);
  } else if (choice) {
    t.ichor += ICHOR.meltPerPip * choice.melt.pips;
    count(melted, choice.melt.name);
    if (choice.kind === 'freeze') {
      seat = choice.shard;
      t.ichor -= ICHOR.freezePerPip * seat.pips;
      count(frozen, seat.name);
      t.history.push(`R${round} · ❄ ${d.name} melts ${choice.melt.name} from ${offer} and freezes ${seat.name} from ${t.name}'s Ichor (${t.ichor} left).`);
    } else {
      banks++;
      t.history.push(`R${round} · ♨ ${d.name} melts ${choice.melt.name} from ${offer} and banks it: ${t.name} holds ${t.ichor} Ichor. It stays on rung ${d.pips}.`);
    }
  }
  if (seat) {
    d.setup = { ...d.setup, shards: reseat([...shardList(d.setup), seat]) };
    if (d.pips === 0) count(climbed, d.build);
    d.pips += seat.pips;
    const was = skillOf(t);
    t.best = Math.max(t.best, d.pips);
    if (skillOf(t) !== was) t.history.push(`R${round} · ${t.name} is now ${skillOf(t)}.`);
  }
  if (d.pips >= WYRMLING_PIPS) {
    t.champions.push(`${d.name} (${kit(d.setup)}), ${d.wins}–${d.losses}, season ${SEASON} round ${round}`);
    count(championBuilds, d.build);
    count(styleChampions, t.style);
    hall.push(`R${round}  ${d.name.padEnd(12)} ${kit(d.setup).padEnd(62)} ${t.name} (${t.style}), dragon #${d.nth}, ${d.wins}–${d.losses}`);
    t.history.push(`R${round} · ★ ${d.name} becomes a wyrmling champion and retires.`);
    t.dragon = null;
  }
  return choice ? (choice.kind === 'seat' ? choice.shard : choice.melt) : null;
}

/** A ransom leaves the yielder's array; the dragon drops to the rung its pips now make. */
function takeFrom(d: Dragon, t: Tamer, shard: Shard, round: number) {
  d.setup = { ...d.setup, shards: reseat(shardList(d.setup).filter((x) => x.name !== shard.name)) };
  d.pips -= shard.pips;
  t.history.push(`R${round} · ⚑ ${d.name} lives, paying ${shard.name} from its array as ransom; it drops to rung ${d.pips}.`);
}

for (let round = 1; round <= ROUNDS; round++) {
  for (const t of tamers) if (!t.dragon) hatchFor(t, round);
  // Each rung pairs its dragons at random; an odd one out meets an unclaimed dragon of its rung.
  const pairs: [Side_, Side_][] = [];
  for (let rung = 0; rung < WYRMLING_PIPS; rung++) {
    const here = shuffle(tamers.filter((t) => t.dragon!.pips === rung));
    const side = (t: Tamer): Side_ => ({ tamer: t, setup: t.dragon!.setup, style: t.style, skill: skillOf(t), pips: rung });
    for (let i = 0; i + 1 < here.length; i += 2) pairs.push([side(here[i]), side(here[i + 1])]);
    if (here.length % 2) {
      const style = pick(BRAIN_STYLES);
      const setup = draftDragon(style, skillAt(rung), rng, wildPicks, `an unclaimed ${style}'s ${dragonName()}`, { pips: rung });
      pairs.push([side(here[here.length - 1]), { tamer: null, setup, style, skill: skillAt(rung), pips: rung }]);
    }
  }
  // Before the bout, each tamer sees the other dragon and may yield.
  const challenged = pairs.map((): Side => (rng() < 0.5 ? 'A' : 'B'));
  const early = pairs.map(([a, b], i): Side | null => {
    const ya = yieldsBefore(a, b), yb = yieldsBefore(b, a);
    return ya && yb ? (challenged[i] === 'A' ? 'B' : 'A') : ya ? 'A' : yb ? 'B' : null;
  });
  const policy = (s: Side_) => (s.tamer && canPay(s.tamer, s.tamer.dragon!)
    ? { value: worthOf(s.tamer.dragon!), gain: PICK_ICHOR / STREAK + priceAt(s.pips), price: priceAt(s.pips) } : undefined);
  const jobs: Job[] = pairs.flatMap(([a, b], i) => (early[i] ? [] : [{
    id: i, group: 'gauntlet', A: a.setup, B: b.setup,
    playerA: { kind: 'brain', style: a.style, skill: a.skill, seed: bouts * 2 + i * 2 + seed },
    playerB: { kind: 'brain', style: b.style, skill: b.skill, seed: bouts * 2 + i * 2 + 1 + seed },
    challenged: challenged[i], arenaSeed: (bouts + i) * 31 + 7 + seed, yieldA: policy(a), yieldB: policy(b),
  } satisfies Job]));
  const results: Result[] = (await inWorkers<Result[]>(new URL('./brains-worker.ts', import.meta.url), { jobs })).flat();
  const byId = new Map(results.map((r) => [r.id, r]));

  for (const [i, pair] of pairs.entries()) {
    const r = byId.get(i);
    const ending = r ? r.ending : 'yield';
    const winSide: Side = r ? r.winner : early[i] === 'A' ? 'B' : 'A';
    if (r) ends[r.ending]++;
    else yields.before++;
    if (r?.ending === 'yield') yields.during++;
    const how = !r ? 'yielded before the bout' : `${{ ko: 'KO', pulse: 'rim pulse', timeout: 'timeout', yield: 'yield' }[r.ending]} in exchange ${r.exchanges}`;
    const [w, l] = winSide === 'A' ? pair : [pair[1], pair[0]];
    const rung = w.pips;
    for (const s of pair) count(rungField[rung], buildOf(s.setup));
    for (const s of [w, l]) {
      const won = s === w;
      tally(rungFights[rung], buildOf(s.setup), won);
      tally(matchups, `${buildOf(s.setup)}|${buildOf((s === w ? l : w).setup)}`, won);
      if (!s.tamer) continue;
      tally(buildFights, buildOf(s.setup), won);
      tally(styleFights, s.style, won);
      tally(skillFights, s.skill, won);
    }
    const who = (s: Side_) => (s.tamer ? `${s.tamer.name}'s ${s.setup.name}` : s.setup.name);
    const foe = (s: Side_) => `${who(s)} (${kit(s.setup)}; ${s.style}, ${s.skill})`;
    const lethal = ending === 'ko' || ending === 'pulse';
    const price = priceAt(rung);
    let purse = 0;
    let ransomFrom: Dragon | null = null;

    if (l.tamer) {
      const t = l.tamer;
      const d = t.dragon!;
      t.losses++;
      d.losses++;
      pref(t, d.build).d++;
      if (lethal) {
        t.history.push(`R${round} · ✗ ${d.name} (${kit(d.setup)}) falls to ${foe(w)}, ${how}. Record ${d.wins}–${d.losses}.`);
        t.graveyard.push(`${d.name}: ${kit(d.setup)}, ${d.wins} wins, fell in round ${round}`);
        t.dragon = null;
      } else {
        // A yield or a timeout: the dragon lives, its streak resets, and its tamer pays the victor.
        d.streak = 0;
        if (ending === 'yield') count(yieldsBySkill, skillOf(t));
        if (t.ichor >= price || ending === 'timeout') {
          purse = Math.min(t.ichor, price);
          t.ichor -= purse;
          if (ending === 'yield') { yields.ichor++; yields.paid += purse; }
          else { timeoutPurse.paid += purse; timeoutPurse.minted += price - purse; purse = price; }
          t.history.push(`R${round} · ⚑ ${d.name} (${kit(d.setup)}) ${ending === 'timeout' ? 'loses on the clock to' : 'yields to'} ${foe(w)} (${how}) and lives; ${t.name} pays ${Math.min(purse, price)} Ichor (${t.ichor} left).`);
        } else {
          // Short of Ichor: the victor takes a shard of its choosing from the yielder's array as ransom.
          ransomFrom = d;
          yields.ransom++;
        }
      }
    } else if (!lethal) purse = price;
    if (w.tamer) {
      const t = w.tamer;
      const d = t.dragon!;
      t.wins++;
      d.wins++;
      d.streak++;
      pref(t, d.build).w++;
      if (lethal) t.history.push(`R${round} · ✓ ${d.name} slays ${foe(l)}, ${how}. Streak ${d.streak}.`);
      else t.history.push(`R${round} · ✓ ${d.name} beats ${foe(l)} (${how})${ransomFrom ? '' : `, paid ${purse} Ichor`}. Streak ${d.streak}.`);
      t.ichor += purse;
      // A ransom: the victor picks from the yielder's array, to seat or melt.
      if (ransomFrom) {
        const taken = spoilsPick(t, d, shardList(ransomFrom.setup), round, `${who(l)}'s array as ransom`);
        if (taken) takeFrom(ransomFrom, l.tamer!, taken, round);
      }
      // Spoils come only from a slain dragon: a pick the streak earned waits for the next kill.
      if (t.dragon === d && lethal && d.streak >= STREAK) {
        d.streak = 0;
        spoilsPick(t, d, spoilsOf(l.setup), round);
      }
    } else if (ransomFrom) {
      // An unclaimed victor takes the yielder's largest shard.
      takeFrom(ransomFrom, l.tamer!, shardList(ransomFrom.setup).sort((a, b) => b.pips - a.pips)[0], round);
    }
  }
  bouts += pairs.length;
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
console.log(`Season ${SEASON}${veterans.length ? `, with ${veterans.length} champion tamers from season ${lastSeason}` : ''}. Kills per pick: ${STREAK}.`);
console.log(`Endings: ${pct((100 * ends.ko) / bouts)} KO, ${pct((100 * ends.pulse) / bouts)} rim pulse, ${pct((100 * ends.timeout) / bouts)} timeout (non-lethal), ${pct((100 * (ends.yield + yields.before)) / bouts)} yield.`);
console.log(`Yields: ${yields.before} before the bout, ${yields.during} during; ${yields.ichor} paid in Ichor (${yields.paid} in all), ${yields.ransom} in a ransom shard. By skill: ${[...yieldsBySkill].map(([k, n]) => `${k} ${n}`).join(', ')}.`);
console.log(`Timeouts paid ${timeoutPurse.paid + timeoutPurse.minted} Ichor to victors (${timeoutPurse.paid} from the losers' banks).`);
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
if (veterans.length) {
  console.log(`\n── Veterans: last season's ${veterans.length} champion tamers, this season ──`);
  for (const t of tamers.filter(isVeteran)) {
    const before = veterans[t.id];
    const won = t.wins - before.wins, lost = t.losses - before.losses, champs = t.champions.length - before.champions.length;
    console.log(`  ${t.name.padEnd(14)} ${t.style.padEnd(15)} ${String(won).padStart(3)}–${String(lost).padEnd(3)} ${pct((100 * won) / Math.max(1, won + lost))}  champions +${champs}  Ichor ${t.ichor}`);
  }
  const vet = tamers.filter(isVeteran), fresh = tamers.filter((t) => !isVeteran(t));
  const rate = (ts: Tamer[], base: (t: Tamer) => [number, number]) => {
    const [w, n] = ts.reduce(([a, b], t) => { const [x, y] = base(t); return [a + x, b + y]; }, [0, 0]);
    return rateWithMargin(w, n);
  };
  console.log(`  Veterans ${rate(vet, (t) => [t.wins - veterans[t.id].wins, t.wins - veterans[t.id].wins + t.losses - veterans[t.id].losses])}, fresh tamers ${rate(fresh, (t) => [t.wins, t.wins + t.losses])}.`);
}
if (saveFile) {
  const saved: SavedTamer[] = tamers.map((t) => ({ name: t.name, style: t.style, best: t.best, wins: t.wins, losses: t.losses, hatched: t.hatched, ichor: t.ichor, champions: t.champions, prefs: Object.fromEntries(t.prefs) }));
  writeFileSync(saveFile, JSON.stringify({ season: SEASON, seed, tamers: saved }, null, 1) + '\n');
  console.log(`Wrote ${saveFile}.`);
}
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
