// Simple AI tamers. Each style is a short list of habits, so a fight against one can be read and beaten.
// Their choices use a seeded random generator: the same seed always plays the same way.

import { ACTIONS, type ActionName, type ActionSpec } from './actions.ts';
import type { Controller, View } from './bout.ts';
import type { Moment } from './referee.ts';
import * as R from './rules.ts';

export type Style = 'brawler' | 'skirmisher' | 'guardian' | 'mixed';
export const STYLES: readonly Style[] = ['brawler', 'skirmisher', 'guardian', 'mixed'];

/** Small, fast, seeded random numbers (mulberry32). Returns 0 ≤ n < 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Situation {
  sep: number;
  usable: (a: ActionName) => boolean;
  rng: () => number;
  prev: ActionSpec | null;
}

type Habit = (s: Situation) => ActionSpec;

const side = (rng: () => number): 'left' | 'right' => (rng() < 0.5 ? 'left' : 'right');
const turn = (rng: () => number): 'cw' | 'ccw' => (rng() < 0.5 ? 'cw' : 'ccw');

/** Closes in and hits: claw up close, bite at Close, breath at Far. */
const brawler: Habit = ({ sep, usable, rng }) => {
  if (sep <= R.MELEE_EDGE) {
    if (usable('stomp') && rng() < 0.2) return { name: 'stomp' };
    return { name: 'claw', sweep: side(rng) };
  }
  if (sep <= R.BITE_REACH) return { name: 'bite' };
  if (sep <= R.FAR_EDGE && usable('breath')) return { name: 'breath' };
  if (sep <= R.FAR_EDGE && rng() < 0.25) return { name: 'intimidate' };
  return { name: 'approach' };
};

/** Keeps range: breathes at Far, backs off when crowded, strafes in between. */
const skirmisher: Habit = ({ sep, usable, rng }) => {
  if (sep <= R.FAR_EDGE && sep > R.MELEE_EDGE && usable('breath')) return { name: 'breath' };
  if (sep <= R.MELEE_EDGE) return rng() < 0.5 ? { name: 'claw', sweep: side(rng) } : { name: 'retreat' };
  if (sep <= R.CLOSE_EDGE) return rng() < 0.6 ? { name: 'retreat' } : { name: 'strafe', dir: turn(rng) };
  if (sep > R.FAR_EDGE) return { name: 'approach' };
  return { name: 'strafe', dir: turn(rng) };
};

/** Waits for the opponent to commit: guards, dodges, and counters up close. */
const guardian: Habit = ({ sep, usable, rng, prev }) => {
  const r = rng();
  if (sep <= R.MELEE_EDGE) {
    if (r < 0.45) return { name: 'claw', sweep: side(rng) };
    if (r < 0.75 || !usable('dodge')) return { name: 'scales' };
    return { name: 'dodge' };
  }
  if (sep <= R.BITE_REACH) {
    if (r < 0.4) return { name: 'bite' };
    if (r < 0.8 && prev?.name !== 'scales') return { name: 'scales' };
    return { name: 'strafe', dir: turn(rng) };
  }
  if (sep <= R.FAR_EDGE && usable('breath')) return { name: 'breath' };
  if (sep <= R.FAR_EDGE && r < 0.3) return { name: 'intimidate' };
  return { name: 'approach' };
};

/** Picks a different habit each slot, so it's harder to read. */
const mixed: Habit = (s) => [brawler, skirmisher, guardian][Math.floor(s.rng() * 3)](s);

const HABITS: Record<Style, Habit> = { brawler, skirmisher, guardian, mixed };

/** How far this dragon expects to have moved; it can't know the opponent's moves. */
function predictSeparation(sep: number, a: ActionSpec, view: View, staggered: boolean): number {
  let step = Math.min(view.me.sheet.evasion * R.EVASION_STEP, R.MOVE_CAP);
  if (staggered) step = Math.floor(step / 2);
  if (a.name === 'approach') return Math.max(R.BODY_GAP, sep - step);
  if (a.name === 'retreat') return Math.min(R.LEASH, sep + step);
  return sep;
}

export function aiController(style: Style, seed: number): Controller {
  const rng = seededRandom(seed);
  const habit = HABITS[style];
  let current: ActionSpec[] = [];

  return {
    name: `${style} AI`,

    script(view: View): ActionSpec[] {
      const readyAt = { ...view.me.readyAt };
      const out: ActionSpec[] = [];
      let sep = view.separation;
      for (let i = 0; i < R.SLOTS_PER_EXCHANGE; i++) {
        const slot = view.globalSlot + i;
        const usable = (a: ActionName) => (readyAt[a] ?? 0) <= slot;
        let pick = habit({ sep, usable, rng, prev: out[i - 1] ?? null });
        if (!usable(pick.name)) pick = { name: 'hold' };
        if (view.me.pending.pinned && i === 0 && ACTIONS[pick.name].category === 'move') pick = { name: 'scales' };
        const cd = ACTIONS[pick.name].cooldown;
        if (cd > 0) readyAt[pick.name] = slot + cd + 1;
        out.push(pick);
        sep = predictSeparation(sep, pick, view, i === 0 && view.me.pending.staggered);
      }
      current = out;
      return out;
    },

    // At the end of slot 2, look again: if the plan for slot 3 no longer fits, change it.
    revise(view: View, moment: Moment, opponentRevised: boolean): ActionSpec | null {
      if (moment !== 2) return null;
      const planned = current[2];
      if (!planned) return null;
      const usable = (a: ActionName) => (view.me.readyAt[a] ?? 0) <= view.globalSlot;
      if (opponentRevised && ACTIONS[planned.name].category === 'attack' && rng() < 0.4) return { name: 'scales' };
      const fresh = habit({ sep: view.separation, usable, rng, prev: current[1] ?? null });
      if (fresh.name === planned.name || !usable(fresh.name)) return null;
      return rng() < 0.7 ? fresh : null;
    },
  };
}
