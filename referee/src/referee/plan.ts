// Plans: what each dragon's action does this slot, tick by tick, after every rule that bends it.

import { ACTIONS, HOLD, describe, type ActionSpec } from '../actions.ts';
import { dist, type Vec } from '../geometry.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import type { Event, NoteTag } from './events.ts';
import { eff } from './riders.ts';
import { A, E, type Fighter, J, V, W, tech } from './state.ts';

export type Phase = 'windup' | 'active' | 'recovery' | 'idle';

export interface Plan {
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
  /** this Bite or Claw was demoralized by an Intimidate: −3 [Proposed] */
  demoralized: boolean;
  /** a Wyvern stoop: descends from the air to the ground during the wind-up, carrying at most a band */
  stoop: { from: Vec; to: Vec; target: Vec } | null;
  /** the tick the aim settles: until then it follows the target [Proposed] */
  aimLock: number;
  /** a lunging Bite (during the wind-up) or a pouncing Claw (during the active window) [Proposed] */
  carry: { kind: 'lunge' | 'pounce'; from: Vec; to: Vec } | null;
  /** this Bite follows an Approach and may lunge [Proposed] */
  lunges: boolean;
  /** a Drake's Bite in its Ravener window: it lunges, and tracks at Melee and Close [Proposed] */
  ravener: boolean;
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
  /** Lockjaw (clamp, Adult): this Bite can't Pin */
  noPin: boolean;
  /** Thornscale (window): this guard's thorns have struck (a Wyrmling's strike once a guard) */
  thornsUsed: boolean;
  /** Bellows Chest (mobile): a Breath charge carried on a move; a landed hit breaks it */
  mobileCharge: boolean;
  /** the charging slot of a charge: it guards like Scales and attacks nothing */
  charging: boolean;
  /** a crunch: two attacks of 15 ticks each */
  halves: [number, number, number][] | null;
  landedHalves: number;
  /** a hard landing: the whole descent, then a free Stomp where it lands [Doc] */
  hardLanding: boolean;
  quaked: boolean;
}

export const category = (p: Plan) => (p.charging ? 'guard' : ACTIONS[p.spec.name].category);

/** Guarding like Scales: Scales itself, or the charging slot of a charge [Proposed]. */
export const guarding = (p: Plan, t: number) => (p.spec.name === 'scales' || p.charging) && phase(p, t) === 'active';

/** The last active tick of the window t falls in (a crunch has one per half). */
export function lastActiveTick(p: Plan, t: number): number {
  if (!p.halves) return p.windup + p.active - 1;
  const h = t < R.HALF ? 0 : 1;
  return h * R.HALF + p.halves[h][0] + p.halves[h][1] - 1;
}

/** A crunch half's profile: wind-up and recovery halve, rounding down; the active window absorbs the rest [Proposed]. */
export function halfTiming(rules: Rules, profile: readonly [number, number, number], extraRecovery: number): [number, number, number] {
  let w = Math.floor(profile[0] / 2);
  let r = Math.floor(profile[2] / 2) + extraRecovery;
  let a = R.HALF - w - r;
  if (a < rules.MIN_ACTIVE) {
    let need = rules.MIN_ACTIVE - a;
    const fromR = Math.min(r, need);
    r -= fromR;
    need -= fromR;
    w -= need;
    a = rules.MIN_ACTIVE;
  }
  return [w, a, r];
}

export function phase(p: Plan, t: number): Phase {
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
export function timing(rules: Rules, profile: readonly [number, number, number], windupShift: number, recoveryShift: number): [number, number, number] {
  let w = Math.max(0, profile[0] + windupShift);
  let r = Math.max(0, profile[2] + recoveryShift);
  let a = R.TICKS_PER_SLOT - w - r;
  if (a < rules.MIN_ACTIVE) {
    // Shifts past the floor are lost: trim recovery first, then wind-up.
    let need = rules.MIN_ACTIVE - a;
    const fromR = Math.min(r, need);
    r -= fromR;
    need -= fromR;
    w -= need;
    a = rules.MIN_ACTIVE;
  }
  return [w, a, r];
}

export function makePlan(rules: Rules, f: Fighter, opp: Fighter, requested: ActionSpec, g: number, slot: number, prevLanded: boolean, ev: Event[]): Plan {
  let spec = requested;
  const note = (tag: NoteTag, text: string) => ev.push({ kind: 'note', tick: 0, side: f.side, tag, text });

  // A charge begun last slot releases now, whatever this slot scripted. Scripting the same charge again holds it
  // a second slot (not into slot 3), and only that second slot earns the bonus [Proposed].
  let holding = false;
  if (f.marks.charge) {
    const c = f.marks.charge;
    if (requested.charge && requested.name === c.action && c.slots === 1 && slot < 2) {
      spec = { name: c.action, sweep: c.sweep, charge: true, move: requested.move, dir: requested.dir };
      holding = true;
      note('charge-held', `Holds the ${ACTIONS[spec.name].label} charge a second slot.`);
    } else {
      spec = { name: c.action, sweep: c.sweep, released: true, full: c.slots >= 2 };
      f.marks.charge = null;
      note('charge-released', `Releases the charged ${ACTIONS[spec.name].label}.`);
    }
  }
  // Lunge [Proposed]: a Bite right after an Approach that moved carries the dragon forward.
  // Ravener [Proposed]: a Drake's first Bite in its window lunges and tracks, and closes the window.
  const ravener = f.sheet.aspect === 'ravener' && f.marks.ravener > 0 && spec.name === 'bite' && !spec.crunch && !spec.charge;
  if (ravener) f.marks.ravener = 0;
  const lunges = f.marks.advanced || ravener;
  f.marks.advanced = false;
  // Pounce [Proposed]: a Claw right after a Strafe that moved.
  const pounces = f.marks.strafed;
  f.marks.strafed = false;

  // Lockjaw Venerable: a Bite the slot after a landed Lockjaw Bite gains +3 (under the parity variants, the next
  // attack of any kind). Nothing is forced.
  const lockjawBonus = f.marks.lockjawFollow && (spec.name === 'bite' || (rules.TECH_LOCKJAW !== 'base' && ACTIONS[spec.name].category === 'attack'));
  f.marks.lockjawFollow = false;
  // Lockjaw (clamp): a jaw shut on a Pin can't Bite this slot; at Adult it may, but that Bite can't Pin.
  if (f.marks.clamped && spec.name === 'bite') {
    note('held-instead', 'Lockjaw: the jaw is still clamped; it can\'t Bite this slot, and holds instead.');
    spec = HOLD;
  }
  f.marks.clamped = false;
  const noPin = f.marks.noPinNext && spec.name === 'bite';
  f.marks.noPinNext = false;
  const ready = f.readyAt[spec.name] ?? 0;
  if (ready > g + (spec.charge ? 1 : 0)) {
    note('held-instead', `${describe(spec)} is still cooling down; holds instead.`);
    spec = HOLD;
  }
  if (f.status.pinned && ACTIONS[spec.name].category === 'move') {
    note('held-instead', `Pinned: can't ${describe(spec)}; holds instead.`);
    spec = HOLD;
  }
  if (spec.name === 'dive' && f.pos.z === 0) {
    note('held-instead', 'Already on the ground: nothing to dive from; holds instead.');
    spec = HOLD;
  }
  if (spec.name === 'stomp' && f.pos.z > 0) {
    note('held-instead', "Can't Stomp while aloft; holds instead.");
    spec = HOLD;
  }
  if (spec.name === 'leap' && (f.status.grounded || f.marks.noLeap)) {
    note('held-instead', f.status.grounded ? 'Hamstrung: can\'t Leap; holds instead.' : 'Just dived: can\'t Leap this slot; holds instead.');
    spec = HOLD;
  }
  f.marks.noLeap = false;

  // Charging: one action across two slots [Doc]. It must release by slot 3; only the Ouroboros wraps a charge.
  if (spec.charge && slot >= 2) {
    note('held-instead', 'A charge must release by slot 3: charging in slot 3 holds instead.');
    spec = HOLD;
  }
  // Crunching comes only from shards [Doc]: Raking Talons for Claw, Gnashing Teeth for Bite.
  const crunchTech = spec.name === 'claw' ? tech(f, 'raking-talons') : spec.name === 'bite' ? tech(f, 'gnashing-teeth') : -1;
  if (spec.crunch && crunchTech >= 0 && f.marks.crunchedIn === Math.floor(g / R.SLOTS_PER_EXCHANGE)) {
    note('crunch-capped', `One crunch per exchange: the ${ACTIONS[spec.name].label} attacks once.`);
    spec = { ...spec, crunch: undefined };
  }
  if (spec.crunch && (crunchTech < 0 || (crunchTech === W && !prevLanded))) {
    note('crunch-refused', crunchTech < 0
      ? `Crunching a ${ACTIONS[spec.name].label} needs ${spec.name === 'claw' ? 'Raking Talons' : 'Gnashing Teeth'}: attacks once.`
      : `A Wyrmling crunch needs a landed ${ACTIONS[spec.name].label} in the slot before: attacks once.`);
    spec = { ...spec, crunch: undefined };
  }
  const sw = tech(f, 'sidewinder-spine');
  if (spec.shift && (sw < 0 || (sw === W && spec.shift === 'in'))) {
    note('technique', sw < 0 ? 'Strafes without shifting: that needs Sidewinder Spine.' : 'A Wyrmling Sidewinder Spine only shifts away.');
    spec = { name: spec.name, dir: spec.dir };
  }

  // Goading Roar: a goaded Retreat stings, even when the leash turns it into a roar.
  if (f.marks.goaded !== null) {
    const gr = f.marks.goaded;
    f.marks.goaded = null;
    if (spec.name === 'retreat' || (gr >= E && spec.name === 'dodge')) {
      f.wounds -= rules.TECHNIQUE_POINTS;
      note('technique', `Goaded into a ${describe(spec)}: takes ${rules.TECHNIQUE_POINTS}.`);
      if (gr >= V) f.status.rattled = true;
    }
  }

  // Bellows Chest (mobile): a Breath charge carried on a move. The slot scripts as charge plus Move; the Move resolves
  // on its own timing, and the charge holds unless a landed hit breaks it. A moving charge doesn't guard.
  let mobileCharge = false;
  if (spec.charge && spec.name === 'breath' && spec.move) {
    const bel = tech(f, 'bellows-chest');
    const ok = rules.TECH_BELLOWS_CHEST === 'mobile' && bel >= W && (spec.move === 'retreat' || (bel >= J && spec.move === 'strafe') || bel >= V);
    if (ok) {
      if (!holding) f.marks.charge = { action: 'breath', slots: 1 };
      mobileCharge = true;
      note('technique', `Bellows Chest: charges the Breath on the move (${spec.move}).`);
      spec = { name: spec.move, ...(spec.dir ? { dir: spec.dir } : {}) };
    } else {
      note('technique', 'A charge on the move needs Bellows Chest (Wyrmling: Retreat; Juvenile: Strafe too; Venerable: any Move): charges in place.');
      spec = { name: spec.name, charge: true };
    }
  }
  const def = ACTIONS[spec.name];
  const rip = tech(f, 'riposte-talons');
  const cooldown = def.cooldown + (spec.name === 'dodge' && rip >= W && rip < A ? 1 : 0);
  // A charging breath's cooldown starts when it releases.
  if (cooldown > 0 && !spec.charge) f.readyAt[spec.name] = g + cooldown + 1;

  // Timing shifts move the active window's edges.
  let wShift = f.status.rattled ? rules.RATTLED_WINDUP : 0;
  let rShift = 0;
  const snap = tech(f, 'snapping-jaw');
  // Snapping Jaw (borrow): a snap's ticks come out of the next slot's wind-up, whatever it is; a Hold settles it.
  const owed = f.marks.snapDebt;
  f.marks.snapDebt = 0;
  if (owed && spec.name !== 'hold') {
    wShift += owed;
    note('technique', `Snapping Jaw: pays back ${owed} ticks of wind-up borrowed by last slot's snap.`);
  }
  if (spec.name === 'bite' && snap >= W) {
    if (rules.TECH_SNAPPING_JAW === 'base') {
      wShift += snap === W ? -3 : -5;
      rShift += snap >= A ? 3 : 5;
    } else {
      // The active window shifts earlier and keeps its length; the debt is taken as the wind-up starts.
      const lead = snap === W ? 3 : 5;
      wShift -= lead;
      rShift += lead;
      f.marks.snapDebt = snap === J ? 5 : 3;
    }
  }
  // Lockjaw (recovery): every Bite recovers slower, +5 (+3 from Adult).
  const lj = tech(f, 'lockjaw');
  if (spec.name === 'bite' && lj >= W && rules.TECH_LOCKJAW === 'recovery') rShift += lj >= A ? 3 : 5;
  // Ratchet Claws (escalate): Claw recovers 3 ticks slower (from Adult, only an unratcheted Claw).
  const ratchetC = tech(f, 'ratchet-claws');
  if (spec.name === 'claw' && ratchetC >= W && rules.TECH_RATCHET_CLAWS === 'escalate' && (ratchetC < A || f.marks.ratchet === 0)) rShift += 3;
  // Thornscale (window): a thorned guard's window closes 3 ticks early (2 from Adult).
  const thornT = tech(f, 'thornscale');
  if (spec.name === 'scales' && thornT >= W && rules.TECH_THORNSCALE === 'window') rShift += thornT >= A ? 2 : 3;
  const ham = tech(f, 'hamstring-hooks');
  if (spec.name === 'claw' && ham >= W) rShift += ham >= A ? 3 : 5;
  const bound = tech(f, 'bounding-haunches');
  const bounding = spec.name === 'approach' && bound >= W && (bound >= J || dist(f.pos, opp.pos) > R.CLOSE_EDGE);
  if (bounding) rShift += bound >= A ? 3 : 6;
  if (f.marks.quick && (f.marks.quick === 'any' || spec.name === 'bite' || spec.name === 'claw') && spec.name !== 'hold') {
    wShift -= 3;
    f.marks.quick = null;
  }
  // The Drake's hop [Proposed]: slow to start, quick to recover (a move's recovery is what the slot leaves).
  if (spec.name === 'leap' && f.sheet.aspect === 'ravener') wShift += rules.DRAKE_HOP_WINDUP;
  let [windup, active, recovery] = timing(rules, def.profile, wShift, rShift);

  let hardLanding = false;
  let moveTotal = 0;
  let travel = active;
  let shiftTotal = 0;
  if (def.category === 'move') {
    // Evasion buys a move's timing and finesse, not (for band moves) its reach [Proposed]. Staggered halves it.
    const evasion = Math.max(1, Math.floor(eff(f, 'evasion', {}).value / (f.status.staggered ? 2 : 1)));
    {
      // Every primary move carries a band (a Strafe's as arc); Evasion picks the landing within it.
      const finesse = Math.floor((evasion * R.PACE) / rules.MOVE_DEPTH_DIVISOR);
      moveTotal = rules.BAND_MOVE + (spec.depth === 'long' ? finesse : spec.depth === 'short' ? -finesse : 0);
      // Bounding Haunches: an Approach carries two bands [Doc].
      if (bounding) moveTotal += rules.BAND_MOVE;
      // Talons [Doc]: a Wyvern's Leap climbs up to two bands.
      if (spec.name === 'leap' && f.sheet.aspect === 'talons') moveTotal += (rules.TALONS_LEAP_BANDS - 1) * rules.BAND_MOVE;
    }
    // Wind-up, then an evasive active window of 2 × Evasion ticks, then recovery; travel runs 72 ÷ Evasion ticks.
    active = Math.min(R.TICKS_PER_SLOT - windup, Math.max(rules.MIN_ACTIVE, rules.EVADE_TICKS_PER_POINT * evasion));
    recovery = R.TICKS_PER_SLOT - windup - active;
    travel = Math.min(R.TICKS_PER_SLOT - windup, Math.max(1, Math.round(rules.MOVE_SPEED / evasion)));
    if (spec.name === 'strafe' && sw >= W && (sw < A || spec.shift)) moveTotal = Math.max(0, moveTotal - R.PACE);
    if (spec.shift) shiftTotal = (sw >= A ? 2 : 1) * R.PACE;
    if (f.status.slowed) travel = Math.min(R.TICKS_PER_SLOT - windup, travel + 3);
    if (spec.name === 'dive' && tech(f, 'stooping-pinions') >= E) travel = Math.max(1, travel - 3);
    // A hard landing [Doc]: from two bands up or more, with Stomp ready, the Dive comes all the way down and Stomps
    // where it lands. Otherwise it dives a band.
    if (spec.name === 'dive' && spec.hard) {
      const stompReady = (f.readyAt.stomp ?? 0) <= g;
      if (f.pos.z >= 2 * R.BAND && stompReady) {
        hardLanding = true;
        moveTotal = f.pos.z;
        f.readyAt.stomp = g + ACTIONS.stomp.cooldown + 1;
      } else note('held-instead', `A hard landing needs two bands of altitude${stompReady ? '' : ' and Stomp ready'}: dives a band instead.`);
    }
  }

  let link = 0;
  let intimidateBonus = false;
  let demoralized = false;
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
    if (spec.name === 'bite' || spec.name === 'claw') {
      demoralized = f.marks.demoralized;
      f.marks.demoralized = false;
    }
    diveBonus = f.marks.diveBonus;
    f.marks.diveBonus = false;
  }
  if (spec.crunch) f.marks.crunchedIn = Math.floor(g / R.SLOTS_PER_EXCHANGE);
  const halves: [number, number, number][] | null = spec.crunch
    ? [halfTiming(rules, def.profile, 0), halfTiming(rules, def.profile, crunchTech >= A ? 3 : 6)]
    : null;
  const [w0, a0, r0] = charging ? [0, R.TICKS_PER_SLOT, 0] : halves ? halves[0] : [windup, active, recovery];

  return {
    spec, windup: w0, active: a0, recovery: r0, interruptedAt: null,
    resolved: false, landed: false, nearMiss: false, origin: null, aim: null,
    moveTotal, travel, moved: 0, converted: null, link, intimidateBonus, demoralized, aimLock: 0, stoop: null, carry: null, lunges: lunges && spec.name === 'bite' && !spec.crunch, ravener,
    pounces: pounces && spec.name === 'claw' && !spec.crunch,
    shiftTotal, shifted: 0, startZ: f.pos.z, evaded: false, chainPaused: f.chain.saves > 0, lockjawBonus, diveBonus, noPin, thornsUsed: false, mobileCharge,
    charging, halves, landedHalves: 0, hardLanding, quaked: false,
  };
}

/** A move is under way from the end of its wind-up until its travel ticks run out (into recovery, for slow dragons). */
export function traveling(p: Plan, t: number): boolean {
  return phase(p, t) !== 'idle' && t >= p.windup && t < p.windup + p.travel;
}

export function evasionState(p: Plan, t: number): 'moving' | 'dodging' | null {
  if (phase(p, t) !== 'active') return null;
  if (p.spec.name === 'dodge' || p.converted === 'dodge') return 'dodging';
  if (category(p) === 'move' && p.converted === null) return 'moving';
  return null;
}
