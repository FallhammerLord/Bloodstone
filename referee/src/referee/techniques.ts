// Techniques (dragonshards-technique.md): what hits, dodges and Intimidates set off.

import { add, dist, len, scaleTo, type Vec } from '../geometry.ts';
import * as R from '../rules.ts';
import type { Event } from './events.ts';
import { type Plan, guarding } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, J, type Side, V, W, other, tech } from './state.ts';

/** What a landed hit sets off, by the attacker's and defender's Techniques. */
export function techniqueOnHit(bout: Bout, s: Side, p: Plan, defPlan: Plan, t: number, graze: boolean, ev: Event[]) {
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
export function riposte(bout: Bout, s: Side, attackPlan: Plan, dodgePlan: Plan, t: number, ev: Event[]) {
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
export function intimidateLands(bout: Bout, s: Side, t: number, ev: Event[]) {
  const f = bout.fighters[s];
  const opp = bout.fighters[other(s)];
  const note = (text: string) => ev.push({ kind: 'note', tick: t, side: s, text });
  const sep = dist(f.pos, opp.pos);
  if (sep > R.FAR_EDGE) return note('Intimidate falls short: the opponent is beyond Far.');
  // Whatever form it takes, an Intimidate that reaches demoralizes: the target's next Bite or Claw loses 3 [Proposed].
  opp.marks.demoralized = true;
  ev.push({ kind: 'note', tick: t, side: opp.side, text: `Demoralized: its next Bite or Claw loses ${R.DEMORALIZE}.` });
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
export function smolder(bout: Bout, s: Side, origin: Vec, aim: Vec, t: number, ev: Event[]) {
  const f = bout.fighters[s];
  const sm = tech(f, 'smoldering-maw');
  if (sm < W) return;
  const reach = tech(f, 'lance-throat') >= W ? R.FAR_EDGE : f.sheet.stone === 'water' ? R.BREATH.line.reach : f.sheet.stone === 'earth' ? R.BREATH.narrowCone.reach : f.sheet.stone === 'air' ? R.BREATH.vortex.maxCenter : R.BREATH.blast.maxCenter;
  // The area is centered where the breath reaches its target, or its full reach.
  const center = add(origin, scaleTo(aim, Math.min(len(aim), reach)));
  bout.arena.zones.push({
    kind: 'smolder', element: f.sheet.stone, stacks: sm >= V, center,
    radius: sm === W ? R.SMOLDER_RADIUS.center : R.SMOLDER_RADIUS.full,
    lastSlot: bout.globalSlot - 1 + (sm >= A ? 2 : 1), owner: s,
  });
  ev.push({ kind: 'zone', tick: t, owner: s, zone: 'smolder', center });
}
