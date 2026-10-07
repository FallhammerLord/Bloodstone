// The hatchery: a brain drafts its egg, bloodstone and shards by its archetype alone. It scores each option by its
// archetype's measured results, then draws with weighted chance: skill sets how closely it sticks to its style's best pick, and a
// novelty bonus pulls it toward what its style has picked least, so a style explores its plausible builds.

import { existsSync, readFileSync } from 'node:fs';
import { CORE_MORPHS, hatch, type CoreStone, type Morph, type StatSheet } from '../hatch.ts';
import type { FighterSetup, ShardSetup } from '../referee.ts';
import { shardPool, WYRMLING_PIPS, type Shard } from '../shards.ts';
import type { Archetype as BrainStyle, Skill } from './archetypes.ts';

const MORPHS: Morph[] = CORE_MORPHS;
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];

/** Which Techniques need wings: a fact about the dragon, not a measurement. */
const FLIGHT_TECHNIQUES = new Set(['stooping-pinions']);

/** How loosely each skill picks: a master sticks close to its style's best, a novice wanders. */
const TEMPERATURE: Record<Skill, number> = { novice: 1, adept: 0.6, master: 0.35 };
/** Pips of shards each skill's ladder drafts, all wyrmling grade. */
export const LADDER_PIPS: Record<Skill, number> = { novice: 0, adept: 1, master: WYRMLING_PIPS };
/** How strongly a style is pulled toward what it has picked least. */
const NOVELTY = 1.5;

/** Counts of each style's picks so far this tournament, for the novelty bonus. */
export class Picks {
  private counts = new Map<string, number>();
  count(style: BrainStyle, key: string) {
    return this.counts.get(`${style}|${key}`) ?? 0;
  }
  add(style: BrainStyle, key: string) {
    this.counts.set(`${style}|${key}`, this.count(style, key) + 1);
  }
  /** A bonus for keys this style has picked less than its most-picked option, scaled (a tamer's novelty fades). */
  novelty(style: BrainStyle, keys: string[], scale = 1): number[] {
    const c = keys.map((k) => this.count(style, k));
    const top = Math.max(...c);
    return c.map((n) => scale * NOVELTY * (1 - n / (top + 1)));
  }
}

const SHEETS = MORPHS.flatMap((morph) => STONES.map((stone) => ({ morph, stone, sheet: hatch(morph, stone) })));

/**
 * What drafting brains know (npm run measure): each style's measured win rate on each sheet, and its measured
 * win-rate change from each shard. With the table, brains draft on results; without it, evenly (novelty still spreads them).
 */
interface Measured {
  sheets: Record<string, Record<string, number>>;
  shards: Record<string, Record<string, number>>;
}
const MEASURED_FILE = new URL('./measured.json', import.meta.url);
export const MEASURED: Measured | null = existsSync(MEASURED_FILE) ? JSON.parse(readFileSync(MEASURED_FILE, 'utf8')) : null;
/** Score units per unit of measured win rate: a sheet 10 points above even scores 1.2; a shard worth +5 points, 0.6. */
const MEASURED_SCALE = 12;

/** How much a style wants each hatched sheet: its measured win rate there. Without a table, every sheet is even. */
export function sheetScores(style: BrainStyle): number[] {
  const m = MEASURED?.sheets[style];
  return SHEETS.map((x) => (m ? MEASURED_SCALE * ((m[`${x.morph} + ${x.stone}`] ?? 0.5) - 0.5) : 0));
}

/** A measured row's name: the shard, or a stack of it ("Coiled Sinew ×2"). */
const stackName = (name: string, k: number) => (k === 1 ? name : `${name} ×${k}`);
const isTechnique = (s: Shard) => (s.kind as { family: string }).family === 'technique';

/** Attribute shards stack as far as the array's shape permits; a Technique never duplicates. */
export function canAdd(seated: { name: string }[], s: Shard): boolean {
  return !isTechnique(s) || !seated.some((x) => x.name === s.name);
}

/** What a stack of k copies is worth to a style: its measured row, or failing one, k times a single copy. */
function stackWorth(style: BrainStyle, s: Shard, k: number): number {
  if (k <= 0) return 0;
  const row = (n: number) => MEASURED?.shards[style]?.[stackName(s.name, n)];
  for (let n = k; n >= 1; n--) {
    const v = row(n);
    if (v !== undefined) return MEASURED_SCALE * (v + (k - n) * (row(1) ?? 0));
  }
  return 0;
}

/**
 * How much a style wants one more copy of a shard on a given sheet, holding `have` already: the measured gain from the
 * stack it makes. Without a table, every shard is even.
 */
export function shardScore(style: BrainStyle, shard: Shard, sheet: StatSheet, have = 0): number {
  const kind = shard.kind as { family: string; technique?: string };
  // A flight Technique does nothing for a dragon that can't fly: a fact, not a measurement.
  if (kind.family === 'technique' && FLIGHT_TECHNIQUES.has(kind.technique ?? '') && !sheet.flies) return -2;
  return stackWorth(style, shard, have + 1) - stackWorth(style, shard, have);
}

function draw<T>(items: T[], scores: number[], temperature: number, rng: () => number): T {
  const top = Math.max(...scores);
  const w = scores.map((s) => Math.exp((s - top) / temperature));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= w[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** A brain's draft: egg and bloodstone, then wyrmling-grade shards up to its ladder's pips. */
export function draftDragon(
  style: BrainStyle, skill: Skill, rng: () => number, picks: Picks, name: string = style,
  { pips = LADDER_PIPS[skill], bias, novelty: scale = 1 }: { pips?: number; bias?: (build: string) => number; novelty?: number } = {},
): FighterSetup {
  const t = TEMPERATURE[skill];
  const keys = SHEETS.map((x) => `${x.morph} + ${x.stone}`);
  const novelty = picks.novelty(style, keys, scale);
  const base = sheetScores(style);
  const pickIndex = draw(SHEETS.map((_, i) => i), base.map((s, i) => s + novelty[i] + (bias?.(keys[i]) ?? 0)), t, rng);
  const { morph, stone, sheet } = SHEETS[pickIndex];
  picks.add(style, keys[pickIndex]);

  const shards: ShardSetup[] = [];
  let free = Array.from({ length: pips }, (_, i) => i);
  const pool = shardPool('wyrmling');
  while (free.length) {
    const seated = shards.map((x) => ({ name: x.shard }));
    const options = pool.filter((s) => s.pips <= free.length && canAdd(seated, s));
    if (!options.length) break;
    const nov = picks.novelty(style, options.map((s) => `shard|${s.name}`), scale);
    const have = (o: Shard) => seated.filter((x) => x.name === o.name).length;
    const s = draw(options, options.map((o, i) => shardScore(style, o, sheet, have(o)) + nov[i]), t, rng);
    picks.add(style, `shard|${s.name}`);
    shards.push({ shard: s.name, grade: s.grade, pips: free.slice(0, s.pips) });
    free = free.slice(s.pips);
  }
  return { name, morph, stone, ...(shards.length ? { shards } : {}) };
}

/** The two shards every slain dragon drops at its age grade [Doc] Spoils: its morph's Body shard and its stone's Bloodstone shard. */
export const DROPS = {
  morph: { 'true-dragon': 'Heartgrit', wyvern: 'Coiled Sinew', wyrm: 'Pebblescale', drake: 'Coiled Sinew' } as Record<Morph, string>,
  stone: { water: 'Weathered Hide', earth: 'Milk Fang', fire: 'Smolder Sac', air: 'Whetted Nail' } as Record<CoreStone, string>,
};


/** Ichor [Doc]: a melted shard yields Ichor by its pips; Ichor freezes into a shard of the tamer's choosing at a higher rate. */
export const ICHOR = { meltPerPip: 1, freezePerPip: 2 };
/** What a banked Ichor is worth to a tamer beyond this pick (a future freeze, a yield's price), in shard-score units. */
const ICHOR_VALUE = 0.3;
/** How far ahead a tamer plans its array, in picks: a novice takes what's best now; a master plans the whole array. */
const PLAN_DEPTH: Record<Skill, number> = { novice: 0, adept: 1, master: 2 };

export type SpoilsChoice =
  | { kind: 'seat'; shard: Shard }
  | { kind: 'freeze'; melt: Shard; shard: Shard }
  | { kind: 'bank'; melt: Shard };

/** A whole array's worth to a style: each stack at its measured worth, each Technique at its own. */
export function arrayValue(style: BrainStyle, sheet: StatSheet, shards: Shard[]): number {
  const counts = new Map<string, { s: Shard; k: number }>();
  for (const s of shards) counts.set(s.name, { s, k: (counts.get(s.name)?.k ?? 0) + 1 });
  let v = 0;
  for (const { s, k } of counts.values()) v += isTechnique(s) ? shardScore(style, s, sheet) : stackWorth(style, s, k);
  return v;
}

interface PlanState {
  seated: Shard[];
  room: number;
  ichor: number;
}

/** The spoils situation a victor plans with. */
export interface Spoils {
  /** what this victim offers: its two generated drops and its intact array */
  offer: Shard[];
  /** the dragon's seated shards and its free pips */
  seated: Shard[];
  room: number;
  /** the tamer's Ichor */
  ichor: number;
  /** the chance this dragon reaches its next pick: three straight wins */
  reach: number;
  /** what the next victims are likely to offer: samples drawn from the field on its rung */
  likely: Shard[][];
}

/**
 * A victor's spoils pick, planned as an array [Proposed]. It can seat a shard on offer; melt one into its tamer's
 * Ichor and freeze a shard of its choosing (seating that); or melt and bank, staying on its rung. A tamer works with
 * what it has: it scores each choice by the best array it leads to, counting later picks only as likely as its dragon
 * is to reach them, and only for what the field is likely to offer. Banked Ichor keeps a little worth of its own (a
 * future freeze, a yield's price). Skill sets how far ahead it plans; it draws at its temperature.
 */
export function chooseSpoils(style: BrainStyle, skill: Skill, sheet: StatSheet, sp: Spoils, rng: () => number): SpoilsChoice | null {
  if (!sp.offer.length) return null;
  const catalog = shardPool('wyrmling');
  const worth = (st: PlanState) => arrayValue(style, sheet, st.seated) + ICHOR_VALUE * st.ichor;
  // Looking ahead, only the few best freezes are worth imagining.
  const moves = (st: PlanState, offer: Shard[], ahead = false): [SpoilsChoice, PlanState][] => {
    const fits = (s: Shard) => s.pips <= st.room && canAdd(st.seated, s);
    const score = (s: Shard) => shardScore(style, s, sheet, st.seated.filter((x) => x.name === s.name).length);
    const melt = [...offer].sort((a, b) => b.pips - a.pips || score(a) - score(b))[0];
    const bank = st.ichor + ICHOR.meltPerPip * melt.pips;
    const out: [SpoilsChoice, PlanState][] = [];
    for (const s of offer.filter(fits)) out.push([{ kind: 'seat', shard: s }, { seated: [...st.seated, s], room: st.room - s.pips, ichor: st.ichor }]);
    const freezable = catalog.filter((x) => fits(x) && ICHOR.freezePerPip * x.pips <= bank && !offer.some((o) => o.name === x.name));
    for (const s of ahead ? freezable.sort((a, b) => score(b) - score(a)).slice(0, 3) : freezable) {
      out.push([{ kind: 'freeze', melt, shard: s }, { seated: [...st.seated, s], room: st.room - s.pips, ichor: bank - ICHOR.freezePerPip * s.pips }]);
    }
    out.push([{ kind: 'bank', melt }, { ...st, ichor: bank }]);
    return out;
  };
  // What a state is worth, looking `depth` picks ahead over the likely offers.
  const future = (st: PlanState, depth: number): number => {
    const now = worth(st);
    if (depth === 0 || st.room === 0 || !sp.likely.length) return now;
    let gain = 0;
    for (const offer of sp.likely) gain += Math.max(0, Math.max(...moves(st, offer, true).map(([, next]) => future(next, depth - 1))) - now);
    return now + sp.reach * (gain / sp.likely.length);
  };
  const options = moves({ seated: sp.seated, room: sp.room, ichor: sp.ichor }, sp.offer);
  return draw(options.map(([c]) => c), options.map(([, st]) => future(st, PLAN_DEPTH[skill])), TEMPERATURE[skill], rng);
}
