// Dragons and the bout: what a fighter carries between slots, and how a bout begins.

import type { ActionName } from '../actions.ts';
import { hatch, type StatSheet } from '../hatch.ts';
import { vec, type Vec } from '../geometry.ts';
import { makeArena, type Arena, type ArenaSetup } from '../arena.ts';
import { compile, emptyArray, findShard, gradeRank, seat, type Grade, type Loadout, type TechniqueId } from '../shards.ts';
import * as R from '../rules.ts';
import { DEFAULT_RULES, type Rules } from '../rules.ts';

export type Side = 'A' | 'B';
export const SIDES: readonly Side[] = ['A', 'B'];
export const other = (s: Side): Side => (s === 'A' ? 'B' : 'A');

export interface Statuses {
  pinned: boolean;
  staggered: boolean;
  rattled: boolean;
  blinded: boolean;
  /** Hardness lowered after ending a slot in a corrosive pool [Assumed] */
  corroded: boolean;
  /** Hamstring Hooks Elder: moves complete 3 ticks later */
  slowed: boolean;
  /** Hamstring Hooks Venerable: can't Leap */
  grounded: boolean;
}
export const noStatuses = (): Statuses => ({ pinned: false, staggered: false, rattled: false, blinded: false, corroded: false, slowed: false, grounded: false });

/** Lingering effects of Techniques, carried between slots. All visible on the board. */
export interface Marks {
  /** Lockjaw Venerable: a Bite next slot, against the Pinned target, gains +3 */
  lockjawFollow: boolean;
  /** Sapping Bellow on this dragon: its next chain bonus is stripped */
  sapped: 'claw' | 'any' | null;
  /** Goading Roar on this dragon: a Retreat next slot (or Dodge, from an Elder roar) stings; the grade rank */
  goaded: number | null;
  /** Stooping Pinions: +3 to the next attack; and the next slot can't Leap */
  diveBonus: boolean;
  noLeap: boolean;
  /** Bounding Haunches Elder: next Bite or Claw winds up 3 faster. Sidewinder Elder: next wind-up of any kind. */
  quick: 'strike' | 'any' | null;
  /** Ash Gland: this dragon can't revise during this exchange */
  revisionLockedFor: number;
  /** Baleful Eye: this exchange's reveal, by grade rank */
  eye: number | null;
  /** a charge on the board: it releases next slot. Visible to both sides. */
  charge: { action: 'bite' | 'breath'; sweep?: 'left' | 'right'; slots: number } | null;
  /** an Approach that moved last slot: the next Bite lunges [Proposed] */
  advanced: boolean;
  /** a Strafe that moved last slot: the next Claw pounces [Proposed] */
  strafed: boolean;
  /** aloft when this exchange began: only then can a Wyvern stoop [Proposed] */
  aloftAtStart: boolean;
  /** an opponent's Intimidate reached: the next Bite or Claw loses 3 [Proposed] */
  demoralized: boolean;
  /** the exchange this dragon last crunched in: one crunch per exchange [Proposed] */
  crunchedIn: number;
  /** Earth's corrosion [Proposed]: each hit taken through slot `until` deals `bonus` more */
  corrosion: { bonus: number; until: number } | null;
  /** Stomp caught it mid-move [Proposed]: Staggered for this many slots more after the next */
  staggerExtra: number;
}
export const noMarks = (): Marks => ({ lockjawFollow: false, sapped: null, goaded: null, diveBonus: false, noLeap: false, quick: null, revisionLockedFor: 0, eye: null, charge: null, advanced: false, strafed: false, aloftAtStart: false, demoralized: false, crunchedIn: -1, corrosion: null, staggerExtra: 0 });

export interface Chain {
  action: ActionName | null;
  /** links landed so far */
  links: number;
  /** a hit landed this exchange (any attack) */
  hitThisExchange: boolean;
  /** guarded with Scales this exchange (a Wyrmling Ratchet Claws needs it) */
  scalesThisExchange: boolean;
  /** times Ratchet Claws carried this chain through a hitless exchange */
  saves: number;
  /** the next Claw resumes a saved chain (Ratchet Claws Elder: winds up faster) */
  resumed: boolean;
}
export const noChain = (): Chain => ({ action: null, links: 0, hitThisExchange: false, scalesThisExchange: false, saves: 0, resumed: false });

// Grade ranks, for reading technique terms.
export const W = 0, J = 1, A = 2, E = 3, V = 4;
/** The grade rank a dragon holds a Technique at, or -1. */
export const tech = (f: Fighter, id: TechniqueId): number => {
  const t = f.loadout.techniques.find((x) => x.id === id);
  return t ? gradeRank(t.grade) : -1;
};

export interface Fighter {
  side: Side;
  name: string;
  sheet: StatSheet;
  /** seated shards: conditional riders and techniques */
  loadout: Loadout;
  pos: Vec;
  wounds: number;
  meter: number;
  /** global slot number when each cooldown action is usable again */
  readyAt: Partial<Record<ActionName, number>>;
  /** statuses in force this slot, and those landing next slot */
  status: Statuses;
  pending: Statuses;
  intimidateBonus: boolean;
  /**
   * The current chain: repeating an attack builds it, one landed link at a time. Other actions don't break it;
   * a different attack starts a new one. It lapses only when a whole exchange passes without a landed hit.
   */
  chain: Chain;
  marks: Marks;
  /** hit by a rim pulse this bout */
  pulsed: boolean;
}

export interface Bout {
  fighters: Record<Side, Fighter>;
  /** wins a double KO [Proposed] */
  challenged: Side;
  exchange: number;
  globalSlot: number;
  /** Wounds when the current exchange began, so controllers can see who was hit */
  startWounds: Record<Side, number>;
  /** every action each side has used, in order; public, since everyone watched it happen */
  history: Record<Side, ActionName[]>;
  /** one entry per slot: where each dragon stood when it began and what each did; public, for reading habits */
  record: SlotRecord[];
  arena: Arena;
  /** the dials this bout plays by; shared, never cloned or changed mid-bout */
  rules: Rules;
  over: boolean;
  winner: Side | null;
}

export interface ShardSetup {
  shard: string;
  /** Techniques need a grade; Body and Bloodstone names carry theirs */
  grade?: Grade;
  pips: number[];
}

export interface SlotRecord {
  exchange: number;
  /** 0, 1 or 2 */
  slot: number;
  /** separation and altitudes when the slot began */
  separation: number;
  z: Record<Side, number>;
  /** each side's Wounds when the slot began */
  wounds: Record<Side, number>;
  actions: Record<Side, ActionName>;
  landed: Record<Side, boolean>;
  /** whether each side's Breath was off cooldown when the slot began */
  breathReady: Record<Side, boolean>;
  /** whether each side's Acumen meter was full when the slot began */
  meterFull?: Record<Side, boolean>;
}

export interface FighterSetup {
  name: string;
  morph: StatSheet['morph'];
  stone: StatSheet['stone'];
  /** seated in order; a later shard over an earlier one damages or destroys it */
  shards?: ShardSetup[];
}

/** Hatches the dragon and seats its shards. */
export function buildSheet(setup: FighterSetup): { sheet: StatSheet; loadout: Loadout; notes: string[] } {
  const array = emptyArray();
  const notes: string[] = [];
  for (const s of setup.shards ?? []) notes.push(...seat(array, findShard(s.shard, s.grade), s.pips));
  const { sheet, loadout } = compile(hatch(setup.morph, setup.stone), array);
  loadout.seating = notes;
  return { sheet, loadout, notes };
}

/** Separation is in paces (decimals allowed). A stands west of B, facing east. */
export function newBout(a: FighterSetup, b: FighterSetup, separationPaces: number, challenged: Side = 'B', arena: ArenaSetup = {}, rules: Rules = DEFAULT_RULES): Bout {
  const half = Math.round((separationPaces * R.PACE) / 2);
  const make = (side: Side, setup: FighterSetup, x: number): Fighter => {
    const { sheet, loadout } = buildSheet(setup);
    return {
      side, name: setup.name, sheet, loadout, pos: vec(x, 0),
      wounds: sheet.wounds, meter: Math.min(R.METER_MAX, rules.AGE_BRACKET[sheet.age] * rules.METER_START_PER_AGE + 3 * sheet.affinity), readyAt: {},
      status: noStatuses(), pending: noStatuses(), intimidateBonus: false,
      chain: noChain(), marks: noMarks(), pulsed: false,
    };
  };
  const fighters = { A: make('A', a, -half), B: make('B', b, half) };
  return {
    fighters,
    arena: makeArena(arena, [fighters.A.pos, fighters.B.pos], rules),
    rules,
    challenged, exchange: 0, globalSlot: 0, over: false, winner: null,
    startWounds: { A: 0, B: 0 }, history: { A: [], B: [] }, record: [],
  };
}

/** Whether this dragon is corroded in global slot g. */
export const corroded = (f: Fighter, g: number) => f.marks.corrosion !== null && f.marks.corrosion.until >= g;

/**
 * A copy for imagining futures, fast: it copies what the Referee changes and shares what it only replaces or
 * appends to (stat sheets, loadouts, positions, the slot record's entries, zones, the rules). The golden masters
 * check it against a full deep copy's results.
 */
export function cloneBout(b: Bout): Bout {
  const fighter = (f: Fighter): Fighter => ({
    ...f,
    readyAt: { ...f.readyAt },
    status: { ...f.status },
    pending: { ...f.pending },
    chain: { ...f.chain },
    marks: { ...f.marks, charge: f.marks.charge && { ...f.marks.charge } },
  });
  return {
    ...b,
    fighters: { A: fighter(b.fighters.A), B: fighter(b.fighters.B) },
    startWounds: { ...b.startWounds },
    history: { A: [...b.history.A], B: [...b.history.B] },
    record: [...b.record],
    arena: { obstacles: b.arena.obstacles.map((o) => ({ ...o })), zones: [...b.arena.zones] },
  };
}
