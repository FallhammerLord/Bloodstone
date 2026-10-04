// The Referee: two dragons, two scripts, an exact outcome. No drawing, no randomness, integers only.
//
// Per tick, in order [Proposed] §4 Resolution order:
//   1. movement for both dragons
//   2. attacks starting their wind-up lock their aim
//   3. hit detection, evasion tests, near-miss checks
//   4. damage and statuses, applied together
//   5. end-of-window checks (near misses, grazes, Intimidate)
//   6. KO checks
//
// Not modeled yet: crunch, charge, compounds, hazards beyond boulders, claw sweep timing,
// Acumen-scaled punishes, shards, extended morphs.

import { ACTIONS, HOLD, describe, type ActionName, type ActionSpec } from './actions.ts';
import { hatch, matchup, type StatSheet } from './hatch.ts';
import { add, dist, flat, flatLen, isqrt, len, scaleTo, sub, vec, type Vec } from './geometry.ts';
import { describeObstacle, inZone, makeArena, obstacleAt, obstacleOnLine, type Arena, type ArenaSetup, type Obstacle } from './arena.ts';
import { compile, emptyArray, findShard, gradeRank, seat, type Attr, type Condition, type Grade, type Loadout, type TechniqueId } from './shards.ts';
import { inShape, shapeOf } from './shapes.ts';
import * as R from './rules.ts';

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
const noStatuses = (): Statuses => ({ pinned: false, staggered: false, rattled: false, blinded: false, corroded: false, slowed: false, grounded: false });

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
}
const noMarks = (): Marks => ({ lockjawFollow: false, sapped: null, goaded: null, diveBonus: false, noLeap: false, quick: null, revisionLockedFor: 0, eye: null, charge: null, advanced: false, strafed: false });

export interface Chain {
  action: ActionName | null;
  /** links landed so far */
  links: number;
  /** a hit landed this exchange (any attack, grazes included) */
  hitThisExchange: boolean;
  /** guarded with Scales this exchange (a Wyrmling Ratchet Claws needs it) */
  scalesThisExchange: boolean;
  /** times Ratchet Claws carried this chain through a hitless exchange */
  saves: number;
  /** the next Claw resumes a saved chain (Ratchet Claws Elder: winds up faster) */
  resumed: boolean;
}
const noChain = (): Chain => ({ action: null, links: 0, hitThisExchange: false, scalesThisExchange: false, saves: 0, resumed: false });

// Grade ranks, for reading technique terms.
const W = 0, J = 1, A = 2, E = 3, V = 4;
/** The grade rank a dragon holds a Technique at, or -1. */
const tech = (f: Fighter, id: TechniqueId): number => {
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
export function newBout(a: FighterSetup, b: FighterSetup, separationPaces: number, challenged: Side = 'B', arena: ArenaSetup = {}): Bout {
  const half = Math.round((separationPaces * R.PACE) / 2);
  const make = (side: Side, setup: FighterSetup, x: number): Fighter => {
    const { sheet, loadout } = buildSheet(setup);
    return {
      side, name: setup.name, sheet, loadout, pos: vec(x, 0),
      wounds: sheet.wounds, meter: sheet.acumen, readyAt: {},
      status: noStatuses(), pending: noStatuses(), intimidateBonus: false,
      chain: noChain(), marks: noMarks(), pulsed: false,
    };
  };
  const fighters = { A: make('A', a, -half), B: make('B', b, half) };
  return {
    fighters,
    arena: makeArena(arena, [fighters.A.pos, fighters.B.pos]),
    challenged, exchange: 0, globalSlot: 0, over: false, winner: null,
    startWounds: { A: 0, B: 0 }, history: { A: [], B: [] }, record: [],
  };
}

// ---------------------------------------------------------------- events

export interface PlanInfo {
  label: string;
  windup: number;
  active: number;
  recovery: number;
  interruptedAt: number | null;
  /** a crunch: each half's wind-up, active and recovery, 15 ticks apiece */
  halves?: [number, number, number][];
}

export type Event =
  | { kind: 'exchangeStart'; exchange: number }
  | { kind: 'slotStart'; exchange: number; slot: number }
  | { kind: 'note'; tick: number; side: Side; text: string }
  | { kind: 'aim'; tick: number; side: Side; action: ActionName; distance: number }
  | { kind: 'hit'; tick: number; attacker: Side; action: ActionName; damage: number; parts: string[]; interrupt: boolean; graze: boolean; trade: boolean; woundsLeft: number }
  | { kind: 'evade'; tick: number; attacker: Side; action: ActionName; text: string }
  | { kind: 'nearMiss'; tick: number; attacker: Side; action: ActionName; meter: number }
  | { kind: 'whiff'; tick: number; attacker: Side; action: ActionName }
  | { kind: 'trace'; tick: number; positions: Record<Side, Vec> }
  | { kind: 'slotEnd'; exchange: number; slot: number; plans: Record<Side, PlanInfo>; positions: Record<Side, Vec>; separation: number; wounds: Record<Side, number>; meters: Record<Side, number> }
  | { kind: 'ko'; tick: number; side: Side }
  | { kind: 'revision'; side: Side; moment: Moment; from: string; to: string }
  | { kind: 'pulse'; side: Side; pulse: number; damage: number; woundsLeft: number; capped: boolean }
  | { kind: 'obstacle'; tick: number; attacker: Side; action: ActionName; obstacle: string; damage: number; destroyed: boolean; through: boolean }
  | { kind: 'zone'; tick: number; owner: Side; zone: 'burning' | 'corrosive' | 'smolder'; center: Vec }
  | { kind: 'zoneEffect'; side: Side; zone: 'burning' | 'corrosive' | 'smolder'; damage: number; woundsLeft: number }
  | { kind: 'boutEnd'; winner: Side; reason: string };

// ---------------------------------------------------------------- plans

type Phase = 'windup' | 'active' | 'recovery' | 'idle';

interface Plan {
  spec: ActionSpec;
  windup: number;
  active: number;
  recovery: number;
  interruptedAt: number | null;
  resolved: boolean;
  landed: boolean;
  nearMiss: boolean;
  origin: Vec | null;
  aim: Vec | null;
  moveTotal: number;
  /** ticks the move takes to complete; Evasion beyond the one-band cap shortens it */
  travel: number;
  moved: number;
  converted: 'dodge' | 'roar' | null;
  link: number;
  intimidateBonus: boolean;
  /** a Wyvern stoop: flies from the air to land at Melee during the wind-up */
  stoop: { from: Vec; to: Vec; target: Vec } | null;
  /** a lunging Bite (during the wind-up) or a pouncing Claw (during the active window) [Proposed] */
  carry: { kind: 'lunge' | 'pounce'; from: Vec; to: Vec } | null;
  /** this Bite follows an Approach and may lunge [Proposed] */
  lunges: boolean;
  /** this Claw follows a Strafe: it pounces and pierces [Proposed] */
  pounces: boolean;
  /** Sidewinder Spine: distance to shift along the line while strafing, and how far it has */
  shiftTotal: number;
  shifted: number;
  /** altitude when the slot began (Stooping Pinions) */
  startZ: number;
  /** a Bite or Claw aimed at this dragon missed while it evaded (Riposte, Sidewinder) */
  evaded: boolean;
  /** this chain was carried through a hitless exchange (Ratchet Claws) */
  chainPaused: boolean;
  lockjawBonus: boolean;
  diveBonus: boolean;
  /** the charging slot of a charge: it guards like Scales and attacks nothing */
  charging: boolean;
  /** a crunch: two attacks of 15 ticks each */
  halves: [number, number, number][] | null;
  landedHalves: number;
}

const category = (p: Plan) => (p.charging ? 'guard' : ACTIONS[p.spec.name].category);

/** Guarding like Scales: Scales itself, or the charging slot of a charge [Proposed]. */
const guarding = (p: Plan, t: number) => (p.spec.name === 'scales' || p.charging) && phase(p, t) === 'active';

/** The last active tick of the window t falls in (a crunch has one per half). */
function lastActiveTick(p: Plan, t: number): number {
  if (!p.halves) return p.windup + p.active - 1;
  const h = t < R.HALF ? 0 : 1;
  return h * R.HALF + p.halves[h][0] + p.halves[h][1] - 1;
}

/** A crunch half's profile: wind-up and recovery halve, rounding down; the active window absorbs the rest [Proposed]. */
function halfTiming(profile: readonly [number, number, number], extraRecovery: number): [number, number, number] {
  let w = Math.floor(profile[0] / 2);
  let r = Math.floor(profile[2] / 2) + extraRecovery;
  let a = R.HALF - w - r;
  if (a < R.MIN_ACTIVE) {
    let need = R.MIN_ACTIVE - a;
    const fromR = Math.min(r, need);
    r -= fromR;
    need -= fromR;
    w -= need;
    a = R.MIN_ACTIVE;
  }
  return [w, a, r];
}

function phase(p: Plan, t: number): Phase {
  if (p.interruptedAt !== null && t >= p.interruptedAt) return 'idle';
  if (p.halves) {
    const h = t < R.HALF ? 0 : 1;
    const local = t - h * R.HALF;
    const [w, a] = p.halves[h];
    if (local < w) return 'windup';
    if (local < w + a) return 'active';
    return 'recovery';
  }
  if (t < p.windup) return 'windup';
  if (t < p.windup + p.active) return 'active';
  return 'recovery';
}

/** Shifts move the active window's edges; the action always totals 30 ticks [Doc]. */
export function timing(profile: readonly [number, number, number], windupShift: number, recoveryShift: number): [number, number, number] {
  let w = Math.max(0, profile[0] + windupShift);
  let r = Math.max(0, profile[2] + recoveryShift);
  let a = R.TICKS_PER_SLOT - w - r;
  if (a < R.MIN_ACTIVE) {
    // Shifts past the floor are lost: trim recovery first, then wind-up.
    let need = R.MIN_ACTIVE - a;
    const fromR = Math.min(r, need);
    r -= fromR;
    need -= fromR;
    w -= need;
    a = R.MIN_ACTIVE;
  }
  return [w, a, r];
}

function makePlan(f: Fighter, opp: Fighter, requested: ActionSpec, g: number, slot: number, prevLanded: boolean, ev: Event[]): Plan {
  let spec = requested;
  const note = (text: string) => ev.push({ kind: 'note', tick: 0, side: f.side, text });

  // A charge begun last slot releases now, whatever this slot scripted. With the charge variant [Proposed],
  // scripting the same charge again holds it a second slot (not into slot 3), and that second slot earns the bonus.
  let holding = false;
  if (f.marks.charge) {
    const c = f.marks.charge;
    if (R.VARIANT.breathCharge && requested.charge && requested.name === c.action && c.slots === 1 && slot < 2) {
      spec = { name: c.action, sweep: c.sweep, charge: true };
      holding = true;
      note(`Holds the ${ACTIONS[spec.name].label} charge a second slot.`);
    } else {
      spec = { name: c.action, sweep: c.sweep, released: true, full: !R.VARIANT.breathCharge || c.slots >= 2 };
      f.marks.charge = null;
      note(`Releases the charged ${ACTIONS[spec.name].label}.`);
    }
  }
  // Lunge [Proposed]: a Bite right after an Approach that moved carries the dragon forward.
  const lunges = R.VARIANT.biteLunge && f.marks.advanced;
  f.marks.advanced = false;
  // Pounce [Proposed]: a Claw right after a Strafe that moved.
  const pounces = R.VARIANT.clawPounce && f.marks.strafed;
  f.marks.strafed = false;
  // Mandatory charge [Proposed]: a Breath always takes two slots.
  if (R.VARIANT.breathMandatory && spec.name === 'breath' && !spec.charge && !spec.released) {
    spec = { ...spec, charge: true };
    note('Breath must charge: this slot draws breath, the next releases it.');
  }

  // Lockjaw Venerable: a Bite the slot after a landed Lockjaw Bite gains +3. Nothing is forced.
  const lockjawBonus = f.marks.lockjawFollow && spec.name === 'bite';
  f.marks.lockjawFollow = false;
  const ready = f.readyAt[spec.name] ?? 0;
  if (ready > g + (spec.charge ? 1 : 0)) {
    note(`${describe(spec)} is still cooling down; holds instead.`);
    spec = HOLD;
  }
  if (f.status.pinned && ACTIONS[spec.name].category === 'move') {
    note(`Pinned: can't ${describe(spec)}; holds instead.`);
    spec = HOLD;
  }
  if (spec.name === 'dive' && f.pos.z === 0) {
    note('Already on the ground: nothing to dive from; holds instead.');
    spec = HOLD;
  }
  if (spec.name === 'stomp' && f.pos.z > 0) {
    note("Can't Stomp while aloft; holds instead.");
    spec = HOLD;
  }
  if (spec.name === 'leap' && (f.status.grounded || f.marks.noLeap)) {
    note(f.status.grounded ? 'Hamstrung: can\'t Leap; holds instead.' : 'Just dived: can\'t Leap this slot; holds instead.');
    spec = HOLD;
  }
  f.marks.noLeap = false;

  // Charging: one action across two slots [Doc]. It must release by slot 3; only the Ouroboros wraps a charge.
  if (spec.charge && slot >= 2) {
    note('A charge must release by slot 3: charging in slot 3 holds instead.');
    spec = HOLD;
  }
  // Crunching comes only from shards [Doc]: Raking Talons for Claw, Gnashing Teeth for Bite.
  const crunchTech = spec.name === 'claw' ? tech(f, 'raking-talons') : spec.name === 'bite' ? tech(f, 'gnashing-teeth') : -1;
  if (spec.crunch && (crunchTech < 0 || (crunchTech === W && !prevLanded))) {
    note(crunchTech < 0
      ? `Crunching a ${ACTIONS[spec.name].label} needs ${spec.name === 'claw' ? 'Raking Talons' : 'Gnashing Teeth'}: attacks once.`
      : `A Wyrmling crunch needs a landed ${ACTIONS[spec.name].label} in the slot before: attacks once.`);
    spec = { ...spec, crunch: undefined };
  }
  const sw = tech(f, 'sidewinder-spine');
  if (spec.shift && (sw < 0 || (sw === W && spec.shift === 'in'))) {
    note(sw < 0 ? 'Strafes without shifting: that needs Sidewinder Spine.' : 'A Wyrmling Sidewinder Spine only shifts away.');
    spec = { name: spec.name, dir: spec.dir };
  }

  // Goading Roar: a goaded Retreat stings, even when the leash turns it into a roar.
  if (f.marks.goaded !== null) {
    const gr = f.marks.goaded;
    f.marks.goaded = null;
    if (spec.name === 'retreat' || (gr >= E && spec.name === 'dodge')) {
      f.wounds -= R.TECHNIQUE_POINTS;
      note(`Goaded into a ${describe(spec)}: takes ${R.TECHNIQUE_POINTS}.`);
      if (gr >= V) f.status.rattled = true;
    }
  }

  const def = ACTIONS[spec.name];
  const rip = tech(f, 'riposte-talons');
  const cooldown = def.cooldown + (spec.name === 'dodge' && rip >= W && rip < A ? 1 : 0);
  // A charging breath's cooldown starts when it releases.
  if (cooldown > 0 && !spec.charge) f.readyAt[spec.name] = g + cooldown + 1;

  // Timing shifts move the active window's edges.
  let wShift = f.status.rattled ? R.RATTLED_WINDUP : 0;
  let rShift = 0;
  const snap = tech(f, 'snapping-jaw');
  if (spec.name === 'bite' && snap >= W) {
    wShift += snap === W ? -3 : -5;
    rShift += snap >= A ? 3 : 5;
  }
  const ham = tech(f, 'hamstring-hooks');
  if (spec.name === 'claw' && ham >= W) rShift += ham >= A ? 3 : 5;
  const bound = tech(f, 'bounding-haunches');
  const bounding = spec.name === 'approach' && bound >= W && (bound >= J || dist(f.pos, opp.pos) > R.CLOSE_EDGE);
  if (bounding) rShift += bound >= A ? 3 : 6;
  if (f.marks.quick && (f.marks.quick === 'any' || spec.name === 'bite' || spec.name === 'claw') && spec.name !== 'hold') {
    wShift -= 3;
    f.marks.quick = null;
  }
  const [windup, active, recovery] = timing(def.profile, wShift, rShift);

  let moveTotal = 0;
  let travel = active;
  let shiftTotal = 0;
  if (def.category === 'move') {
    let raw = eff(f, 'evasion', {}).value * R.EVASION_STEP;
    let cap = R.MOVE_CAP;
    // Bounding Haunches: an Approach carries up to two bands [Doc]; read here as double distance [Assumed].
    if (bounding) {
      raw *= 2;
      cap *= 2;
    }
    moveTotal = Math.min(raw, cap);
    // A move carries at most one band; Evasion beyond that buys timing [Proposed]: the move finishes sooner.
    if (raw > cap) travel = Math.max(1, Math.floor((active * cap) / raw));
    if (spec.name === 'strafe' && sw >= W && (sw < A || spec.shift)) moveTotal = Math.max(0, moveTotal - R.PACE);
    if (spec.shift) shiftTotal = (sw >= A ? 2 : 1) * R.PACE;
    if (f.status.staggered) moveTotal = Math.floor(moveTotal / 2);
    if (f.status.slowed) travel = Math.min(active, travel + 3);
    if (spec.name === 'dive' && tech(f, 'stooping-pinions') >= E) travel = Math.max(1, travel - 3);
  }

  let link = 0;
  let intimidateBonus = false;
  let diveBonus = false;
  const charging = spec.charge === true;
  if (charging && !holding) f.marks.charge = { action: spec.name as 'bite' | 'breath', sweep: spec.sweep, slots: 1 };
  if (holding && f.marks.charge) f.marks.charge.slots = 2;
  // Crunched halves carry no modifier: the reward is doing the thing twice [Doc]. Raking Talons Venerable counts the pair as a link.
  const crunchLink = spec.crunch && spec.name === 'claw' && crunchTech >= V;
  if (def.category === 'attack' && !charging && (!spec.crunch || crunchLink)) {
    // Cooldown actions can't chain [Proposed]; they neither build nor break one.
    link = def.cooldown === 0 && f.chain.action === spec.name ? f.chain.links + 1 : 1;
  }
  if (def.category === 'attack' && !charging && !spec.crunch) {
    intimidateBonus = f.intimidateBonus;
    f.intimidateBonus = false;
    diveBonus = f.marks.diveBonus;
    f.marks.diveBonus = false;
  }
  const halves: [number, number, number][] | null = spec.crunch
    ? [halfTiming(def.profile, 0), halfTiming(def.profile, crunchTech >= A ? 3 : 6)]
    : null;
  const [w0, a0, r0] = charging ? [0, R.TICKS_PER_SLOT, 0] : halves ? halves[0] : [windup, active, recovery];

  return {
    spec, windup: w0, active: a0, recovery: r0, interruptedAt: null,
    resolved: false, landed: false, nearMiss: false, origin: null, aim: null,
    moveTotal, travel, moved: 0, converted: null, link, intimidateBonus, stoop: null, carry: null, lunges: lunges && spec.name === 'bite' && !spec.crunch,
    pounces: pounces && spec.name === 'claw' && !spec.crunch,
    shiftTotal, shifted: 0, startZ: f.pos.z, evaded: false, chainPaused: f.chain.saves > 0, lockjawBonus, diveBonus,
    charging, halves, landedHalves: 0,
  };
}

// ---------------------------------------------------------------- the exchange

/** Revision moments: the end of slot 1 or the end of slot 2, before slot 3 begins. */
export type Moment = 1 | 2;

/**
 * Asked at each revision moment while the side still has its one revision. Sees the bout as it stands
 * (everything is visible) and whether the opponent has already revised (the flash). Returns a new
 * slot 3, or null to keep it. Both sides decide from the same moment, so same-moment revisions are simultaneous.
 */
export type Reviser = (bout: Bout, side: Side, moment: Moment, opponentRevised: boolean, revealed: string | null) => ActionSpec | null;

/** Baleful Eye: what the eye shows of the opponent's scripted slot 3, by grade [Doc]. */
function reveal(spec: ActionSpec, rank: number): string {
  const cat = ACTIONS[spec.name].category;
  if (rank >= V) return describe(spec);
  if (rank >= E) return ACTIONS[spec.name].label;
  if (rank >= J) return cat;
  return cat === 'attack' ? 'attack' : 'not an attack';
}

export interface ExchangeOptions {
  trace?: boolean;
  revise?: Partial<Record<Side, Reviser>>;
}

export function runExchange(bout: Bout, scripts: Record<Side, ActionSpec[]>, opts: ExchangeOptions = {}): Event[] {
  const ev: Event[] = [];
  if (bout.over) return ev;
  bout.exchange++;
  ev.push({ kind: 'exchangeStart', exchange: bout.exchange });
  for (const s of SIDES) {
    const f = bout.fighters[s];
    f.chain.hitThisExchange = false;
    f.chain.scalesThisExchange = false;
    f.marks.eye = null;
    bout.startWounds[s] = f.wounds;
    if (f.marks.revisionLockedFor === bout.exchange) ev.push({ kind: 'note', tick: 0, side: s, text: "Ash Gland: can't revise this exchange." });
  }
  const slots: Record<Side, ActionSpec[]> = {
    A: [0, 1, 2].map((i) => scripts.A[i] ?? HOLD),
    B: [0, 1, 2].map((i) => scripts.B[i] ?? HOLD),
  };
  const revised: Record<Side, boolean> = { A: false, B: false };

  for (let slot = 0; slot < R.SLOTS_PER_EXCHANGE && !bout.over; slot++) {
    runSlot(bout, slot, { A: slots.A[slot], B: slots.B[slot] }, ev, opts.trace ?? false);

    // The revision window: slot 3 stays live while slots 1 and 2 resolve, once per exchange [Doc].
    if (slot < 2 && !bout.over && opts.revise) {
      const moment = (slot + 1) as Moment;
      const choices: Partial<Record<Side, ActionSpec>> = {};
      for (const s of SIDES) {
        const reviser = opts.revise[s];
        const f = bout.fighters[s];
        // A charge on the board releases next slot regardless, so there's nothing to revise.
        if (!revised[s] && reviser && f.marks.revisionLockedFor !== bout.exchange && !f.marks.charge) {
          const seen = f.marks.eye !== null ? reveal(slots[other(s)][2], f.marks.eye) : null;
          const c = reviser(bout, s, moment, revised[other(s)], seen);
          if (c) choices[s] = c;
        }
      }
      for (const s of SIDES) {
        const c = choices[s];
        if (!c) continue;
        ev.push({ kind: 'revision', side: s, moment, from: describe(slots[s][2]), to: describe(c) });
        slots[s][2] = { ...c, revised: true };
        revised[s] = true;
      }
    }
  }
  if (!bout.over) for (const s of SIDES) chainAtExchangeEnd(bout.fighters[s], ev);
  return ev;
}

/**
 * A chain lapses only when a whole exchange passes without a landed hit. Ratchet Claws carries a Claw
 * chain through one such exchange (Wyrmling: only if it guarded with Scales; Venerable: two).
 */
function chainAtExchangeEnd(f: Fighter, ev: Event[]) {
  const c = f.chain;
  if (c.hitThisExchange || c.links === 0) return;
  const rat = tech(f, 'ratchet-claws');
  // Ratchet Claws Elder: the escalating Claw chain holds through one hitless exchange.
  if (c.action === 'claw' && rat >= E && c.saves < 1) {
    c.saves++;
    c.resumed = true;
    ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: f.side, text: `Ratchet Claws: the Claw chain (${c.links} link${c.links > 1 ? 's' : ''}) holds through a hitless exchange.` });
    return;
  }
  ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: f.side, text: `A whole exchange without a hit: the ${ACTIONS[c.action ?? 'hold'].label} chain lapses.` });
  f.chain = noChain();
}

/**
 * Plays one slot on a bout, for an AI imagining the rest of an exchange. The real fight never calls this;
 * it runs whole exchanges. The slot number is the next one in the current exchange.
 */
export function simulateSlot(bout: Bout, specs: Record<Side, ActionSpec>): Event[] {
  const ev: Event[] = [];
  if (!bout.over) runSlot(bout, bout.globalSlot % R.SLOTS_PER_EXCHANGE, specs, ev, false);
  return ev;
}

/** Ends the bout if anyone is down. A double KO goes to the challenged [Proposed]. */
export function checkKO(bout: Bout, ev: Event[], tick: number): void {
  const F = bout.fighters;
  const down = SIDES.filter((s) => F[s].wounds <= 0);
  if (down.length === 0) return;
  for (const s of down) ev.push({ kind: 'ko', tick, side: s });
  bout.over = true;
  bout.winner = down.length === 2 ? bout.challenged : other(down[0]);
  ev.push({ kind: 'boutEnd', winner: bout.winner, reason: down.length === 2 ? 'double KO goes to the challenged' : 'KO' });
}

function runSlot(bout: Bout, slot: number, specs: Record<Side, ActionSpec>, ev: Event[], trace: boolean) {
  const g = bout.globalSlot++;
  const F = bout.fighters;
  ev.push({ kind: 'slotStart', exchange: bout.exchange, slot: slot + 1 });

  for (const s of SIDES) {
    F[s].status = F[s].pending;
    F[s].pending = noStatuses();
  }
  const startSep = dist(F.A.pos, F.B.pos);
  const startZ = { A: F.A.pos.z, B: F.B.pos.z };
  const startWounds = { A: F.A.wounds, B: F.B.wounds };
  const breathReady = { A: (F.A.readyAt.breath ?? 0) <= g, B: (F.B.readyAt.breath ?? 0) <= g };
  const prev = bout.record.at(-1);
  const prevLanded = (s: Side) => !!prev && prev.landed[s] && prev.actions[s] === specs[s].name;
  const plans: Record<Side, Plan> = {
    A: makePlan(F.A, F.B, specs.A, g, slot, prevLanded('A'), ev),
    B: makePlan(F.B, F.A, specs.B, g, slot, prevLanded('B'), ev),
  };
  checkKO(bout, ev, 0); // a goaded retreat can be the last straw

  for (let t = 0; t < R.TICKS_PER_SLOT && !bout.over; t++) {
    tick(bout, plans, t, ev);
    if (trace) ev.push({ kind: 'trace', tick: t, positions: { A: { ...F.A.pos }, B: { ...F.B.pos } } });
  }
  if (!bout.over) zonesAtSlotEnd(bout, plans, g, ev);

  for (const s of SIDES) {
    const p = plans[s];
    const f = F[s];
    if (p.landed) f.chain.hitThisExchange = true;
    if (p.spec.name === 'scales') f.chain.scalesThisExchange = true;
    if (category(p) === 'attack' && ACTIONS[p.spec.name].cooldown === 0 && p.link > 0) {
      const c = f.chain;
      if (c.action !== p.spec.name) {
        // A different attack starts a new chain.
        f.chain = { ...noChain(), hitThisExchange: c.hitThisExchange, scalesThisExchange: c.scalesThisExchange, action: p.spec.name, links: p.landed ? 1 : 0 };
      } else if (p.landed) {
        c.links = p.link;
        c.resumed = false;
        // A third link completes the chain; the next repeat starts a fresh one.
        if (c.links >= 3) f.chain = { ...noChain(), hitThisExchange: true, scalesThisExchange: c.scalesThisExchange };
      }
    }
    // Riposte Talons Adult: the Dodge cooldown penalty applies only after a failed dodge.
    if (p.spec.name === 'dodge' && !p.evaded && tech(f, 'riposte-talons') >= A) f.readyAt.dodge = (f.readyAt.dodge ?? 0) + 1;
    // Stooping Pinions: a dive from high enough adds +3 to the next attack; the next slot can't Leap below Adult.
    const sp = tech(f, 'stooping-pinions');
    if (p.spec.name === 'dive' && sp >= W && p.moved > 0 && p.startZ >= (sp === W ? R.STOOPING_HEIGHT.wyrmling : R.STOOPING_HEIGHT.rest)) {
      f.marks.diveBonus = true;
      f.marks.noLeap = sp < A;
      ev.push({ kind: 'note', tick: R.TICKS_PER_SLOT - 1, side: s, text: 'Stooping Pinions: +3 to the next attack.' });
    }
    bout.history[s].push(p.spec.name);
    f.marks.advanced = p.spec.name === 'approach' && p.converted === null && p.moved > 0;
    f.marks.strafed = p.spec.name === 'strafe' && p.converted === null && p.moved > 0;
  }
  bout.record.push({
    exchange: bout.exchange, slot, separation: startSep, z: startZ, wounds: startWounds,
    actions: { A: plans.A.spec.name, B: plans.B.spec.name }, landed: { A: plans.A.landed, B: plans.B.landed }, breathReady,
  });

  const info = (p: Plan): PlanInfo => ({
    label: describe(p.spec) + (p.spec.revised ? ' (revised)' : '') + (p.converted === 'dodge' ? ' → dodge' : p.converted === 'roar' ? ' → roar' : ''),
    windup: p.windup, active: p.active, recovery: p.recovery, interruptedAt: p.interruptedAt,
    ...(p.halves ? { halves: p.halves } : {}),
  });
  ev.push({
    kind: 'slotEnd', exchange: bout.exchange, slot: slot + 1,
    plans: { A: info(plans.A), B: info(plans.B) },
    positions: { A: { ...F.A.pos }, B: { ...F.B.pos } },
    separation: dist(F.A.pos, F.B.pos),
    wounds: { A: F.A.wounds, B: F.B.wounds },
    meters: { A: F.A.meter, B: F.B.meter },
  });
}

function tick(bout: Bout, plans: Record<Side, Plan>, t: number, ev: Event[]) {
  const F = bout.fighters;

  // 1. Movement, both dragons from the same starting positions.
  const next = { A: moveStep(F.A, F.B, plans.A, plans.B, t, ev), B: moveStep(F.B, F.A, plans.B, plans.A, t, ev) };
  for (const s of SIDES) next[s] = stoopStep(F[s], plans[s], t, next[s]);
  for (const s of SIDES) next[s] = carryStep(plans[s], t, next[s]);
  for (const s of SIDES) {
    // Obstacles restrict movement [Doc]; a blocked move defaults to a dodge.
    const o = next[s] !== F[s].pos ? obstacleAt(bout.arena, next[s]) : null;
    if (o) {
      next[s] = F[s].pos;
      if (plans[s].stoop || plans[s].carry) {
        ev.push({ kind: 'note', tick: t, side: s, text: `The ${plans[s].stoop ? 'stoop' : plans[s].carry!.kind} is cut short by ${describeObstacle(o)}.` });
        plans[s].stoop = null;
        plans[s].carry = null;
      } else {
        plans[s].converted = 'dodge';
        ev.push({ kind: 'note', tick: t, side: s, text: `Blocked by ${describeObstacle(o)}; converts to a dodge.` });
      }
    }
  }
  if (dist(next.A, next.B) < R.BODY_GAP) {
    // Bodies block each other: whoever moved this tick stays put and dodges instead.
    for (const s of SIDES) {
      if (next[s] !== F[s].pos) {
        next[s] = F[s].pos;
        if (plans[s].stoop || plans[s].carry) {
          ev.push({ kind: 'note', tick: t, side: s, text: `The ${plans[s].stoop ? 'stoop' : plans[s].carry!.kind} is cut short by the other body.` });
          plans[s].stoop = null;
          plans[s].carry = null;
        } else {
          plans[s].converted = 'dodge';
          ev.push({ kind: 'note', tick: t, side: s, text: 'Blocked by the other body; converts to a dodge.' });
        }
      }
    }
  }
  F.A.pos = next.A;
  F.B.pos = next.B;

  // 2. Attacks lock their aim when the wind-up starts [Assumed]. A strafe during the wind-up can carry
  //    the target out of the shape; Accuracy's phantom band and the long Claw window answer that.
  for (const s of SIDES) {
    const p = plans[s];
    if (category(p) === 'attack' && (t === 0 || (p.halves && t === R.HALF)) && phase(p, t) !== 'idle') {
      // Each half of a crunch aims afresh.
      if (t > 0) {
        p.resolved = false;
        p.nearMiss = false;
      }
      p.origin = { ...F[s].pos };
      p.aim = sub(F[other(s)].pos, F[s].pos);
      ev.push({ kind: 'aim', tick: t, side: s, action: p.spec.name, distance: len(p.aim) });
      if (!p.halves) beginStoop(F[s], F[other(s)], p, t, ev);
      if (p.lunges && t === 0) beginLunge(F[s], p, ev);
      if (p.pounces && t === 0 && !p.stoop) beginPounce(F[s], p, ev);
      if (p.pounces && t === 0 && p.stoop) ev.push({ kind: 'note', tick: t, side: s, text: 'Strafed into the stoop: it pounces, and pierces.' });
    }
    // A lunging Bite strikes from where the wind-up carried it, along the line it locked.
    if (p.lunges && t === p.windup && phase(p, t) === 'active') p.origin = { ...F[s].pos };
    // A pouncing Claw sweeps its arc from wherever the pounce has carried it, tick by tick.
    if (p.pounces && !p.stoop && phase(p, t) === 'active') p.origin = { ...F[s].pos };
    // A stooping Wyvern strikes from wherever it actually landed, toward where the target stood.
    if (p.stoop && t === p.windup && phase(p, t) === 'active') {
      p.origin = { ...F[s].pos };
      p.aim = sub(p.stoop.target, F[s].pos);
    }
  }

  // 3. Hit detection. Obstacles in the way are judged as they stood at the start of the tick.
  const hits: Side[] = [];
  const blocked: { s: Side; o: Obstacle }[] = [];
  for (const s of SIDES) {
    const p = plans[s];
    if (category(p) !== 'attack' || p.resolved || phase(p, t) !== 'active' || !p.origin || !p.aim) continue;
    const att = F[s];
    const def = F[other(s)];
    const defPlan = plans[other(s)];
    // Scything Forelimbs: a wider claw arc that tests Accuracy at −3 (from Adult, only on a chain's first claw).
    const scy = p.spec.name === 'claw' ? tech(att, 'scything-forelimbs') : -1;
    const scythePenalty = scy >= W && (scy < A || p.link <= 1) ? 3 : 0;
    const accuracy = eff(att, 'accuracy', { opp: def }).value - (att.status.blinded ? R.BLINDED_ACCURACY : 0) - scythePenalty;
    const lance = p.spec.name === 'breath' ? tech(att, 'lance-throat') : -1;
    const shape = p.stoop ? 'stoop' : lance >= W ? 'lance' : shapeOf(p.spec.name, att.sheet);
    const mods = {
      reach: scy < W ? 0 : (scy === W ? R.SCYTHE_REACH.wyrmling : R.SCYTHE_REACH.full) + (scy >= V && def.pos.z > p.origin.z ? R.PACE : 0),
      widen: lance >= E,
    };

    // Bellows Chest Elder: a charged breath's area grows.
    const area = p.spec.released && p.spec.name === 'breath' && tech(att, 'bellows-chest') >= E ? R.PACE : 0;
    if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, area, mods)) {
      // An attack shape stops where it meets an obstacle and damages it instead [Proposed]. Stomp shakes the ground under it.
      // Lance Throat from Adult punches through one obstacle.
      const o = p.spec.name === 'stomp' ? null : obstacleOnLine(bout.arena, p.origin, def.pos, lance >= A ? 1 : 0);
      if (o) {
        blocked.push({ s, o });
        continue;
      }
      // Breath and Stomp skip Evasion [Doc]. Bite and Claw test it against a moving or dodging target.
      const evading = evasionState(plans[other(s)], t);
      if ((p.spec.name === 'bite' || p.spec.name === 'claw') && evading) {
        // Wyrm Serpentine [Assumed reading of §2]: it owns lateral movement, so its strafe evades like a dodge.
        const serpentine = def.sheet.aspect === 'serpentine' && plans[other(s)].spec.name === 'strafe' && evading === 'moving';
        let evasion = eff(def, 'evasion', {}).value + (evading === 'dodging' || serpentine ? R.DODGE_BONUS : 0);
        if (def.status.pinned && p.spec.name === 'bite' && tech(att, 'lockjaw') >= E) evasion -= 3; // Lockjaw Elder
        if (scy >= E && defPlan.spec.name === 'strafe') evasion -= 3; // Scything Elder: caught strafers
        const sw = tech(def, 'sidewinder-spine');
        if (sw >= V && defPlan.spec.name === 'strafe' && bout.history[def.side].at(-1) === 'strafe') evasion += 3; // chained Sidewinders
        const escaped = evasion > accuracy || (evasion === accuracy && def.sheet.acumen > att.sheet.acumen);
        if (escaped) {
          p.resolved = true;
          defPlan.evaded = true;
          ev.push({ kind: 'evade', tick: t, attacker: s, action: p.spec.name, text: `${serpentine ? 'strafing (Serpentine)' : evading} with Evasion ${evasion} beats Accuracy ${accuracy}` });
          riposte(bout, other(s), p, defPlan, t, ev);
          continue;
        }
      }
      hits.push(s);
    } else if (inShape(shape, att.sheet, p.origin, p.aim, def.pos, area + Math.max(0, accuracy) * R.NOTCH, mods)) {
      p.nearMiss = true;
    }
  }

  for (const s of strikeObstacles(bout, plans, blocked, t, ev)) hits.push(s);

  // 4. Damage and statuses, worked out from the same moment, then applied together.
  const results = hits.map((s) => ({ s, ...damage(F[s], F[other(s)], plans[s], plans[other(s)], t, false) }));
  const trade = results.length === 2;
  for (const r of results) applyHit(bout, plans, r.s, r.total, r.parts, t, false, trade, ev);

  // 5. End-of-window checks.
  for (const s of SIDES) {
    const p = plans[s];
    const lastActive = t === lastActiveTick(p, t) && phase(p, t) === 'active';
    if (!lastActive) continue;
    if (p.spec.name === 'breath' && p.origin && p.aim) {
      leaveZone(bout, s, p.origin, p.aim, t, ev);
      smolder(bout, s, p.origin, p.aim, t, ev);
    }
    if (category(p) === 'attack' && !p.resolved) {
      p.resolved = true;
      // Sidewinder Spine Elder: a strafe that slips an attack speeds the next wind-up.
      const dp = plans[other(s)];
      if (dp.spec.name === 'strafe' && tech(F[other(s)], 'sidewinder-spine') >= E) {
        dp.evaded = true;
        F[other(s)].marks.quick = 'any';
      }
      if (!p.nearMiss) {
        ev.push({ kind: 'whiff', tick: t, attacker: s, action: p.spec.name });
        continue;
      }
      const att = F[s];
      att.meter += R.NEAR_MISS_STEP;
      if (att.meter >= R.METER_MAX) {
        att.meter = att.sheet.acumen;
        const g = damage(att, F[other(s)], p, plans[other(s)], t, true);
        applyHit(bout, plans, s, g.total, g.parts, t, true, false, ev);
      } else {
        ev.push({ kind: 'nearMiss', tick: t, attacker: s, action: p.spec.name, meter: att.meter });
      }
    }
    if (p.spec.name === 'intimidate') intimidateLands(bout, s, t, ev);
  }

  // 6. KO checks.
  checkKO(bout, ev, t);
}

function evasionState(p: Plan, t: number): 'moving' | 'dodging' | null {
  if (phase(p, t) !== 'active') return null;
  if (p.spec.name === 'dodge' || p.converted === 'dodge') return 'dodging';
  if (category(p) === 'move' && p.converted === null) return 'moving';
  return null;
}

function moveStep(me: Fighter, opp: Fighter, p: Plan, oppPlan: Plan, t: number, ev: Event[]): Vec {
  if (category(p) !== 'move' || p.converted || phase(p, t) !== 'active') return me.pos;
  const k = t - p.windup;
  const target = Math.floor((p.moveTotal * Math.min(k + 1, p.travel)) / p.travel);
  const delta = target - p.moved;
  // A Wyrm's leap is a hop: it rises for the first half of the window and lands by the end [Assumed].
  if (p.spec.name === 'leap' && !me.sheet.flies) {
    const half = Math.max(1, Math.floor(p.active / 2));
    const peak = Math.floor(p.moveTotal / 2);
    const z = k < half ? Math.floor((peak * (k + 1)) / half) : Math.max(0, Math.floor((peak * (p.active - k - 1)) / (p.active - half)));
    return { ...me.pos, z };
  }
  if (delta <= 0) return me.pos;

  // Approach, Retreat and Strafe move across the floor; Leap and Dive change altitude [Doc]: three degrees of freedom.
  const v = sub(me.pos, opp.pos);
  const flatV = flat(v);
  const flatSep = flatLen(v);
  let np: Vec;
  switch (p.spec.name) {
    case 'approach': {
      const both = oppPlan.spec.name === 'approach' && oppPlan.converted === null && phase(oppPlan, t) === 'active';
      if (both && len(v) <= R.MELEE_EDGE) {
        p.converted = 'dodge';
        ev.push({ kind: 'note', tick: t, side: me.side, text: 'Both advanced: stops at Melee and converts to a dodge.' });
        return me.pos;
      }
      if (flatSep === 0) return me.pos; // directly above or below: nothing left to close across the floor
      // Stop where the bodies would touch, counting the height difference.
      const minFlat = isqrt(Math.max(0, R.BODY_GAP * R.BODY_GAP - v.z * v.z));
      np = { ...add(flat(opp.pos), scaleTo(flatV, Math.max(minFlat, flatSep - delta))), z: me.pos.z };
      break;
    }
    case 'retreat': {
      if (flatSep === 0) return me.pos;
      np = { ...add(flat(opp.pos), scaleTo(flatV, flatSep + delta)), z: me.pos.z };
      if (dist(np, opp.pos) > R.LEASH) {
        p.converted = 'roar';
        ev.push({ kind: 'note', tick: t, side: me.side, text: 'The leash holds: the retreat becomes an impotent roar.' });
        return me.pos;
      }
      break;
    }
    case 'strafe': {
      if (flatSep === 0) return me.pos;
      const tangent = p.spec.dir === 'cw' ? vec(flatV.y, -flatV.x) : vec(-flatV.y, flatV.x);
      // Sidewinder Spine: shift along the line while strafing, spread over the same ticks.
      const k2 = Math.min(t - p.windup + 1, p.travel);
      const shiftNow = Math.floor((p.shiftTotal * k2) / p.travel) - p.shifted;
      p.shifted += shiftNow;
      const radius = Math.max(R.BODY_GAP, flatSep + (p.spec.shift === 'in' ? -shiftNow : shiftNow));
      np = { ...add(flat(opp.pos), scaleTo(add(flatV, scaleTo(tangent, delta)), radius)), z: me.pos.z };
      if (dist(np, opp.pos) > R.LEASH) np = { ...add(flat(opp.pos), scaleTo(add(flatV, scaleTo(tangent, delta)), flatSep)), z: me.pos.z };
      break;
    }
    case 'leap': {
      const z = Math.min(R.MAX_ALTITUDE, me.pos.z + delta);
      if (z === me.pos.z) return me.pos;
      np = { ...me.pos, z };
      if (dist(np, opp.pos) > R.LEASH) return me.pos; // the leash holds in every direction [Doc]
      break;
    }
    case 'dive': {
      const z = Math.max(0, me.pos.z - delta);
      if (z === me.pos.z) return me.pos;
      np = { ...me.pos, z };
      break;
    }
    default:
      return me.pos;
  }
  if (flatLen(np) > R.ARENA_RADIUS) {
    p.converted = 'dodge';
    ev.push({ kind: 'note', tick: t, side: me.side, text: 'Blocked by the arena wall; converts to a dodge.' });
    return me.pos;
  }
  p.moved = target;
  return np;
}

function damage(att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number, graze: boolean): { total: number; parts: string[] } {
  const parts: string[] = [];
  const defPhase = phase(defPlan, t);
  const scales = guarding(defPlan, t);
  const corroded = def.status.corroded;
  const crunched = p.halves !== null;
  const sep = dist(att.pos, def.pos);

  // Ash Gland: the breath carries information, not harm (3 points from Adult).
  const ash = p.spec.name === 'breath' ? tech(att, 'ash-gland') : -1;
  if (ash >= W) return { total: ash >= A ? 3 : 0, parts: [`Ash Gland: ${ash >= A ? '3 points' : 'no damage'}`] };

  // Guard techniques change Hardness while guarding with Scales.
  let guardShift = 0;
  const guardNotes: string[] = [];
  if (scales) {
    const thorn = tech(def, 'thornscale');
    if (thorn >= W && (thorn < A || p.spec.name === 'bite')) {
      guardShift -= 3;
      guardNotes.push('Thornscale');
    }
    const mantle = tech(def, 'mantle-wings');
    if (mantle >= W && (p.spec.name === 'claw' || (p.spec.name === 'bite' && mantle < A)) && !(mantle >= V && def.pos.z > 0)) {
      guardShift -= 3;
      guardNotes.push('Mantle Wings');
    }
  }
  const hard = eff(def, 'hardness', { scales });
  // Gnashing Teeth Elder: the second bite of a crunch pierces 3 Hardness.
  if (crunched && p.spec.name === 'bite' && t >= R.HALF && tech(att, 'gnashing-teeth') >= E) {
    guardShift -= 3;
    guardNotes.push('Gnashing Teeth');
  }
  const hardness = Math.max(0, hard.value + (scales ? R.SCALES_HARDNESS : 0) - (corroded ? R.CORRODE_HARDNESS : 0) + guardShift);
  const hardLabel = `Hardness ${hardness}${scales ? ' (Scales)' : ''}${corroded ? ' (corroded)' : ''}${guardNotes.length ? ` (−3 ${guardNotes.join(', ')})` : ''}${hard.note}`;
  let v = 0;
  switch (p.spec.name) {
    case 'bite': {
      // Bite is piercing [Doc]: it ignores some Hardness.
      const bite = eff(att, 'bite', {});
      const pierced = Math.max(0, hardness - R.BITE_PIERCE);
      v = bite.value - pierced;
      parts.push(`Bite Force ${bite.value}${bite.note}`, `−${hardLabel}${hardness ? ` pierced to ${pierced}` : ''}`);
      if (p.spec.released && p.spec.full) {
        v += R.CHARGE_BONUS;
        parts.push(`+${R.CHARGE_BONUS} charged`);
      }
      break;
    }
    case 'claw': {
      const claw = eff(att, 'claw', { link: p.spec.revised ? 0 : p.link });
      // A pounce out of a strafe pierces like a Bite [Proposed].
      const felt = p.pounces ? Math.max(0, hardness - R.POUNCE_PIERCE) : hardness;
      v = claw.value - felt;
      parts.push(`Claw Sharpness ${claw.value}${claw.note}`, `−${hardLabel}${p.pounces && hardness ? ` pierced to ${felt} (pounce)` : ''}`);
      // Ratchet Claws: an escalating chain. Each landed link adds to the next (Wyrmling: only into the third).
      const rat = tech(att, 'ratchet-claws');
      const prior = p.link - 1;
      if (rat >= W && !crunched && prior > 0 && (rat >= J || p.link === 3)) {
        const step = rat >= V ? 2 : 1;
        const esc = rat === W ? step : prior * step;
        v += esc;
        parts.push(`+${esc} Ratchet Claws`);
      }
      break;
    }
    case 'breath': {
      const m = matchup(att.sheet.stone, def.sheet.stone) * R.MATCHUP;
      const breath = eff(att, 'breath', { sep });
      const aff = eff(def, 'affinity', { opp: att });
      // Scales presents the hide to the elements: +3 Affinity. Mantle Wings adds 3 more (Wyrmling: only at Melee or Close).
      const scalesAff = scales ? R.SCALES_AFFINITY : 0;
      const mantle = scales ? tech(def, 'mantle-wings') : -1;
      const mantleAff = mantle >= J || (mantle === W && sep <= R.CLOSE_EDGE) ? 3 : 0;
      // Lance Throat pierces Affinity: 3 from Juvenile, 6 at Far for a Venerable.
      const lance = tech(att, 'lance-throat');
      const pierce = lance >= V && sep > R.CLOSE_EDGE ? 6 : lance >= J ? 3 : 0;
      const affinity = Math.max(0, aff.value + scalesAff + mantleAff - pierce);
      v = breath.value - affinity + m;
      parts.push(`Breath Potency ${breath.value}${breath.note}`, `−Affinity ${affinity}${scalesAff ? ' (Scales)' : ''}${aff.note}${mantleAff ? ' (Mantle Wings +3)' : ''}${pierce ? ` (Lance Throat pierces ${pierce})` : ''}`);
      const elem = R.ELEMENT_BREATH_MOD[att.sheet.stone];
      if (elem) {
        v += elem;
        parts.push(`${elem > 0 ? '+' : ''}${elem} ${att.sheet.stone} breath`);
      }
      if (p.spec.released) {
        // Bellows Chest: +3 more, then +6 more, then double Potency from Adult.
        const bel = tech(att, 'bellows-chest');
        const extra = bel >= A ? breath.value : bel === J ? 6 : bel === W ? 3 : 0;
        // Under the charge variant a one-slot charge earns nothing; Bellows Chest restores the +3.
        const base = p.spec.full || bel >= W ? R.CHARGE_BONUS : 0;
        v += base + extra;
        if (base + extra) parts.push(`+${base + extra} charged${bel >= W ? ' (Bellows Chest)' : ''}`);
      }
      if (tech(att, 'smoldering-maw') >= W) {
        v -= 3;
        parts.push('−3 Smoldering Maw (it lingers instead)');
      }
      if (m > 0) parts.push(`+${m} matchup`);
      if (m < 0) parts.push(`${m} matchup`);
      break;
    }
    case 'stomp':
      v = R.STOMP_DAMAGE;
      parts.push(`Stomp ${R.STOMP_DAMAGE} true damage`);
      break;
  }
  if (crunched) parts.push('crunched: no modifiers');
  if (p.intimidateBonus) {
    v += R.INTIMIDATE_BONUS;
    parts.push(`+${R.INTIMIDATE_BONUS} Intimidate`);
  }
  if (p.link === 3 && !p.spec.revised && !crunched) {
    const sapped = att.marks.sapped === 'any' || (att.marks.sapped === 'claw' && p.spec.name === 'claw');
    const rat = p.spec.name === 'claw' ? tech(att, 'ratchet-claws') : -1;
    if (sapped) {
      att.marks.sapped = null;
      parts.push('chain bonus sapped (Sapping Bellow)');
    } else if (rat >= W) {
      // Ratchet Claws pays for its escalation out of the final link's bonus.
      const bonus = R.CHAIN_THIRD_LINK_BONUS - (rat >= A ? 1 : 3);
      v += bonus;
      parts.push(`+${bonus} chain third link (Ratchet Claws)`);
    } else {
      v += R.CHAIN_THIRD_LINK_BONUS;
      parts.push(`+${R.CHAIN_THIRD_LINK_BONUS} chain third link`);
    }
  }
  if (p.lockjawBonus) {
    v += 3;
    parts.push('+3 Lockjaw follow-up');
  }
  if (p.diveBonus) {
    v += 3;
    parts.push('+3 Stooping Pinions');
  }
  if (p.spec.name === 'bite' && defPhase === 'windup' && tech(att, 'snapping-jaw') >= E) {
    v += 3;
    parts.push('+3 Snapping Jaw interrupt');
  }
  if (defPhase === 'recovery') {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught in recovery)`);
  } else if (defPlan.spec.name === 'intimidate' && defPhase !== 'idle') {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught intimidating)`);
    // Intimidate techniques at Adult: punishes against you deal 3 less [Doc].
    if (['sapping-bellow', 'baleful-eye', 'goading-roar'].some((id) => tech(def, id as TechniqueId) >= A)) {
      v -= 3;
      parts.push('−3 (Intimidate technique)');
    }
  }
  if (graze) {
    v -= R.GRAZE_PENALTY;
    parts.push(`−${R.GRAZE_PENALTY} graze`);
  }
  if (v < R.DAMAGE_FLOOR) {
    v = R.DAMAGE_FLOOR;
    parts.push(`floor ${R.DAMAGE_FLOOR}`);
  }
  return { total: v, parts };
}

function applyHit(bout: Bout, plans: Record<Side, Plan>, s: Side, total: number, parts: string[], t: number, graze: boolean, trade: boolean, ev: Event[]) {
  const p = plans[s];
  const defPlan = plans[other(s)];
  const def = bout.fighters[other(s)];
  p.resolved = true;
  p.landed = true;
  p.landedHalves++;
  def.wounds -= total;
  if (defPlan.charging && def.marks.charge) {
    def.marks.charge = null;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'The hit breaks the charge.' });
  }
  if (p.halves && p.landedHalves === 2 && p.spec.name === 'bite' && tech(bout.fighters[s], 'gnashing-teeth') >= V) {
    def.pending.rattled = true;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'Gnashing Teeth: both bites land; Rattled.' });
  }
  const interrupt = phase(defPlan, t) === 'windup';
  if (interrupt) defPlan.interruptedAt = t;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: p.spec.name, damage: total, parts, interrupt, graze, trade, woundsLeft: def.wounds });
  if (p.spec.name === 'breath' && !graze && p.aim && tech(bout.fighters[s], 'ash-gland') < 0) breathVerb(bout, s, p.aim, t, ev);
  techniqueOnHit(bout, s, p, defPlan, t, graze, ev);
  if (p.spec.name === 'stomp') {
    def.pending.staggered = true;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'Staggered next slot: movement distance halved.' });
  }
}

// ---------------------------------------------------------------- obstacles and breath effects

/** Raw force of an attack against an obstacle: no Hardness, no modifiers. */
function obstacleDamage(att: Fighter, action: ActionName): number {
  switch (action) {
    case 'bite': return att.sheet.bite;
    case 'claw': return att.sheet.claw;
    case 'breath': return att.sheet.breath * (att.sheet.stone === 'earth' ? R.EARTH_OBSTACLE_MULTIPLIER : 1);
    default: return R.STOMP_DAMAGE;
  }
}

/**
 * Attacks that met an obstacle hit it instead and are spent [Proposed]. Damage from both sides lands
 * together; then destroyed obstacles are removed. Earth's slurry eats obstacles: if the obstacle it met
 * is destroyed, it carries on to the target. Returns the sides whose attack carries on.
 */
function strikeObstacles(bout: Bout, plans: Record<Side, Plan>, blocked: { s: Side; o: Obstacle }[], t: number, ev: Event[]): Side[] {
  // Water's jet shoves a boulder rather than breaking it [Proposed]; Earth's slurry eats through.
  const jet = (s: Side) => plans[s].spec.name === 'breath' && bout.fighters[s].sheet.stone === 'water';
  const dealt = blocked.map(({ s, o }) => (o.wounds === null || jet(s) ? 0 : obstacleDamage(bout.fighters[s], plans[s].spec.name)));
  blocked.forEach(({ o }, i) => {
    if (o.wounds !== null) o.wounds -= dealt[i];
  });
  const carryOn: Side[] = [];
  blocked.forEach(({ s, o }, i) => {
    const p = plans[s];
    const destroyed = o.wounds !== null && o.wounds <= 0;
    const through = destroyed && p.spec.name === 'breath' && bout.fighters[s].sheet.stone === 'earth';
    ev.push({ kind: 'obstacle', tick: t, attacker: s, action: p.spec.name, obstacle: describeObstacle(o), damage: dealt[i], destroyed, through });
    if (!destroyed && jet(s) && p.aim) shoveObstacle(bout, o, p.aim, t, s, ev);
    if (through) carryOn.push(s);
    else p.resolved = true;
  });
  bout.arena.obstacles = bout.arena.obstacles.filter((o) => o.wounds === null || o.wounds > 0);
  return carryOn;
}

/** Moves a dragon across the floor in ⅓-pace steps until the full distance or something stops it. */
/** Moves a dragon up to `amount` along `dir`; reports how far, and the wall or obstacle that stopped it, if one did. */
function shove(bout: Bout, side: Side, dir: Vec, amount: number): { moved: number; slam: string | null } {
  const f = bout.fighters[side];
  const opp = bout.fighters[other(side)];
  if (flatLen(dir) === 0) return { moved: 0, slam: null };
  let moved = 0;
  while (moved < amount) {
    const step = Math.min(R.NOTCH, amount - moved);
    const np = add(f.pos, scaleTo(flat(dir), step));
    if (flatLen(np) > R.ARENA_RADIUS) return { moved, slam: 'the arena wall' };
    const o = obstacleAt(bout.arena, np);
    if (o) return { moved, slam: describeObstacle(o) };
    if (dist(np, opp.pos) < R.BODY_GAP || dist(np, opp.pos) > R.LEASH) break;
    f.pos = np;
    moved += step;
  }
  return { moved, slam: null };
}

/** Water's jet shoves a boulder it strikes a band along the aim; it stops at the wall, other obstacles and dragons. */
function shoveObstacle(bout: Bout, o: Obstacle, dir: Vec, t: number, s: Side, ev: Event[]) {
  if (o.kind !== 'boulder' || flatLen(dir) === 0) return;
  let moved = 0;
  while (moved < R.WATER_OBSTACLE_PUSH) {
    const np = add(o.pos, scaleTo(flat(dir), Math.min(R.NOTCH, R.WATER_OBSTACLE_PUSH - moved)));
    if (flatLen(np) + o.radius > R.ARENA_RADIUS) break;
    if (bout.arena.obstacles.some((q) => q !== o && flatLen(sub(np, q.pos)) < q.radius + o.radius)) break;
    if (SIDES.some((d) => flatLen(sub(np, bout.fighters[d].pos)) < o.radius + R.BODY_RADIUS)) break;
    moved += Math.min(R.NOTCH, R.WATER_OBSTACLE_PUSH - moved);
    o.pos = { ...np, z: 0 };
  }
  if (moved > 0) ev.push({ kind: 'note', tick: t, side: s, text: `The jet shoves ${describeObstacle(o)} ${(moved / R.PACE).toFixed(1)} paces.` });
}

/** The breath's verb on a hit [Doc] §3: Water pushes back, Air shoves sideways. Fire and Earth act through zones. */
function breathVerb(bout: Bout, s: Side, aim: Vec, t: number, ev: Event[]) {
  const att = bout.fighters[s];
  const def = bout.fighters[other(s)];
  if (att.sheet.stone === 'water') {
    const { moved, slam } = shove(bout, def.side, aim, R.WATER_PUSH);
    ev.push({ kind: 'note', tick: t, side: def.side, text: moved > 0 ? `The jet pushes it back ${(moved / R.PACE).toFixed(1)} paces.` : 'The jet pushes, but something holds it in place.' });
    if (slam) {
      def.wounds -= R.WATER_SLAM;
      ev.push({ kind: 'note', tick: t, side: def.side, text: `Slammed into ${slam}: takes ${R.WATER_SLAM}.` });
    }
  } else if (att.sheet.stone === 'air') {
    // Shove away from the gust's center line; dead center goes counterclockwise.
    const d = sub(def.pos, att.pos);
    const side = aim.x * d.y - aim.y * d.x;
    const perp = side >= 0 ? vec(-aim.y, aim.x) : vec(aim.y, -aim.x);
    const { moved } = shove(bout, def.side, perp, R.AIR_SHOVE);
    ev.push({ kind: 'note', tick: t, side: def.side, text: moved > 0 ? `The gust shoves it sideways ${(moved / R.PACE).toFixed(1)} paces.` : 'The gust shoves, but something holds it in place.' });
  }
}

/** Fire leaves a burning zone and Earth a corrosive pool where the breath lands, on the floor below [Doc] §3. */
function leaveZone(bout: Bout, s: Side, origin: Vec, aim: Vec, t: number, ev: Event[]) {
  const stone = bout.fighters[s].sheet.stone;
  if (stone !== 'fire' && stone !== 'earth') return;
  const reach = stone === 'fire' ? R.BREATH.blast.maxCenter : R.BREATH.narrowCone.reach;
  const center = flat(add(origin, scaleTo(aim, Math.min(len(aim), reach))));
  const zone = stone === 'fire' ? 'burning' : 'corrosive';
  bout.arena.zones.push({ kind: zone, center, radius: R.ZONE_RADIUS, lastSlot: bout.globalSlot - 1 + R.ZONE_SLOTS, owner: s });
  ev.push({ kind: 'zone', tick: t, owner: s, zone, center });
}

/**
 * At slot's end, dragons inside a zone feel it, whoever breathed it; then spent zones fade.
 * Floor zones touch only grounded dragons. A dragon guarding with Mantle Wings (Elder) is shielded.
 * Smoldering Maw: 3 points and the element's verb; overlapping areas stack only for a Venerable.
 */
function zonesAtSlotEnd(bout: Bout, plans: Record<Side, Plan>, g: number, ev: Event[]) {
  const smoldered = new Set<Side>();
  for (const z of bout.arena.zones) {
    for (const s of SIDES) {
      const f = bout.fighters[s];
      if (!inZone(z, f.pos)) continue;
      if (plans[s].spec.name === 'scales' && tech(f, 'mantle-wings') >= E) continue;
      if (z.kind === 'burning') {
        f.wounds -= R.BURN_DAMAGE;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: R.BURN_DAMAGE, woundsLeft: f.wounds });
      } else if (z.kind === 'corrosive') {
        f.pending.corroded = true;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: 0, woundsLeft: f.wounds });
      } else {
        if (smoldered.has(s) && !z.stacks) continue;
        smoldered.add(s);
        f.wounds -= R.TECHNIQUE_POINTS;
        ev.push({ kind: 'zoneEffect', side: s, zone: z.kind, damage: R.TECHNIQUE_POINTS, woundsLeft: f.wounds });
        const away = sub(f.pos, z.center);
        if (z.element === 'water') shove(bout, s, away, R.SMOLDER_PUSH);
        if (z.element === 'air') shove(bout, s, vec(-away.y, away.x), R.AIR_SHOVE);
        if (z.element === 'earth') f.pending.corroded = true;
      }
    }
    // Smoldering Maw Elder: the lingering area eats at obstacles inside it.
    if (z.kind === 'smolder' && tech(bout.fighters[z.owner], 'smoldering-maw') >= E) {
      for (const o of bout.arena.obstacles) {
        if (o.wounds !== null && flatLen(sub(o.pos, z.center)) <= z.radius + o.radius) o.wounds -= R.TECHNIQUE_POINTS;
      }
      bout.arena.obstacles = bout.arena.obstacles.filter((o) => o.wounds === null || o.wounds > 0);
    }
  }
  bout.arena.zones = bout.arena.zones.filter((z) => z.lastSlot > g);
  checkKO(bout, ev, R.TICKS_PER_SLOT - 1);
}

// ---------------------------------------------------------------- the Wyvern stoop

/**
 * Wyvern Talons [Doc] §2, claws from hind talons on dives: a Claw scripted while aloft, against a grounded
 * opponent within Far, is a stoop. It bends the one-band move rule: during the wind-up the Wyvern flies
 * straight to the ground, landing at Melee short of where the target stood when the wind-up began, then
 * swipes both ways. Against an airborne opponent it simply claws. The price is getting airborne first.
 */
function beginStoop(att: Fighter, def: Fighter, p: Plan, t: number, ev: Event[]) {
  if (p.spec.name !== 'claw' || att.sheet.aspect !== 'talons' || att.pos.z === 0 || def.pos.z !== 0) return;
  if (dist(att.pos, def.pos) > R.STOOP_RANGE) return;
  const target = { ...def.pos };
  const back = flat(sub(att.pos, target));
  const offset = flatLen(back) === 0 ? vec(R.STOOP_LANDING, 0) : scaleTo(back, R.STOOP_LANDING);
  const to = add(target, offset);
  p.stoop = { from: { ...att.pos }, to, target };
  ev.push({ kind: 'note', tick: t, side: att.side, text: `Stoops from ${(dist(att.pos, to) / R.PACE).toFixed(1)} paces to land at Melee, talons first.` });
}

/**
 * Lunge [Proposed]: a Bite right after an Approach carries the dragon up to 1 pace along its locked line
 * during the wind-up. Pure geometry: a retreat that outruns it still escapes, and Evasion still applies.
 * Bodies, obstacles and the wall cut it short.
 */
function beginLunge(att: Fighter, p: Plan, ev: Event[]) {
  if (!p.aim || p.windup < 2) return;
  const ahead = flat(p.aim);
  const room = Math.min(R.BITE_LUNGE, Math.max(0, flatLen(ahead) - R.BODY_GAP));
  if (room <= 0 || flatLen(ahead) === 0) return;
  p.carry = { kind: 'lunge', from: { ...att.pos }, to: carryTo(att, ahead, room) };
  ev.push({ kind: 'note', tick: 0, side: att.side, text: `Lunges ${(dist(att.pos, p.carry.to) / R.PACE).toFixed(1)} paces into the Bite.` });
}

/**
 * Pounce [Proposed]: a Claw right after a Strafe advances up to one band along its locked line during
 * the active window, sweeping its arc as it goes, and pierces 3 Hardness. It stops at the stoop's landing
 * distance from where the target stood; a grounded Wyvern's short Claw pounces too. An airborne Wyvern
 * that strafes into a stoop gets the pierce on the stoop instead.
 */
function beginPounce(att: Fighter, p: Plan, ev: Event[]) {
  if (!p.aim) return;
  const ahead = flat(p.aim);
  const room = Math.min(R.POUNCE_REACH, Math.max(0, flatLen(ahead) - R.STOOP_LANDING));
  if (room <= 0 || flatLen(ahead) === 0) {
    ev.push({ kind: 'note', tick: 0, side: att.side, text: 'Pounces from the strafe, already in reach.' });
    return;
  }
  p.carry = { kind: 'pounce', from: { ...att.pos }, to: carryTo(att, ahead, room) };
  ev.push({ kind: 'note', tick: 0, side: att.side, text: `Pounces ${(dist(att.pos, p.carry.to) / R.PACE).toFixed(1)} paces out of the strafe.` });
}

function carryTo(att: Fighter, ahead: Vec, room: number): Vec {
  const to = add(att.pos, scaleTo(ahead, room));
  return flatLen(to) > R.ARENA_RADIUS ? { ...scaleTo(flat(to), R.ARENA_RADIUS), z: att.pos.z } : to;
}

/** Where a lunge or pounce has carried the dragon this tick: a lunge across the wind-up, a pounce across the active window. */
function carryStep(p: Plan, t: number, fallback: Vec): Vec {
  if (!p.carry) return fallback;
  const lunge = p.carry.kind === 'lunge';
  if (lunge ? t === 0 || phase(p, t) !== 'windup' : phase(p, t) !== 'active') return fallback;
  const span = lunge ? Math.max(1, p.windup - 1) : Math.max(1, p.active);
  const k = lunge ? Math.min(t, span) : Math.min(t - p.windup + 1, span);
  const { from, to } = p.carry;
  return vec(from.x + Math.trunc(((to.x - from.x) * k) / span), from.y + Math.trunc(((to.y - from.y) * k) / span), from.z);
}

/** Where a stooping Wyvern is this tick: a straight flight that touches down as the wind-up ends. */
function stoopStep(f: Fighter, p: Plan, t: number, fallback: Vec): Vec {
  if (!p.stoop || t === 0 || phase(p, t) !== 'windup') return fallback;
  const span = Math.max(1, p.windup - 1);
  const { from, to } = p.stoop;
  const k = Math.min(t, span);
  return vec(
    from.x + Math.trunc(((to.x - from.x) * k) / span),
    from.y + Math.trunc(((to.y - from.y) * k) / span),
    from.z + Math.trunc(((to.z - from.z) * k) / span),
  );
}

// ---------------------------------------------------------------- attributes with shard riders

interface RiderContext {
  opp?: Fighter;
  scales?: boolean;
  link?: number;
  sep?: number;
}

function riderHolds(c: Condition, f: Fighter, ctx: RiderContext): boolean {
  switch (c) {
    case 'halfWounds': return f.wounds * 2 <= f.sheet.wounds;
    case 'aloft': return f.pos.z > 0;
    case 'scales': return ctx.scales === true;
    case 'altitudeDiff': return ctx.opp !== undefined && ctx.opp.pos.z !== f.pos.z;
    case 'chainFinal': return ctx.link === 3;
    case 'crunchedDifferent': return false; // crunch isn't built yet
    case 'targetFar': return ctx.sep !== undefined && ctx.sep > R.CLOSE_EDGE && ctx.sep <= R.FAR_EDGE;
    case 'beatsMyStone': return ctx.opp !== undefined && matchup(ctx.opp.sheet.stone, f.sheet.stone) === 1;
  }
}

/** An attribute as it stands right now: the compiled sheet plus any shard riders whose condition holds. */
function eff(f: Fighter, attr: Attr, ctx: RiderContext): { value: number; note: string } {
  let value = f.sheet[attr];
  let bonus = 0;
  for (const r of f.loadout.riders) {
    if (r.attr === attr && riderHolds(r.condition, f, ctx)) bonus += r.points;
  }
  value += bonus;
  return { value, note: bonus ? ` (+${bonus} shard rider)` : '' };
}

// ---------------------------------------------------------------- techniques (dragonshards-technique.md)

/** What a landed hit sets off, by the attacker's and defender's Techniques. */
function techniqueOnHit(bout: Bout, s: Side, p: Plan, defPlan: Plan, t: number, graze: boolean, ev: Event[]) {
  const att = bout.fighters[s];
  const def = bout.fighters[other(s)];
  const note = (side: Side, text: string) => ev.push({ kind: 'note', tick: t, side, text });

  // Lockjaw: a landed Bite Pins; the biter's next slot locks to Bite (Adult: Bite or Guard).
  const lj = p.spec.name === 'bite' ? tech(att, 'lockjaw') : -1;
  if (lj >= W && (lj >= J || p.link === 3)) {
    def.pending.pinned = true;
    if (lj >= V) att.marks.lockjawFollow = true;
    note(def.side, 'Lockjaw: Pinned next slot.');
  }
  // Hamstring Hooks: a landed Claw Staggers (Elder: slows its next move; Venerable: no Leap).
  const hh = p.spec.name === 'claw' ? tech(att, 'hamstring-hooks') : -1;
  if (hh >= W && (hh >= J || p.link === 3)) {
    def.pending.staggered = true;
    if (hh >= E) def.pending.slowed = true;
    if (hh >= V) def.pending.grounded = true;
    note(def.side, `Hamstring Hooks: Staggered next slot${hh >= E ? ', and slowed' : ''}${hh >= V ? ', and can\'t Leap' : ''}.`);
  }
  // Thornscale: attackers landing into Scales take 3 (Wyrmling: Claw only; Juvenile: Claw and Bite).
  const th = tech(def, 'thornscale');
  const intoScales = guarding(defPlan, t);
  if (th >= W && intoScales && (p.spec.name === 'claw' || (th >= J && p.spec.name === 'bite'))) {
    att.wounds -= R.TECHNIQUE_POINTS;
    if (th >= V) att.pending.rattled = true;
    note(s, `Thornscale: takes ${R.TECHNIQUE_POINTS} from the spines${th >= V ? ' and is Rattled' : ''}.`);
  }
  // Ash Gland: locks the target's revision next exchange (Wyrmling: clean hits only).
  const ash = p.spec.name === 'breath' ? tech(att, 'ash-gland') : -1;
  if (ash >= W && (ash >= J || !graze)) {
    def.marks.revisionLockedFor = bout.exchange + 1;
    if (ash >= E) def.pending.blinded = true;
    if (ash >= V) def.pending.rattled = true;
    note(def.side, `Ash Gland: can't revise next exchange${ash >= E ? '; Blinded' : ''}${ash >= V ? ' and Rattled' : ''}.`);
  }
}

/** Riposte Talons: a successful Dodge earns a free claw (Wyrmling: only against Bite). */
function riposte(bout: Bout, s: Side, attackPlan: Plan, dodgePlan: Plan, t: number, ev: Event[]) {
  const f = bout.fighters[s];
  const target = bout.fighters[other(s)];
  const rip = tech(f, 'riposte-talons');
  if (rip < W || dodgePlan.spec.name !== 'dodge' || (rip === W && attackPlan.spec.name !== 'bite')) return;
  const parts: string[] = [];
  let v = R.TECHNIQUE_POINTS;
  if (rip >= V) {
    v = Math.max(R.DAMAGE_FLOOR, eff(f, 'claw', {}).value - eff(target, 'hardness', {}).value);
    parts.push(`Riposte Talons: Claw Sharpness against Hardness, ${v}`);
  } else parts.push(`Riposte Talons: ${v}`);
  if (rip >= E) {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish`);
  }
  target.wounds -= v;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: 'claw', damage: v, parts, interrupt: false, graze: false, trade: false, woundsLeft: target.wounds });
}

/** An Intimidate that reaches its target (within Far): the +3, or what a Technique trades it for. */
function intimidateLands(bout: Bout, s: Side, t: number, ev: Event[]) {
  const f = bout.fighters[s];
  const opp = bout.fighters[other(s)];
  const note = (text: string) => ev.push({ kind: 'note', tick: t, side: s, text });
  const sep = dist(f.pos, opp.pos);
  if (sep > R.FAR_EDGE) return note('Intimidate falls short: the opponent is beyond Far.');
  const sap = tech(f, 'sapping-bellow');
  const eye = tech(f, 'baleful-eye');
  const goad = tech(f, 'goading-roar');
  if (sap >= W) {
    opp.marks.sapped = sap >= J ? 'any' : 'claw';
    if (sap >= E) opp.intimidateBonus = false;
    if (sap >= V) opp.pending.rattled = true;
    return note(`Sapping Bellow: strips the opponent's next ${sap >= J ? '' : 'Claw '}chain bonus${sap >= E ? ' and its pending Intimidate' : ''}${sap >= V ? '; Rattled' : ''}.`);
  }
  if (eye >= W) {
    const slot = (bout.globalSlot - 1) % R.SLOTS_PER_EXCHANGE;
    if (slot < 2) {
      f.marks.eye = eye;
      return note("Baleful Eye: it will see the opponent's slot 3 during the revision window.");
    }
    return note('Baleful Eye in slot 3 sees nothing to reveal.');
  }
  if (goad >= W) {
    if (goad === W && sep > R.CLOSE_EDGE) return note('Goading Roar falls short: a Wyrmling roar needs Close or nearer.');
    opp.marks.goaded = goad;
    return note(`Goading Roar: a Retreat${goad >= E ? ' or Dodge' : ''} next slot will sting.`);
  }
  f.intimidateBonus = true;
  note('Intimidate lands: +3 to the next attack.');
}

/** Smoldering Maw: the breath's area lingers; dragons inside at slot's end take 3 and the element's verb. */
function smolder(bout: Bout, s: Side, origin: Vec, aim: Vec, t: number, ev: Event[]) {
  const f = bout.fighters[s];
  const sm = tech(f, 'smoldering-maw');
  if (sm < W) return;
  const reach = tech(f, 'lance-throat') >= W ? R.FAR_EDGE : f.sheet.stone === 'water' ? R.BREATH.line.reach : f.sheet.stone === 'earth' ? R.BREATH.narrowCone.reach : f.sheet.stone === 'air' ? R.BREATH.wideCone.reach : R.BREATH.blast.maxCenter;
  // The area is centered where the breath reaches its target, or its full reach.
  const center = add(origin, scaleTo(aim, Math.min(len(aim), reach)));
  bout.arena.zones.push({
    kind: 'smolder', element: f.sheet.stone, stacks: sm >= V, center,
    radius: sm === W ? R.SMOLDER_RADIUS.center : R.SMOLDER_RADIUS.full,
    lastSlot: bout.globalSlot - 1 + (sm >= A ? 2 : 1), owner: s,
  });
  ev.push({ kind: 'zone', tick: t, owner: s, zone: 'smolder', center });
}
