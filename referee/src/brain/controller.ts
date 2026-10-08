// The archetype brain: imagine scripts, guess the opponent, play both out in the Referee, value the result by the
// archetype's goals, look ahead as far as its skill allows, and choose among the best.

import type { ActionSpec } from '../actions.ts';
import type { Controller, View } from '../bout.ts';
import { seededRandom } from '../random.ts';
import { cloneBout, runExchange, simulateSlot, type Bout, type Fighter, type Moment, type Side } from '../referee.ts';
import * as R from '../rules.ts';
import { SKILL, skillOf, type Archetype, type Skill } from './archetypes.ts';
import { type Context, value } from './features.ts';
import { advance, legalActions, place, playable, situation, type Situation } from './options.ts';
import { sampleScript } from './priors.ts';
import { discover } from './discover.ts';
import { bandOf, worth } from './probe.ts';
import { pick, Read } from './read.ts';

/**
 * Rebuilds the bout as this side sees it. Everything in a View is public, so nothing hidden leaks in; the bout's dice
 * aren't public, so it imagines them at a luck quantile u (½: an even break).
 */
export function boutFromView(view: View, u = 0.5): Bout {
  const fighters = { [view.side]: structuredClone(view.me), [view.opp.side]: structuredClone(view.opp) } as Record<Side, Fighter>;
  return {
    fighters, challenged: view.challenged, exchange: view.exchange, globalSlot: view.globalSlot,
    startWounds: { ...view.startWounds }, history: structuredClone(view.history) as Bout['history'],
    record: structuredClone(view.record), arena: structuredClone(view.arena), over: false, winner: null, rules: view.rules,
    dice: { mode: 'quantile', u },
  };
}

const sepOf = (b: Bout) => {
  const A = b.fighters.A.pos, B = b.fighters.B.pos;
  return Math.hypot(A.x - B.x, A.y - B.y, A.z - B.z);
};

/** Later exchanges of a line of play count for less, being less certain. */
const LOOKAHEAD_WEIGHTS = [1, 0.7, 0.5, 0.35];
/** Scripts tried for its own side at each look-ahead step; it keeps the best. */
const PLAYOUT_TRIES = 3;
/** A revision flashes and costs a chain bonus: it revises only for a clear gain. */
const REVISE_MARGIN = 0.03;

/**
 * Each guess is imagined at its own luck: the i-th of n at quantile (i + ½) ÷ n, so a set of guesses spans the dice's
 * odds evenly and their average weighs each Evasion test by its true chance.
 */
const luck = (i: number, n: number) => (i + 0.5) / n;
const atLuck = (b: Bout, u: number): Bout => {
  const c = cloneBout(b);
  c.dice = { mode: 'quantile', u };
  return c;
};

/** The opponent's likeliest script from here, slot by slot. */
function guessScript(read: Read, s: Situation, sep: number, rng: () => number, likeliest: boolean): ActionSpec[] {
  const g: ActionSpec[] = [];
  while (g.length < R.SLOTS_PER_EXCHANGE) {
    const legal = legalActions(s, rng);
    s = place(g, s, likeliest ? read.likeliest(bandOf(sep), legal) : read.guess(bandOf(sep), legal, rng));
  }
  return g.slice(0, R.SLOTS_PER_EXCHANGE);
}

/** The best answer to one guessed script, chosen slot by slot by playing each option in the Referee. */
function counterScript(style: Archetype, ctx: Context, base: Bout, me: Side, them: Side, guess: ActionSpec[], mine: Situation, rng: () => number): ActionSpec[] {
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
    for (const a of legalActions(s, rng).filter((x) => !x.charge && !x.setup)) {
      const trial = cloneBout(b);
      const events = simulateSlot(trial, { [me]: a, [them]: guess[i] } as Record<Side, ActionSpec>);
      const v = value(style, { before: b, after: trial, events, me }, ctx);
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

export function brainController(style: Archetype, skill: Skill | 'auto' = 'auto', seed = 1): Controller {
  const rng = seededRandom(seed);
  let current: ActionSpec[] = [];
  let lastScript: ActionSpec[] = [];
  // The script it means to play next exchange, from its best line of play; offered again if it still fits.
  let planned: ActionSpec[] = [];

  return {
    name: `${style} brain (${skill})`,

    script(view: View): ActionSpec[] {
      const level = SKILL[skill === 'auto' ? skillOf(view.me) : skill];
      const base = boutFromView(view);
      const me = view.side;
      const them = view.opp.side;
      const sep = view.separation;
      const mineWorth = worth(base, me);
      const ctx: Context = { mine: mineWorth, theirs: worth(base, them), punch: discover(view, mineWorth) };
      const read = new Read(view, level.memory, ctx.theirs);
      const mine = situation(view.me, view.globalSlot, view.rules);
      const theirs = situation(view.opp, view.globalSlot, view.rules);

      // Candidates: most drawn by the archetype's priors, some anything-goes, plus last exchange's script and its plan.
      const candidates: ActionSpec[][] = [];
      for (let i = 0; i < level.candidates; i++) candidates.push(sampleScript(style, ctx, mine, sep, rng, i < (level.candidates * 2) / 3, bandOf));
      if (lastScript.length && playable(lastScript, mine)) candidates.push(lastScript);
      if (planned.length && playable(planned, mine)) candidates.push(planned);

      const guesses = [guessScript(read, theirs, sep, rng, true)];
      while (guesses.length < level.guesses) guesses.push(guessScript(read, theirs, sep, rng, false));
      for (let i = 0; i < Math.min(level.counters, guesses.length); i++) candidates.push(counterScript(style, ctx, atLuck(base, luck(i, guesses.length)), me, them, guesses[i], mine, rng));

      // The Referee is deterministic at a given luck, so each pairing is played once, its guess at its own quantile.
      const seen = new Map<string, { v: number; after: Bout }>();
      const first = candidates.map((c) => guesses.map((g, gi) => {
        const key = JSON.stringify([c, g, gi]);
        let r = seen.get(key);
        if (!r) {
          const b = atLuck(base, luck(gi, guesses.length));
          const events = runExchange(b, { [me]: c, [them]: g } as Record<Side, ActionSpec[]>);
          r = { v: value(style, { before: base, after: b, events, me }, ctx), after: b };
          seen.set(key, r);
        }
        return r;
      }));
      const values = first.map((rs) => rs.reduce((a, r) => a + r.v, 0) / rs.length);

      // Looking ahead: its best few, plus a couple of others (a plan that pays later looks poor over one exchange), are
      // played forward, the opponent on its likeliest script, and judged on the whole line.
      let pool = candidates.map((_, i) => i);
      const nextScripts = new Map<number, ActionSpec[]>();
      if (level.horizon > 1 && level.lookahead > 0) {
        const roll = seededRandom(view.globalSlot * 7919 + 17);
        const ranked = [...pool].sort((a, b) => values[b] - values[a]);
        const rest = ranked.slice(level.lookahead);
        const explore: number[] = [];
        while (explore.length < Math.ceil(level.lookahead / 2) && rest.length) explore.push(rest.splice(Math.floor(roll() * rest.length), 1)[0]);
        pool = [...ranked.slice(0, level.lookahead), ...explore];
        for (const i of pool) {
          let total = 0;
          first[i].forEach((r, gi) => {
            let v = r.v;
            let weight = 1;
            let b = r.after;
            for (let k = 1; k < level.horizon && !b.over; k++) {
              const w = LOOKAHEAD_WEIGHTS[k];
              const mineNow = situation(b.fighters[me], b.globalSlot, b.rules);
              const theirScript = guessScript(read, situation(b.fighters[them], b.globalSlot, b.rules), sepOf(b), roll, true);
              let best: { script: ActionSpec[]; next: Bout; v: number } | null = null;
              for (let n = 0; n < PLAYOUT_TRIES; n++) {
                const script = sampleScript(style, ctx, mineNow, sepOf(b), roll, true, bandOf);
                const trial = cloneBout(b);
                const events = runExchange(trial, { [me]: script, [them]: theirScript } as Record<Side, ActionSpec[]>);
                const tv = value(style, { before: b, after: trial, events, me }, ctx);
                if (!best || tv > best.v) best = { script, next: trial, v: tv };
              }
              v += w * best!.v;
              weight += w;
              if (k === 1 && gi === 0) nextScripts.set(i, best!.script);
              b = best!.next;
            }
            total += v / weight;
          });
          values[i] = total / first[i].length;
        }
      }
      const poolValues = pool.map((i) => values[i]);
      const top = Math.max(...poolValues);
      const choice = pick(pool, poolValues.map((v) => Math.exp((v - top) / level.temperature)), rng);
      planned = nextScripts.get(choice) ?? [];
      lastScript = current = candidates[choice];
      return current;
    },

    // At the end of slot 2, imagine slot 3 again with what's now known.
    revise(view: View, moment: Moment): ActionSpec | null {
      if (moment !== 2 || current.length < 3) return null;
      const level = SKILL[skill === 'auto' ? skillOf(view.me) : skill];
      const base = boutFromView(view);
      const me = view.side;
      const them = view.opp.side;
      const mineWorth = worth(base, me);
      const ctx: Context = { mine: mineWorth, theirs: worth(base, them), punch: discover(view, mineWorth) };
      const read = new Read(view, level.memory, ctx.theirs);
      const mine = situation(view.me, view.globalSlot, view.rules);
      const theirs = situation(view.opp, view.globalSlot, view.rules);
      const options = [current[2], ...legalActions(mine, rng).filter((a) => !a.charge && !a.setup && a.name !== current[2].name)];
      const charge = view.opp.marks.charge;
      const theirOptions = charge ? [{ name: charge.action, sweep: charge.sweep } as ActionSpec] : legalActions(theirs, rng);
      const guesses = Array.from({ length: level.guesses }, () => read.guess(bandOf(view.separation), theirOptions, rng));
      const values = options.map((o, i) => {
        let total = 0;
        for (const [gi, g] of guesses.entries()) {
          const b = atLuck(base, luck(gi, guesses.length));
          const events = simulateSlot(b, { [me]: i === 0 ? o : { ...o, revised: true }, [them]: g } as Record<Side, ActionSpec>);
          total += value(style, { before: base, after: b, events, me }, ctx);
        }
        return total / guesses.length;
      });
      const best = values.indexOf(Math.max(...values));
      return best === 0 || values[best] - values[0] < REVISE_MARGIN ? null : options[best];
    },
  };
}
