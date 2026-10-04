// The brain: an AI tamer that reads its opponent, imagines the exchange in the Referee, and chooses
// among good scripts by its style's values. It sees only what a player sees.
//
//   1. Read      tally the opponent's habits from the public slot record
//   2. Imagine   play candidate scripts against predicted opponent scripts in cloned bouts
//   3. Value     score each imagined outcome by the style's priorities
//   4. Choose    pick among the best with weighted chance, so it can bluff
//   5. Tell      each style keeps a readable habit; lower skill shows it more

import { ACTIONS, type ActionName, type ActionSpec } from './actions.ts';
import type { Controller, View } from './bout.ts';
import { flatLen } from './geometry.ts';
import { seededRandom } from './random.ts';
import { simulateSlot, runExchange, type Bout, type Event, type Fighter, type Moment, type Side } from './referee.ts';
import * as R from './rules.ts';

// ---------------------------------------------------------------- styles and skill

export type BrainStyle =
  | 'swarmer' | 'out-boxer' | 'slugger' | 'counterpuncher' | 'boxer-puncher' | 'aerialist' | 'reader'
  | 'claw-focus' | 'bite-focus' | 'breath-focus';
export const BRAIN_STYLES: readonly BrainStyle[] = [
  'swarmer', 'out-boxer', 'slugger', 'counterpuncher', 'boxer-puncher', 'aerialist', 'reader',
  'claw-focus', 'bite-focus', 'breath-focus',
];

/**
 * Focus brains attack with one thing only: Claw at Melee, Bite at Close, or Breath at Far. Every move,
 * guard and Intimidate stays open to them, in service of landing that one attack.
 */
const FOCUS: Partial<Record<BrainStyle, { attack: ActionName; band: 'melee' | 'close' | 'far' }>> = {
  'claw-focus': { attack: 'claw', band: 'melee' },
  'bite-focus': { attack: 'bite', band: 'close' },
  'breath-focus': { attack: 'breath', band: 'far' },
};

/** Whether this style may script this action: focus brains attack only with their focus. */
export function allowed(style: BrainStyle, a: ActionSpec): boolean {
  const focus = FOCUS[style];
  return !focus || ACTIONS[a.name].category !== 'attack' || a.name === focus.attack;
}

export type Skill = 'novice' | 'adept' | 'master';
export const SKILLS: readonly Skill[] = ['novice', 'adept', 'master'];

interface SkillLevel {
  /** candidate scripts it imagines */
  candidates: number;
  /** opponent scripts it imagines each candidate against */
  guesses: number;
  /** how loosely it picks among good scripts: higher plays more often off its best */
  temperature: number;
  /** how quickly old habits fade from its read, per exchange */
  memory: number;
  /** how often its style's tell shows */
  tell: number;
  /** counter-scripts it builds against its likeliest guesses, slot by slot in the Referee */
  counters: number;
}

const SKILL: Record<Skill, SkillLevel> = {
  novice: { candidates: 8, guesses: 4, temperature: 0.08, memory: 0.5, tell: 0.9, counters: 0 },
  adept: { candidates: 14, guesses: 6, temperature: 0.04, memory: 0.8, tell: 0.5, counters: 1 },
  master: { candidates: 28, guesses: 12, temperature: 0.015, memory: 0.95, tell: 0.15, counters: 2 },
};

/** Which actions each style reaches for first when imagining scripts, by range band. Others still get a look. */
type Band = 'melee' | 'close' | 'far' | 'veryFar';
const LEAN: Record<BrainStyle, Partial<Record<ActionName, number>> | ((band: Band, aloft: boolean, oppAloft: boolean) => Partial<Record<ActionName, number>>)> = {
  swarmer: (b) => (b === 'melee' ? { claw: 4, bite: 2, stomp: 1 } : b === 'close' ? { approach: 3, bite: 3, claw: 1 } : { approach: 4, breath: 1 }),
  'out-boxer': (b) => (b === 'melee' || b === 'close' ? { retreat: 3, strafe: 2, breath: 3, leap: 1 } : b === 'far' ? { breath: 4, strafe: 2, retreat: 1 } : { approach: 2, strafe: 2 }),
  slugger: (b) => (b === 'melee' ? { stomp: 3, bite: 2, intimidate: 2, claw: 1 } : b === 'close' ? { bite: 4, intimidate: 3 } : { approach: 3, intimidate: 1, breath: 2 }),
  counterpuncher: (b) => (b === 'melee' ? { scales: 3, dodge: 2, claw: 2 } : b === 'close' ? { scales: 3, dodge: 2, bite: 2, strafe: 1 } : { breath: 2, scales: 1, strafe: 2 }),
  'boxer-puncher': {},
  aerialist: (_b, aloft, oppAloft) => (aloft && !oppAloft ? { claw: 4, breath: 2, approach: 1 } : { leap: 4, breath: 2, dive: 1 }),
  reader: (b) => (b === 'far' || b === 'veryFar' ? { intimidate: 3, breath: 2, approach: 2 } : { intimidate: 3, scales: 2, bite: 2, claw: 2 }),
  'claw-focus': (b) => (b === 'melee' ? { claw: 5, dodge: 1, scales: 1, strafe: 1 } : { approach: 4, strafe: 1, dodge: 1 }),
  'bite-focus': (b) => (b === 'close' ? { bite: 5, strafe: 1, scales: 1, intimidate: 1 } : b === 'melee' ? { retreat: 3, bite: 2, dodge: 1 } : { approach: 4, strafe: 1 }),
  'breath-focus': (b) => (b === 'far' ? { breath: 5, strafe: 2, scales: 1 } : b === 'veryFar' ? { approach: 3, breath: 1 } : { retreat: 4, leap: 1, breath: 2, dodge: 1 }),
};

const bandOf = (sep: number): Band => (sep <= R.MELEE_EDGE ? 'melee' : sep <= R.CLOSE_EDGE ? 'close' : sep <= R.FAR_EDGE ? 'far' : 'veryFar');

// ---------------------------------------------------------------- 1. the read

/**
 * The opponent's habits: how often it used each action, by range band, slot, and whether its Breath was
 * ready. Old habits fade. Guesses start from an informed prior (what is available and sensible at that
 * range) and lean toward what the opponent has actually shown.
 */
export class Read {
  private counts = new Map<string, Map<ActionName, number>>();

  constructor(view: View, memory: number) {
    const them = view.opp.side;
    for (const r of view.record) {
      const weight = Math.pow(memory, Math.max(0, view.exchange - r.exchange));
      const band = bandOf(r.separation);
      const ready = r.breathReady?.[them] ?? false;
      for (const key of [`${band}|${r.slot}|${ready}`, `${band}|${ready}`, band]) {
        const m = this.counts.get(key) ?? new Map<ActionName, number>();
        m.set(r.actions[them], (m.get(r.actions[them]) ?? 0) + weight);
        this.counts.set(key, m);
      }
    }
  }

  /** A likely opponent action here, from what it could do and what it has done. */
  guess(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[], rng: () => number): ActionSpec {
    return pick(legal, this.weights(band, slot, breathReady, legal), rng);
  }

  /** The single likeliest action here. */
  likeliest(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[]): ActionSpec {
    const w = this.weights(band, slot, breathReady, legal);
    return legal[w.indexOf(Math.max(...w))];
  }

  private weights(band: Band, slot: number, breathReady: boolean, legal: ActionSpec[]): number[] {
    const exact = this.counts.get(`${band}|${slot}|${breathReady}`);
    const ready = this.counts.get(`${band}|${breathReady}`);
    const general = this.counts.get(band);
    return legal.map((a) => prior(band, a) + 3 * (exact?.get(a.name) ?? 0) + 2 * (ready?.get(a.name) ?? 0) + (general?.get(a.name) ?? 0));
  }
}

/** An educated guess before any habits are known: what a sensible dragon does at this range. */
function prior(band: Band, a: ActionSpec): number {
  const table: Record<Band, Partial<Record<ActionName, number>>> = {
    melee: { claw: 3, bite: 2, stomp: 1.5, scales: 1.5, dodge: 1, retreat: 1, breath: 1 },
    close: { bite: 3, breath: 2.5, claw: 1, approach: 1.5, strafe: 1.5, scales: 1, retreat: 1 },
    far: { breath: 4, approach: 2, strafe: 2, retreat: 1, intimidate: 1, leap: 1 },
    veryFar: { approach: 3, strafe: 1, leap: 1, intimidate: 0.5 },
  };
  const base = table[band][a.name] ?? 0.4;
  return a.charge ? base * 0.5 : a.crunch ? base * 1.5 : base;
}

function pick<T>(items: T[], weights: number[], rng: () => number): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ---------------------------------------------------------------- legal options

interface Situation {
  f: Fighter;
  globalSlot: number;
  z: number;
  readyAt: Partial<Record<ActionName, number>>;
}

/** Everything this dragon could script in a slot, with the details picked at random. */
function legalActions(s: Situation, rng: () => number): ActionSpec[] {
  const ready = (a: ActionName) => (s.readyAt[a] ?? 0) <= s.globalSlot;
  const side = (): 'left' | 'right' => (rng() < 0.5 ? 'left' : 'right');
  const turn = (): 'cw' | 'ccw' => (rng() < 0.5 ? 'cw' : 'ccw');
  const out: ActionSpec[] = [
    { name: 'bite' }, { name: 'claw', sweep: side() }, { name: 'approach' }, { name: 'retreat' },
    { name: 'strafe', dir: turn() }, { name: 'scales' }, { name: 'intimidate' },
  ];
  if (ready('breath')) out.push({ name: 'breath' });
  if (ready('stomp') && s.z === 0) out.push({ name: 'stomp' });
  if (ready('dodge')) out.push({ name: 'dodge' });
  if (s.f.sheet.flies && s.z < R.MAX_ALTITUDE) out.push({ name: 'leap' });
  if (s.z > 0) out.push({ name: 'dive' });
  // A charge takes this slot and the next; it must release by slot 3.
  if (s.globalSlot % R.SLOTS_PER_EXCHANGE < 2) {
    out.push({ name: 'bite', charge: true });
    if ((s.readyAt.breath ?? 0) <= s.globalSlot + 1) out.push({ name: 'breath', charge: true });
  }
  // Crunches come only from shards (a Wyrmling-grade crunch needs a landed hit first, so it isn't planned).
  const grade = (id: string) => s.f.loadout.techniques.find((t) => t.id === id)?.grade;
  const g1 = grade('raking-talons');
  if (g1 && g1 !== 'wyrmling') out.push({ name: 'claw', sweep: side(), crunch: true });
  const g2 = grade('gnashing-teeth');
  if (g2 && g2 !== 'wyrmling') out.push({ name: 'bite', crunch: true });
  return out;
}

/** Appends an action to a script being built, filling a charge's release slot too. */
function place(out: ActionSpec[], s: Situation, a: ActionSpec): Situation {
  out.push(a);
  let next = advance(s, a.charge ? { name: 'hold' } : a);
  if (a.charge && out.length < R.SLOTS_PER_EXCHANGE) {
    out.push({ name: a.name });
    next = advance(next, { name: a.name });
  }
  return next;
}

/** Advances the imagined situation past one action: cooldowns and altitude. */
function advance(s: Situation, a: ActionSpec): Situation {
  const readyAt = { ...s.readyAt };
  const cd = ACTIONS[a.name].cooldown;
  if (cd > 0) readyAt[a.name] = s.globalSlot + cd + 1;
  const step = Math.min(s.f.sheet.evasion * R.EVASION_STEP, R.MOVE_CAP);
  const z = a.name === 'leap' && s.f.sheet.flies ? Math.min(R.MAX_ALTITUDE, s.z + step) : a.name === 'dive' ? Math.max(0, s.z - step) : a.name === 'claw' && s.f.sheet.aspect === 'talons' ? 0 : s.z;
  return { ...s, globalSlot: s.globalSlot + 1, z, readyAt };
}

// ---------------------------------------------------------------- 3. values

interface Outcome {
  before: Bout;
  after: Bout;
  events: Event[];
  me: Side;
}

/** How a style scores an imagined outcome. Damage is in fractions of a Wounds pool. */
export function value(style: BrainStyle, o: Outcome): number {
  const them: Side = o.me === 'A' ? 'B' : 'A';
  const me0 = o.before.fighters[o.me];
  const me1 = o.after.fighters[o.me];
  const op0 = o.before.fighters[them];
  const op1 = o.after.fighters[them];
  const dealt = (op0.wounds - Math.max(0, op1.wounds)) / op0.sheet.wounds;
  const taken = (me0.wounds - Math.max(0, me1.wounds)) / me0.sheet.wounds;
  if (o.after.over) return o.after.winner === o.me ? 10 + dealt : -10 - taken;

  const sep = Math.hypot(me1.pos.x - op1.pos.x, me1.pos.y - op1.pos.y, me1.pos.z - op1.pos.z);
  const band = bandOf(sep);
  const myHits = o.events.filter((e): e is Extract<Event, { kind: 'hit' }> => e.kind === 'hit' && e.attacker === o.me);
  const big = myHits.filter((h) => h.damage >= 9).length;
  const punishes = myHits.filter((h) => h.parts.some((p) => p.includes('punish'))).length;
  const theirMisses = o.events.filter((e) => (e.kind === 'whiff' || e.kind === 'nearMiss' || e.kind === 'evade') && e.attacker === them).length;
  const late = o.after.exchange >= R.EXCHANGE_LIMIT - 3 && flatLen(me1.pos) >= R.ARENA_RADIUS - R.RIM_DEPTH;
  const rim = late ? -0.15 : 0;

  switch (style) {
    case 'swarmer':
      return dealt - 0.8 * taken + (band === 'melee' ? 0.08 : band === 'close' ? 0.04 : -0.04) + 0.04 * me1.chain.links + rim;
    case 'out-boxer':
      return dealt - 1.3 * taken + (band === 'far' ? 0.08 : band === 'close' ? 0 : band === 'melee' ? -0.1 : -0.02) + rim;
    case 'slugger':
      return dealt - 0.8 * taken + 0.05 * big + 0.05 * punishes + (me1.intimidateBonus ? 0.04 : 0) + rim;
    case 'counterpuncher':
      return dealt - 1.4 * taken + 0.04 * theirMisses + 0.06 * punishes + rim;
    case 'boxer-puncher':
      return dealt - taken + rim;
    case 'aerialist':
      return dealt - taken + (me1.pos.z > 0 && op1.pos.z === 0 && sep <= R.STOOP_RANGE ? 0.06 : 0) + rim;
    case 'reader':
      return dealt - taken + (op1.marks.revisionLockedFor > o.after.exchange ? 0.05 : 0) + (me1.marks.eye !== null ? 0.03 : 0) + rim;
    case 'claw-focus':
    case 'bite-focus':
    case 'breath-focus': {
      // Being at the focus range is worth a little; landing the focus attack is the point.
      const focus = FOCUS[style]!;
      const order: Band[] = ['melee', 'close', 'far', 'veryFar'];
      const off = Math.abs(order.indexOf(band) - order.indexOf(focus.band));
      return dealt - taken + (off === 0 ? 0.08 : off === 1 ? 0 : -0.06) + rim;
    }
  }
}

// ---------------------------------------------------------------- 2 and 4. imagine and choose

/** Rebuilds the bout as this side sees it. Everything in a View is public, so nothing hidden leaks in. */
function boutFromView(view: View): Bout {
  const fighters = { [view.side]: structuredClone(view.me), [view.opp.side]: structuredClone(view.opp) } as Record<Side, Fighter>;
  return {
    fighters, challenged: 'B', exchange: view.exchange, globalSlot: view.globalSlot,
    startWounds: { ...view.startWounds }, history: structuredClone(view.history) as Bout['history'],
    record: structuredClone(view.record), arena: structuredClone(view.arena), over: false, winner: null,
  };
}

function scriptFor(style: BrainStyle, situation: Situation, opp: Fighter, sep: number, rng: () => number, styled: boolean): ActionSpec[] {
  const out: ActionSpec[] = [];
  let s = situation;
  while (out.length < R.SLOTS_PER_EXCHANGE) {
    const legal = legalActions(s, rng).filter((a) => allowed(style, a));
    const leanTable = LEAN[style];
    const lean = typeof leanTable === 'function' ? leanTable(bandOf(sep), s.z > 0, opp.pos.z > 0) : leanTable;
    const weights = legal.map((a) => {
      const w = styled ? (lean[a.name] ?? 0.4) : 1;
      return a.charge ? w * (style === 'slugger' || style === 'out-boxer' ? 1 : 0.4) : a.crunch ? w * 1.5 : w;
    });
    s = place(out, s, pick(legal, weights, rng));
  }
  return out.slice(0, R.SLOTS_PER_EXCHANGE);
}

export function brainController(style: BrainStyle, skill: Skill = 'adept', seed = 1, tellOverride?: number): Controller {
  const rng = seededRandom(seed);
  const level = SKILL[skill];
  const tellChance = tellOverride ?? level.tell;
  let current: ActionSpec[] = [];
  let lastWounds: number | null = null;
  let lastOppWounds: number | null = null;
  let lastScript: ActionSpec[] = [];

  const softmax = (values: number[]) => {
    const top = Math.max(...values);
    return values.map((v) => Math.exp((v - top) / level.temperature));
  };

  return {
    name: `${style} brain (${skill})`,

    script(view: View): ActionSpec[] {
      const read = new Read(view, level.memory);
      const base = boutFromView(view);
      const me = view.side;
      const them = view.opp.side;
      const sep = view.separation;
      const mine: Situation = { f: view.me, globalSlot: view.globalSlot, z: view.me.pos.z, readyAt: view.me.readyAt };
      const theirs: Situation = { f: view.opp, globalSlot: view.globalSlot, z: view.opp.pos.z, readyAt: view.opp.readyAt };

      // Candidates: mostly in the style's lean, some anything-goes, plus last exchange's script.
      const candidates: ActionSpec[][] = [];
      for (let i = 0; i < level.candidates; i++) candidates.push(scriptFor(style, mine, view.opp, sep, rng, i < (level.candidates * 2) / 3));
      if (lastScript.length) candidates.push(lastScript);

      // Guesses at the opponent: from what it could do and what it has shown, slot by slot.
      const guessScript = (choose: (legal: ActionSpec[], slot: number, ready: boolean) => ActionSpec) => {
        const g: ActionSpec[] = [];
        let s = theirs;
        while (g.length < R.SLOTS_PER_EXCHANGE) {
          const ready = (s.readyAt.breath ?? 0) <= s.globalSlot;
          s = place(g, s, choose(legalActions(s, rng), g.length, ready));
        }
        return g.slice(0, R.SLOTS_PER_EXCHANGE);
      };
      const guesses: ActionSpec[][] = [guessScript((legal, slot, ready) => read.likeliest(bandOf(sep), slot, ready, legal))];
      while (guesses.length < level.guesses) guesses.push(guessScript((legal, slot, ready) => read.guess(bandOf(sep), slot, ready, legal, rng)));

      // Counter-scripts: the best answer, slot by slot, to its likeliest guesses.
      for (let i = 0; i < Math.min(level.counters, guesses.length); i++) candidates.push(counterScript(style, base, me, them, guesses[i], mine, rng));

      const values = candidates.map((c) => {
        let total = 0;
        for (const g of guesses) {
          const b = structuredClone(base);
          const events = runExchange(b, { [me]: c, [them]: g } as Record<Side, ActionSpec[]>);
          total += value(style, { before: base, after: b, events, me });
        }
        return total / guesses.length;
      });
      let chosen = pick(candidates, softmax(values), rng);

      chosen = tell(style, chosen, view, rng() < tellChance, { lastWounds, lastOppWounds, lastScript }, mine);
      lastWounds = view.me.wounds;
      lastOppWounds = view.opp.wounds;
      lastScript = chosen;
      current = chosen;
      return chosen;
    },

    // At the end of slot 2, imagine slot 3 again with what's now known, and the Baleful Eye's reveal if any.
    revise(view: View, moment: Moment, _opponentRevised: boolean, revealed: string | null): ActionSpec | null {
      if (moment !== 2 || current.length < 3) return null;
      const read = new Read(view, level.memory);
      const base = boutFromView(view);
      const me = view.side;
      const them = view.opp.side;
      const mine: Situation = { f: view.me, globalSlot: view.globalSlot, z: view.me.pos.z, readyAt: view.me.readyAt };
      const theirs: Situation = { f: view.opp, globalSlot: view.globalSlot, z: view.opp.pos.z, readyAt: view.opp.readyAt };
      const options = [current[2], ...legalActions(mine, rng).filter((a) => a.name !== current[2].name && allowed(style, a))];
      let theirOptions = legalActions(theirs, rng);
      // A charge on the board releases next slot: no guessing needed.
      const theirCharge = view.opp.marks.charge;
      if (theirCharge) theirOptions = [{ name: theirCharge.action, sweep: theirCharge.sweep }];
      else if (revealed) {
        const r = revealed.toLowerCase();
        const matches = theirOptions.filter((a) => {
          const cat = ACTIONS[a.name].category;
          return r === 'not an attack' ? cat !== 'attack' : r === 'attack' ? cat === 'attack' : r === cat || r.startsWith(ACTIONS[a.name].label.toLowerCase());
        });
        if (matches.length) theirOptions = matches;
      }
      const ready = (view.opp.readyAt.breath ?? 0) <= view.globalSlot;
      const guesses = Array.from({ length: level.guesses }, () => read.guess(bandOf(view.separation), 2, ready, theirOptions, rng));
      const values = options.map((o, i) => {
        let total = 0;
        for (const g of guesses) {
          const b = structuredClone(base);
          const events = simulateSlot(b, { [me]: i === 0 ? o : { ...o, revised: true }, [them]: g } as Record<Side, ActionSpec>);
          total += value(style, { before: base, after: b, events, me });
        }
        return total / guesses.length;
      });
      // Revise only when the new idea is clearly better than the plan: a revision flashes and costs a chain bonus.
      const best = values.indexOf(Math.max(...values));
      if (best === 0 || values[best] - values[0] < 0.03) return null;
      return options[best];
    },
  };
}

/** The best answer to one guessed opponent script, chosen slot by slot by playing each option in the Referee. */
function counterScript(style: BrainStyle, base: Bout, me: Side, them: Side, guess: ActionSpec[], mine: Situation, rng: () => number): ActionSpec[] {
  const b = structuredClone(base);
  let s = mine;
  const out: ActionSpec[] = [];
  for (let i = 0; i < R.SLOTS_PER_EXCHANGE; i++) {
    if (b.over) {
      out.push({ name: 'hold' });
      continue;
    }
    let best: ActionSpec = { name: 'hold' };
    let bestValue = -Infinity;
    for (const a of legalActions(s, rng).filter((x) => !x.charge && allowed(style, x))) {
      const trial = structuredClone(b);
      const events = simulateSlot(trial, { [me]: a, [them]: guess[i] } as Record<Side, ActionSpec>);
      const v = value(style, { before: b, after: trial, events, me });
      if (v > bestValue) {
        bestValue = v;
        best = a;
      }
    }
    simulateSlot(b, { [me]: best, [them]: guess[i] } as Record<Side, ActionSpec>);
    out.push(best);
    s = advance(s, best);
  }
  return out;
}

// ---------------------------------------------------------------- 5. tells

interface Memory {
  lastWounds: number | null;
  lastOppWounds: number | null;
  lastScript: ActionSpec[];
}

/**
 * Each style keeps one readable habit, so a player who watches can learn it. Lower skill shows it more.
 *   swarmer         beyond Close, it always opens by closing in
 *   out-boxer       at Close or nearer, it always opens by backing off
 *   slugger         it intimidates right before its big Bite
 *   counterpuncher  after taking a hit, it opens with Scales
 *   boxer-puncher   after an exchange that went its way, it runs the same script again
 *   aerialist       on the ground, it opens by taking to the air
 *   reader          it opens by intimidating, to look for a read
 */
function tell(style: BrainStyle, script: ActionSpec[], view: View, show: boolean, mem: Memory, mine: Situation): ActionSpec[] {
  if (!show) return script;
  const out = [...script];
  const legal = (a: ActionSpec, i: number) => {
    let s = mine;
    for (let k = 0; k < i; k++) s = advance(s, out[k]);
    return legalActions(s, () => 0.5).some((x) => x.name === a.name);
  };
  const set = (i: number, a: ActionSpec) => {
    if (legal(a, i)) out[i] = a;
  };
  const sep = view.separation;
  switch (style) {
    case 'swarmer':
      if (sep > R.CLOSE_EDGE) set(0, { name: 'approach' });
      break;
    case 'out-boxer':
      if (sep <= R.CLOSE_EDGE) set(0, { name: 'retreat' });
      break;
    case 'slugger': {
      const i = out.findIndex((a, k) => k > 0 && a.name === 'bite');
      if (i > 0 && ACTIONS[out[i - 1].name].category !== 'attack') set(i - 1, { name: 'intimidate' });
      break;
    }
    case 'counterpuncher':
      if (mem.lastWounds !== null && view.me.wounds < mem.lastWounds) set(0, { name: 'scales' });
      break;
    case 'boxer-puncher':
      if (mem.lastScript.length && mem.lastWounds !== null && mem.lastOppWounds !== null &&
        mem.lastOppWounds - view.opp.wounds > mem.lastWounds - view.me.wounds) {
        mem.lastScript.forEach((a, i) => set(i, a));
      }
      break;
    case 'aerialist':
      if (view.me.pos.z === 0 && view.me.sheet.flies) set(0, { name: 'leap' });
      break;
    case 'reader':
      set(0, { name: 'intimidate' });
      break;
    case 'claw-focus':
      if (sep > R.MELEE_EDGE) set(0, { name: 'approach' });
      break;
    case 'bite-focus':
      if (sep <= R.MELEE_EDGE) set(0, { name: 'retreat' });
      else if (sep > R.BITE_REACH) set(0, { name: 'approach' });
      break;
    case 'breath-focus':
      if (sep <= R.CLOSE_EDGE) set(0, { name: 'retreat' });
      break;
  }
  return out;
}
