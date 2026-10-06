// The hatchery: a brain drafts its egg, bloodstone and shards by its playstyle alone. It scores each option by what
// its style wants, then draws with weighted chance: skill sets how closely it sticks to its style's best pick, and a
// novelty bonus pulls it toward what its style has picked least, so a style explores its plausible builds.

import { hatch, type CoreStone, type Morph, type StatSheet } from '../hatch.ts';
import type { FighterSetup, ShardSetup } from '../referee.ts';
import { shardPool, WYRMLING_PIPS, type Shard } from '../shards.ts';
import { TASTE, type BrainStyle, type Skill } from './styles.ts';

const MORPHS: Morph[] = ['true-dragon', 'wyvern', 'wyrm'];
const STONES: CoreStone[] = ['water', 'earth', 'fire', 'air'];

type Body = 'wounds' | 'evasion' | 'hardness' | 'accuracy' | 'affinity' | 'flies' | 'talons';

/** What each style wants from a body, beyond its attacks: weights on each attribute, compared across the hatchery. */
const BODY_WANTS: Record<BrainStyle, Partial<Record<Body, number>>> = {
  swarmer: { wounds: 1, hardness: 0.3 },
  'out-boxer': { evasion: 1, affinity: 0.5, flies: 0.3 },
  slugger: { hardness: 0.8, wounds: 0.5 },
  counterpuncher: { evasion: 0.8, hardness: 0.6 },
  'boxer-puncher': { wounds: 0.4, evasion: 0.3, hardness: 0.3, accuracy: 0.3, affinity: 0.3 },
  aerialist: { talons: 1.5, flies: 1, evasion: 0.4 },
  reader: { accuracy: 0.5, affinity: 0.5, wounds: 0.3 },
  'claw-focus': { evasion: 0.3 },
  'bite-focus': { hardness: 0.3 },
  'breath-focus': { affinity: 0.5, evasion: 0.3 },
  'meter-focus': { affinity: 1.2 },
  'charge-focus': { wounds: 0.5, hardness: 0.5 },
  'kite-focus': { evasion: 1.2, flies: 0.4 },
};

/** What each Technique serves. Attribute chips serve their attribute. */
type Tag = 'claw' | 'bite' | 'breath' | 'charge' | 'read' | 'air' | 'strafe' | 'approach' | 'guard' | 'dodge' | 'intimidate';
const TECHNIQUE_TAGS: Record<string, Tag[]> = {
  'snapping-jaw': ['bite'], lockjaw: ['bite'], 'gnashing-teeth': ['bite'],
  'hamstring-hooks': ['claw'], 'scything-forelimbs': ['claw'], 'ratchet-claws': ['claw'], 'raking-talons': ['claw'],
  'lance-throat': ['breath'], 'smoldering-maw': ['breath'], 'bellows-chest': ['breath', 'charge'], 'ash-gland': ['breath', 'read'],
  'stooping-pinions': ['air'], 'sidewinder-spine': ['strafe'], 'bounding-haunches': ['approach'],
  thornscale: ['guard'], 'riposte-talons': ['dodge'], 'mantle-wings': ['guard'],
  'sapping-bellow': ['intimidate'], 'baleful-eye': ['intimidate', 'read'], 'goading-roar': ['intimidate'],
};

/** How much each style wants each kind of Technique (attacks come from its taste). */
const TAG_WANTS: Partial<Record<BrainStyle, Partial<Record<Tag, number>>>> = {
  swarmer: { approach: 1 },
  'out-boxer': { strafe: 0.6, charge: 0.6 },
  slugger: { intimidate: 0.8, charge: 0.6 },
  counterpuncher: { guard: 1.2, dodge: 1, strafe: 0.6 },
  aerialist: { air: 1.5 },
  reader: { read: 1.2, intimidate: 1 },
  'claw-focus': { approach: 0.8 },
  'bite-focus': { approach: 0.5 },
  'meter-focus': { guard: 0.8, charge: 0.6 },
  'charge-focus': { charge: 1.5, guard: 0.6 },
  'kite-focus': { strafe: 1, dodge: 0.6 },
};

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

const zscores = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) || 1;
  return xs.map((x) => (x - mean) / sd);
};

/** Rough damage per attempt of the attacks a style likes, as its brains judge a sheet. */
const attackValue = (style: BrainStyle, s: StatSheet) =>
  Math.max(1, s.claw - 4) * 0.68 * TASTE[style].claw + Math.max(1, s.bite - 1) * 0.45 * TASTE[style].bite + Math.max(1, s.breath - 6) * 0.5 * TASTE[style].breath;

const SHEETS = MORPHS.flatMap((morph) => STONES.map((stone) => ({ morph, stone, sheet: hatch(morph, stone) })));
const bodyValue = (s: StatSheet, b: Body) => (b === 'flies' ? (s.flies ? 1 : 0) : b === 'talons' ? (s.aspect === 'talons' ? 1 : 0) : s[b]);

/** How much a style wants each hatched sheet: its attacks plus its body wants, each compared across the hatchery. */
export function sheetScores(style: BrainStyle): number[] {
  const attack = zscores(SHEETS.map((x) => attackValue(style, x.sheet)));
  const score = attack.slice();
  for (const [b, w] of Object.entries(BODY_WANTS[style]) as [Body, number][]) {
    zscores(SHEETS.map((x) => bodyValue(x.sheet, b))).forEach((z, i) => (score[i] += w * z));
  }
  return score;
}

/** How much a style wants a shard on a given sheet. */
export function shardScore(style: BrainStyle, shard: Shard, sheet: StatSheet): number {
  const kind = shard.kind as { family: string; attr?: string; technique?: string };
  if (kind.family === 'technique') {
    const tags = TECHNIQUE_TAGS[kind.technique ?? ''] ?? [];
    if (tags.includes('air') && !sheet.flies) return -2;
    const want = (t: Tag) => (t === 'claw' || t === 'bite' || t === 'breath' ? TASTE[style][t] : TAG_WANTS[style]?.[t] ?? 0.1);
    return 1 * Math.max(...tags.map(want));
  }
  const attr = kind.attr as keyof typeof TASTE.swarmer | Body;
  const want = attr === 'claw' || attr === 'bite' || attr === 'breath' ? TASTE[style][attr] : (BODY_WANTS[style][attr as Body] ?? 0) + 0.2;
  return 0.5 * want;
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
    const options = pool.filter((s) => s.pips <= free.length && !shards.some((x) => x.shard === s.name));
    if (!options.length) break;
    const nov = picks.novelty(style, options.map((s) => `shard|${s.name}`), scale);
    const s = draw(options, options.map((o, i) => shardScore(style, o, sheet) + nov[i]), t, rng);
    picks.add(style, `shard|${s.name}`);
    shards.push({ shard: s.name, grade: s.grade, pips: free.slice(0, s.pips) });
    free = free.slice(s.pips);
  }
  return { name, morph, stone, ...(shards.length ? { shards } : {}) };
}

/** The two shards every slain dragon drops at its age grade [Doc] Spoils: its morph's Body shard and its stone's Bloodstone shard. */
export const DROPS = {
  morph: { 'true-dragon': 'Heartgrit', wyvern: 'Hollow Bones', wyrm: 'Pebblescale' } as Record<Morph, string>,
  stone: { water: 'Weathered Hide', earth: 'Milk Fang', fire: 'Smolder Sac', air: 'Whetted Nail' } as Record<CoreStone, string>,
};


/** Ichor [Doc]: a melted shard yields Ichor by its pips; Ichor freezes into a shard of the tamer's choosing at a higher rate. */
export const ICHOR = { meltPerPip: 1, freezePerPip: 2 };
/** What a banked Ichor is worth to a tamer beyond this pick (a future freeze, a yield's price), in shard-score units. */
const ICHOR_VALUE = 0.3;
/** How far ahead a tamer plans its array, in picks: a novice takes what's best now; a master plans the whole array. */
const PLAN_DEPTH: Record<Skill, number> = { novice: 0, adept: 1, master: 2 };
/** Each further shard serving the same want counts this much less than the one before. */
const DIMINISH = 0.6;

export type SpoilsChoice =
  | { kind: 'seat'; shard: Shard }
  | { kind: 'freeze'; melt: Shard; shard: Shard }
  | { kind: 'bank'; melt: Shard };

/** What a shard mainly serves: a chip its attribute, a Technique the tag its style wants most. */
function wantOf(style: BrainStyle, shard: Shard): string {
  const kind = shard.kind as { family: string; attr?: string; technique?: string };
  if (kind.family !== 'technique') return kind.attr ?? shard.name;
  const tags = TECHNIQUE_TAGS[kind.technique ?? ''] ?? [];
  const want = (t: Tag) => (t === 'claw' || t === 'bite' || t === 'breath' ? TASTE[style][t] : TAG_WANTS[style]?.[t] ?? 0.1);
  return [...tags].sort((a, b) => want(b) - want(a))[0] ?? shard.name;
}

/** A whole array's worth to a style: its shards' scores, each further shard serving the same want counting less. */
export function arrayValue(style: BrainStyle, sheet: StatSheet, shards: Shard[]): number {
  const byWant = new Map<string, number[]>();
  for (const s of shards) byWant.set(wantOf(style, s), [...(byWant.get(wantOf(style, s)) ?? []), shardScore(style, s, sheet)]);
  let v = 0;
  for (const scores of byWant.values()) scores.sort((a, b) => b - a).forEach((x, k) => (v += x * DIMINISH ** k));
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
    const has = new Set(st.seated.map((x) => x.name));
    const fits = (s: Shard) => s.pips <= st.room && !has.has(s.name);
    const score = (s: Shard) => shardScore(style, s, sheet);
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
