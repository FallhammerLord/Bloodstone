// Simple AI tamers. Each style is a short list of habits, so a fight against one can be read and beaten.
// Their choices use a seeded random generator: the same seed always plays the same way.

import { ACTIONS, type ActionName, type ActionSpec } from './actions.ts';
import type { Controller, View } from './bout.ts';
import type { Moment } from './referee.ts';
import { seededRandom } from './random.ts';
import * as R from './rules.ts';
import type { Rules } from './rules.ts';

export { seededRandom };

export type Style = 'brawler' | 'skirmisher' | 'guardian' | 'mixed';
export const STYLES: readonly Style[] = ['brawler', 'skirmisher', 'guardian', 'mixed'];

interface Situation {
  sep: number;
  usable: (a: ActionName) => boolean;
  rng: () => number;
  prev: ActionSpec | null;
  /** my altitude and the opponent's (as last seen), and whether I can fly */
  myZ: number;
  oppZ: number;
  flies: boolean;
  talons: boolean;
  rules: Rules;
}

/** Shared airborne habits: come down to fight, or answer a dragon overhead. Returns null when grounded and level. */
function altitudeHabit({ sep, usable, rng, myZ, oppZ, flies, talons, rules }: Situation, style: 'close' | 'far' | 'wait'): ActionSpec | null {
  if (talons && oppZ === 0) {
    // Wyvern Talons: from the air, stoop on anything within a band plus Claw's reach; from further, close in aloft.
    if (myZ > 0) return sep <= rules.STOOP_CARRY + rules.CLAW_REACH ? { name: 'claw', sweep: side(rng) } : { name: 'approach' };
    if (sep > R.MELEE_EDGE && rng() < (style === 'wait' ? 0.3 : 0.6)) return { name: 'leap' };
  }
  if (myZ > 0 && oppZ === 0) {
    // Up high and the opponent is grounded: hold the height at range, or dive in to fight.
    if (style === 'far' && sep > R.MELEE_EDGE) return usable('breath') && sep <= R.FAR_EDGE ? { name: 'breath' } : { name: 'strafe', dir: turn(rng) };
    return { name: 'dive' };
  }
  if (oppZ > 0 && myZ === 0) {
    // The opponent is overhead: Stomp can't reach it. Breathe, follow it up, or guard.
    if (usable('breath') && sep <= R.FAR_EDGE) return { name: 'breath' };
    if (flies && style !== 'wait') return { name: 'leap' };
    if (sep <= rules.BITE_REACH && rng() < 0.5) return { name: 'bite' };
    return { name: 'scales' };
  }
  return null;
}

type Habit = (s: Situation) => ActionSpec;

const side = (rng: () => number): 'left' | 'right' => (rng() < 0.5 ? 'left' : 'right');
const turn = (rng: () => number): 'cw' | 'ccw' => (rng() < 0.5 ? 'cw' : 'ccw');

/** Closes in and hits: claw up close, bite at Close, breath at Far. */
const brawler: Habit = (s) => {
  const { sep, usable, rng, rules } = s;
  const air = altitudeHabit(s, 'close');
  if (air) return air;
  if (sep <= R.MELEE_EDGE) {
    if (usable('stomp') && s.myZ === 0 && rng() < 0.2) return { name: 'stomp' };
    return { name: 'claw', sweep: side(rng) };
  }
  if (sep <= rules.BITE_REACH) return { name: 'bite' };
  if (sep <= R.FAR_EDGE && usable('breath')) return { name: 'breath' };
  if (sep <= R.FAR_EDGE && rng() < 0.25) return { name: 'intimidate' };
  return { name: 'approach' };
};

/** Keeps range: breathes at Far, backs off when crowded, strafes in between. */
const skirmisher: Habit = (s) => {
  const { sep, usable, rng, rules } = s;
  if (sep <= R.FAR_EDGE && sep > R.MELEE_EDGE && usable('breath')) return { name: 'breath' };
  const air = altitudeHabit(s, 'far');
  if (air) return air;
  // A flyer escapes upward when crowded; a grounded dragon backs off.
  if (sep <= R.CLOSE_EDGE && s.flies && s.myZ < rules.MAX_ALTITUDE && rng() < 0.5) return { name: 'leap' };
  if (sep <= R.MELEE_EDGE) return rng() < 0.5 ? { name: 'claw', sweep: side(rng) } : { name: 'retreat' };
  if (sep <= R.CLOSE_EDGE) return rng() < 0.6 ? { name: 'retreat' } : { name: 'strafe', dir: turn(rng) };
  if (sep > R.FAR_EDGE) return { name: 'approach' };
  return { name: 'strafe', dir: turn(rng) };
};

/** Waits for the opponent to commit: guards, dodges, and counters up close. */
const guardian: Habit = (s) => {
  const { sep, usable, rng, prev, rules } = s;
  const air = altitudeHabit(s, 'wait');
  if (air) return air;
  const r = rng();
  if (sep <= R.MELEE_EDGE) {
    if (r < 0.45) return { name: 'claw', sweep: side(rng) };
    if (r < 0.75 || !usable('dodge')) return { name: 'scales' };
    return { name: 'dodge' };
  }
  if (sep <= rules.BITE_REACH) {
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
/** Where this dragon expects to be after a move; it can't know the opponent's moves. Rough on purpose. */
function predict(sep: number, z: number, a: ActionSpec, view: View, staggered: boolean): { sep: number; z: number } {
  let step = view.rules.BAND_MOVE;
  if (staggered) step = Math.floor(step / 2);
  if (a.name === 'approach') return { sep: Math.max(view.rules.BODY_GAP, sep - step), z };
  if (a.name === 'retreat') return { sep: Math.min(view.rules.LEASH, sep + step), z };
  if (a.name === 'leap' && view.me.sheet.flies) return { sep, z: Math.min(view.rules.MAX_ALTITUDE, z + step) };
  if (a.name === 'dive') return { sep, z: Math.max(0, z - step) };
  return { sep, z };
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
      let myZ = view.me.pos.z;
      const talons = view.me.sheet.aspect === 'talons';
      for (let i = 0; i < R.SLOTS_PER_EXCHANGE; i++) {
        const slot = view.globalSlot + i;
        const usable = (a: ActionName) => (readyAt[a] ?? 0) <= slot && !(a === 'dive' && myZ === 0) && !(a === 'stomp' && myZ > 0);
        let pick = habit({ sep, usable, rng, prev: out[i - 1] ?? null, myZ, oppZ: view.opp.pos.z, flies: view.me.sheet.flies, talons, rules: view.rules });
        if (!usable(pick.name)) pick = { name: 'hold' };
        if (view.me.pending.pinned && i === 0 && ACTIONS[pick.name].category === 'move') pick = { name: 'scales' };
        const cd = ACTIONS[pick.name].cooldown;
        if (cd > 0) readyAt[pick.name] = slot + cd + 1;
        out.push(pick);
        if (pick.name === 'claw' && talons && myZ > 0 && view.opp.pos.z === 0 && sep <= view.rules.STOOP_RANGE) {
          // A stoop lands on the ground, carrying at most a band toward the target.
          sep = Math.max(view.rules.STOOP_LANDING, sep - view.rules.STOOP_CARRY);
          myZ = 0;
        } else {
          ({ sep, z: myZ } = predict(sep, myZ, pick, view, i === 0 && view.me.pending.staggered));
        }
      }
      current = out;
      return out;
    },

    // At the end of slot 2, look again: if the plan for slot 3 no longer fits, change it.
    revise(view: View, moment: Moment, opponentRevised: boolean, revealed: string | null): ActionSpec | null {
      if (moment !== 2 && !revealed) return null;
      const planned = current[2];
      if (!planned) return null;
      const z = view.me.pos.z;
      const usable = (a: ActionName) => (view.me.readyAt[a] ?? 0) <= view.globalSlot && !(a === 'dive' && z === 0) && !(a === 'stomp' && z > 0);
      if (opponentRevised && ACTIONS[planned.name].category === 'attack' && rng() < 0.4) return { name: 'scales' };
      // Baleful Eye showed an attack coming: brace for it.
      if (revealed && /attack|bite|claw|breath|stomp/i.test(revealed) && !/not an attack/.test(revealed) && planned.name !== 'scales' && rng() < 0.7) return { name: 'scales' };
      const fresh = habit({ sep: view.separation, usable, rng, prev: current[1] ?? null, myZ: z, oppZ: view.opp.pos.z, flies: view.me.sheet.flies, talons: view.me.sheet.aspect === 'talons', rules: view.rules });
      if (fresh.name === planned.name || !usable(fresh.name)) return null;
      return rng() < 0.7 ? fresh : null;
    },
  };
}
