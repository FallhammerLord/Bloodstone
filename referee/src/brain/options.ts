// What a brain could script: every legal action in a slot, and the imagined situation after it.

import { ACTIONS, type ActionName, type ActionSpec } from '../actions.ts';
import type { Fighter } from '../referee.ts';
import type { Rules } from '../rules.ts';
import * as R from '../rules.ts';

export interface Situation {
  f: Fighter;
  rules: Rules;
  globalSlot: number;
  z: number;
  readyAt: Partial<Record<ActionName, number>>;
  /** Lockjaw (clamp): the slot in which this dragon can't Bite, or -1 */
  clampedSlot?: number;
}

/** A dragon's situation as its script begins. */
export function situation(f: Fighter, globalSlot: number, rules: Rules): Situation {
  return { f, globalSlot, z: f.pos.z, readyAt: f.readyAt, rules, clampedSlot: f.marks.clamped ? globalSlot : -1 };
}

/** Everything this dragon could script in a slot, with the details picked at random. */
export function legalActions(s: Situation, rng: () => number): ActionSpec[] {
  const ready = (a: ActionName) => (s.readyAt[a] ?? 0) <= s.globalSlot;
  const side = (): 'left' | 'right' => (rng() < 0.5 ? 'left' : 'right');
  const turn = (): 'cw' | 'ccw' => (rng() < 0.5 ? 'cw' : 'ccw');
  // Band moves land where Evasion lets them: plain, short, or long.
  const depth = (): 'short' | 'long' | undefined => { const r = rng(); return r < 0.34 ? undefined : r < 0.67 ? 'short' : 'long'; };
  const out: ActionSpec[] = [
    ...(s.clampedSlot === s.globalSlot ? [] : [{ name: 'bite' as const }]), { name: 'claw', sweep: side() }, { name: 'approach', depth: depth() }, { name: 'retreat', depth: depth() },
    { name: 'strafe', dir: turn(), depth: depth() }, { name: 'guard' }, { name: 'intimidate' },
  ];
  if (ready('breath')) out.push({ name: 'breath' });
  if (ready('stomp') && s.z === 0) out.push({ name: 'stomp' });
  if (ready('dodge')) out.push({ name: 'dodge' });
  if (s.f.sheet.flies && s.z < s.rules.MAX_ALTITUDE) out.push({ name: 'leap', depth: depth() });
  // The Drake's hop: a full band forward through the air, landing within the slot; it primes Ravener.
  if (s.f.sheet.aspect === 'ravener' && s.z === 0) out.push({ name: 'leap', depth: depth() });
  // Bellows Chest (mobile): a Breath charge carried on a Move (Wyrmling: Retreat; Juvenile: Strafe too; Venerable: any).
  const bel = s.f.loadout.techniques.find((t) => t.id === 'bellows-chest')?.grade;
  if (bel && s.rules.TECH_BELLOWS_CHEST === 'mobile' && s.globalSlot % R.SLOTS_PER_EXCHANGE < 2 && (s.readyAt.breath ?? 0) <= s.globalSlot + 1) {
    out.push({ name: 'breath', charge: true, move: 'retreat' });
    if (bel !== 'wyrmling') out.push({ name: 'breath', charge: true, move: 'strafe', dir: turn() });
    if (bel === 'venerable') out.push({ name: 'breath', charge: true, move: 'approach' });
  }
  // Sidewinder Spine: a strafe that also shifts along the line, in or out.
  if (s.f.loadout.techniques.some((t) => t.id === 'sidewinder-spine')) out.push({ name: 'strafe', dir: turn(), shift: rng() < 0.5 ? 'in' : 'out' });
  if (s.z > 0) out.push({ name: 'dive', depth: depth() });
  // Talons: a stoop can carry back a band instead of forward, to land clear of a target that chased under it.
  if (s.z > 0 && s.f.sheet.aspect === 'talons') out.push({ name: 'claw', sweep: side(), back: true });
  // A hard landing: all the way down from two bands up, with a free Stomp [Doc].
  if (s.z >= 2 * R.BAND && ready('stomp')) out.push({ name: 'dive', hard: true });
  // A charge takes this slot and the next; it must release by slot 3.
  if (s.globalSlot % R.SLOTS_PER_EXCHANGE < 2) {
    out.push({ name: 'bite', charge: true });
    if ((s.readyAt.breath ?? 0) <= s.globalSlot + 1) out.push({ name: 'breath', charge: true });
  }
  // Setups: an Approach makes the next Bite lunge; a Strafe makes the next Claw pounce. Both take two slots.
  if (s.globalSlot % R.SLOTS_PER_EXCHANGE < 2) {
    out.push({ name: 'bite', setup: 'approach' });
    out.push({ name: 'claw', sweep: side(), dir: turn(), setup: 'strafe' });
  }
  // A charge held two slots earns the bonus; it must start in slot 1.
  if (s.globalSlot % R.SLOTS_PER_EXCHANGE === 0) {
    out.push({ name: 'bite', charge: true, long: true });
    if ((s.readyAt.breath ?? 0) <= s.globalSlot + 1) out.push({ name: 'breath', charge: true, long: true });
  }
  // Crunches come only from shards (a Wyrmling-grade crunch needs a landed hit first, so it isn't planned).
  const grade = (id: string) => s.f.loadout.techniques.find((t) => t.id === id)?.grade;
  const g1 = grade('raking-talons');
  if (g1 && g1 !== 'wyrmling') out.push({ name: 'claw', sweep: side(), crunch: true });
  const g2 = grade('gnashing-teeth');
  if (g2 && g2 !== 'wyrmling') out.push({ name: 'bite', crunch: true });
  // Lockjaw (clamp): no Bite in the clamped slot, charging included. (A setup's Bite comes a slot later.)
  return s.clampedSlot === s.globalSlot ? out.filter((a) => a.name !== 'bite' || a.setup) : out;
}

/** Appends an action to a script being built, filling a charge's release slot too. */
export function place(out: ActionSpec[], s: Situation, a: ActionSpec): Situation {
  if (a.long) {
    out.push({ name: a.name, charge: true });
    s = advance(s, { name: 'hold' });
  }
  if (a.setup) {
    const move: ActionSpec = a.setup === 'strafe' ? { name: 'strafe', dir: a.dir } : { name: 'approach' };
    out.push(move);
    s = advance(s, move);
    a = { name: a.name, sweep: a.sweep };
  }
  out.push(a.long ? { name: a.name, charge: true } : a);
  let next = advance(s, a.charge ? { name: 'hold' } : a);
  if (a.charge && out.length < R.SLOTS_PER_EXCHANGE) {
    out.push({ name: a.name });
    next = advance(next, { name: a.name });
  }
  return next;
}

/** Whether a whole script is still playable from here: no action scripted before its cooldown ends. */
export function playable(script: ActionSpec[], s: Situation): boolean {
  for (const a of script) {
    if ((s.readyAt[a.name] ?? 0) > s.globalSlot + (a.charge ? 1 : 0)) return false;
    s = advance(s, a.charge ? { name: 'hold' } : a);
  }
  return true;
}

/** Advances the imagined situation past one action: cooldowns and altitude. */
export function advance(s: Situation, a: ActionSpec): Situation {
  const readyAt = { ...s.readyAt };
  const cd = ACTIONS[a.name].cooldown;
  if (cd > 0) readyAt[a.name] = s.globalSlot + cd + 1;
  const step = s.rules.BAND_MOVE; // a Leap or Dive carries a band; a Wyvern's Leap climbs two
  const climb = s.f.sheet.aspect === 'talons' ? s.rules.TALONS_LEAP_BANDS * step : step;
  if (a.name === 'dive' && a.hard) readyAt.stomp = s.globalSlot + ACTIONS.stomp.cooldown + 1;
  const z = a.name === 'leap' && s.f.sheet.flies ? Math.min(s.rules.MAX_ALTITUDE, s.z + climb) : a.name === 'dive' ? (a.hard ? 0 : Math.max(0, s.z - step)) : a.name === 'claw' && s.f.sheet.aspect === 'talons' ? 0 : s.z;
  return { ...s, globalSlot: s.globalSlot + 1, z, readyAt };
}
