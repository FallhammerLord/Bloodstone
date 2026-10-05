// 2, 4 and 5. Imagine, choose and tell: the controller that plays a side.

import { ACTIONS, type ActionSpec } from '../actions.ts';
import type { Controller, View } from '../bout.ts';
import { seededRandom } from '../random.ts';
import { cloneBout, simulateSlot, runExchange, type Bout, type Fighter, type Moment, type Side } from '../referee.ts';
import * as R from '../rules.ts';
import { type Situation, advance, legalActions, place } from './options.ts';
import { Read, pick } from './read.ts';
import { type BrainStyle, CHARGE_LEAN, CHARGE_LEAN_DEFAULT, CRUNCH_LEAN, LEAN, SKILL, type Skill, allowed, bandOf } from './styles.ts';
import { value } from './value.ts';

/** Rebuilds the bout as this side sees it. Everything in a View is public, so nothing hidden leaks in. */
export function boutFromView(view: View): Bout {
  const fighters = { [view.side]: structuredClone(view.me), [view.opp.side]: structuredClone(view.opp) } as Record<Side, Fighter>;
  return {
    fighters, challenged: 'B', exchange: view.exchange, globalSlot: view.globalSlot,
    startWounds: { ...view.startWounds }, history: structuredClone(view.history) as Bout['history'],
    record: structuredClone(view.record), arena: structuredClone(view.arena), over: false, winner: null, rules: view.rules,
  };
}

export function scriptFor(style: BrainStyle, situation: Situation, opp: Fighter, sep: number, rng: () => number, styled: boolean): ActionSpec[] {
  const out: ActionSpec[] = [];
  let s = situation;
  while (out.length < R.SLOTS_PER_EXCHANGE) {
    const legal = legalActions(s, rng).filter((a) => allowed(style, a));
    const leanTable = LEAN[style];
    const lean = typeof leanTable === 'function' ? leanTable(bandOf(sep), s.z > 0, opp.pos.z > 0) : leanTable;
    const weights = legal.map((a) => {
      // A setup sequence is weighed by the style's taste for both halves, so each style keeps its flavor.
      const w = styled ? (a.setup ? ((lean[a.setup] ?? 0.4) + (lean[a.name] ?? 0.4)) / 2 : (lean[a.name] ?? 0.4)) : 1;
      return a.charge ? w * (CHARGE_LEAN[style]?.[a.long ? 'long' : 'short'] ?? CHARGE_LEAN_DEFAULT) : a.crunch ? w * CRUNCH_LEAN : w;
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
      const mine: Situation = { f: view.me, globalSlot: view.globalSlot, z: view.me.pos.z, readyAt: view.me.readyAt, rules: view.rules };
      const theirs: Situation = { f: view.opp, globalSlot: view.globalSlot, z: view.opp.pos.z, readyAt: view.opp.readyAt, rules: view.rules };

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
      const ctx = `${view.opp.pos.z > 0}|${view.opp.meter >= R.METER_MAX}`;
      const guesses: ActionSpec[][] = [guessScript((legal, slot, ready) => read.likeliest(bandOf(sep), slot, ready, legal, ctx))];
      while (guesses.length < level.guesses) guesses.push(guessScript((legal, slot, ready) => read.guess(bandOf(sep), slot, ready, legal, rng, ctx)));

      // Counter-scripts: the best answer, slot by slot, to its likeliest guesses.
      for (let i = 0; i < Math.min(level.counters, guesses.length); i++) candidates.push(counterScript(style, base, me, them, guesses[i], mine, rng));

      const values = candidates.map((c) => {
        let total = 0;
        for (const g of guesses) {
          const b = cloneBout(base);
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
      const mine: Situation = { f: view.me, globalSlot: view.globalSlot, z: view.me.pos.z, readyAt: view.me.readyAt, rules: view.rules };
      const theirs: Situation = { f: view.opp, globalSlot: view.globalSlot, z: view.opp.pos.z, readyAt: view.opp.readyAt, rules: view.rules };
      const options = [current[2], ...legalActions(mine, rng).filter((a) => !a.charge && !a.setup && a.name !== current[2].name && allowed(style, a))];
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
          const b = cloneBout(base);
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
export function counterScript(style: BrainStyle, base: Bout, me: Side, them: Side, guess: ActionSpec[], mine: Situation, rng: () => number): ActionSpec[] {
  const b = cloneBout(base);
  let s = mine;
  const out: ActionSpec[] = [];
  for (let i = 0; i < R.SLOTS_PER_EXCHANGE; i++) {
    if (b.over) {
      out.push({ name: 'hold' });
      continue;
    }
    let best: ActionSpec = { name: 'hold' };
    let bestValue = -Infinity;
    // Two-slot ideas (a setup and its strike) are weighed across both slots, per slot.
    const twoSlot = (x: ActionSpec) => i + 1 < R.SLOTS_PER_EXCHANGE && x.setup !== undefined;
    const first = (x: ActionSpec): ActionSpec => (x.setup === 'strafe' ? { name: 'strafe', dir: x.dir } : x.setup === 'approach' ? { name: 'approach' } : x);
    const second = (x: ActionSpec): ActionSpec => ({ name: x.name, sweep: x.sweep });
    for (const a of legalActions(s, rng).filter((x) => (!(x.charge || x.setup) || twoSlot(x)) && allowed(style, x))) {
      const trial = cloneBout(b);
      const events = simulateSlot(trial, { [me]: first(a), [them]: guess[i] } as Record<Side, ActionSpec>);
      let v = value(style, { before: b, after: trial, events, me });
      if (twoSlot(a) && !trial.over) {
        const mid = cloneBout(trial);
        const more = simulateSlot(trial, { [me]: second(a), [them]: guess[i + 1] } as Record<Side, ActionSpec>);
        v = (v + value(style, { before: mid, after: trial, events: more, me })) / 2;
      }
      if (v > bestValue) {
        bestValue = v;
        best = a;
      }
    }
    const opener = first(best);
    simulateSlot(b, { [me]: opener, [them]: guess[i] } as Record<Side, ActionSpec>);
    out.push(opener);
    s = advance(s, opener.charge ? { name: 'hold' } : opener);
    if ((best.charge || best.setup) && i + 1 < R.SLOTS_PER_EXCHANGE && !b.over) {
      i++;
      const strike = second(best);
      simulateSlot(b, { [me]: strike, [them]: guess[i] } as Record<Side, ActionSpec>);
      out.push(strike);
      s = advance(s, strike);
    }
  }
  return out;
}


export interface Memory {
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
export function tell(style: BrainStyle, script: ActionSpec[], view: View, show: boolean, mem: Memory, mine: Situation): ActionSpec[] {
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
      else if (sep > view.rules.BITE_REACH) set(0, { name: 'approach' });
      break;
    case 'breath-focus':
      if (sep <= R.CLOSE_EDGE) set(0, { name: 'retreat' });
      break;
  }
  return out;
}
