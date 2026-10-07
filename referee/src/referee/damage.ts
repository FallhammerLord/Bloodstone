// Damage: what a landed hit deals, and what landing it sets off.

import { matchup } from '../hatch.ts';
import { dist, type Vec } from '../geometry.ts';
import type { TechniqueId } from '../shards.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import { affinityAgainst, breathVerb } from './elements.ts';
import type { Event, HitTag } from './events.ts';
import { type Plan, category, guarding, phase } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, type Fighter, J, type Side, V, W, other, tech } from './state.ts';
import { techniqueOnHit } from './techniques.ts';

/**
 * What a landed hit deals: the attack's base against Scales (or Affinity, for Breath), then every modifier.
 * A full Surge makes a Bite, Claw or Breath true damage [Proposed]. Never less than the floor.
 */
export function damage(rules: Rules, att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number): { total: number; parts: string[]; tags: HitTag[]; bypass: boolean } {
  // Ash Gland: the breath carries information, not harm (3 points from Adult).
  const ash = p.spec.name === 'breath' ? tech(att, 'ash-gland') : -1;
  if (ash >= W && rules.TECH_ASH_GLAND === 'pulled') return { total: ash >= A ? 3 : 0, parts: [`Ash Gland: ${ash >= A ? '3 points' : 'no damage'}`], tags: [], bypass: false };

  const parts: string[] = [];
  const tags: HitTag[] = [];
  const bypass = att.meter >= R.METER_MAX && (p.spec.name === 'bite' || p.spec.name === 'claw' || p.spec.name === 'breath') && p.landedHalves === 0;
  const guarded = guarding(defPlan, t);
  const { scales, label } = scalesFelt(rules, att, def, p, t, guarded, bypass);
  if (bypass) {
    parts.push('true damage (full Surge)');
    tags.push('true-damage');
  }
  // Bellows Chest (mobile, Adult): a moving charge keeps the guard's +3 Affinity against Breath.
  const mobileGuard = defPlan.mobileCharge && tech(def, 'bellows-chest') >= A;
  let v = baseDamage(rules, att, def, p, scales, label, guarded || mobileGuard, bypass, parts, tags);
  v += modifiers(rules, att, def, p, defPlan, t, bypass, parts, tags);
  if (v < rules.DAMAGE_FLOOR) {
    v = rules.DAMAGE_FLOOR;
    parts.push(`floor ${rules.DAMAGE_FLOOR}`);
  }
  return { total: v, parts, tags, bypass };
}

/** The Scales a hit meets: Guard, corrosion and guard techniques; none at all for a true-damage hit. */
function scalesFelt(rules: Rules, att: Fighter, def: Fighter, p: Plan, t: number, guarded: boolean, bypass: boolean): { scales: number; label: string } {
  const corroded = def.status.corroded;
  const crunched = p.halves !== null;
  // Guard techniques change Scales while Guarding.
  let guardShift = 0;
  const guardNotes: string[] = [];
  if (guarded) {
    // Thornscale (window) costs the guard's last ticks instead of its Scales.
    const thorn = tech(def, 'thornscale');
    if (thorn >= W && rules.TECH_THORNSCALE === 'base' && (thorn < A || p.spec.name === 'bite')) {
      guardShift -= 3;
      guardNotes.push('Thornscale');
    }
    const mantle = tech(def, 'mantle-wings');
    const mantleBase = rules.TECH_MANTLE_WINGS === 'base';
    // Mantle Wings (verbguard): −3 against Claw only; from Elder, lifted while aloft.
    const mantleHit = mantleBase
      ? (p.spec.name === 'claw' || (p.spec.name === 'bite' && mantle < A)) && !(mantle >= V && def.pos.z > 0)
      : p.spec.name === 'claw' && !(mantle >= E && def.pos.z > 0);
    if (mantle >= W && mantleHit) {
      guardShift -= 3;
      guardNotes.push('Mantle Wings');
    }
  }
  const hard = eff(def, 'scales', { guarded });
  // Gnashing Teeth Elder: the second bite of a crunch pierces 3 Scales.
  if (crunched && p.spec.name === 'bite' && t >= R.HALF && tech(att, 'gnashing-teeth') >= E) {
    guardShift -= 3;
    guardNotes.push('Gnashing Teeth');
  }
  const scales = bypass ? 0 : Math.max(0, hard.value + (guarded ? rules.GUARD_SCALES : 0) - (corroded ? rules.CORRODE_SCALES : 0) + guardShift);
  const label = `Scales ${scales}${guarded ? ' (Guard)' : ''}${corroded ? ' (corroded)' : ''}${guardNotes.length ? ` (−3 ${guardNotes.join(', ')})` : ''}${hard.note}`;
  return { scales, label };
}

/** Each attack's own damage against what it meets, with its own riders (pierce, chain escalation, charge, matchup). */
function baseDamage(rules: Rules, att: Fighter, def: Fighter, p: Plan, scales: number, scalesLabel: string, guarded: boolean, bypass: boolean, parts: string[], tags: HitTag[]): number {
  const crunched = p.halves !== null;
  const sep = dist(att.pos, def.pos);
  let v = 0;
  switch (p.spec.name) {
    case 'bite': {
      // Bite is piercing [Doc]: it ignores some Scales.
      const bite = eff(att, 'bite', {});
      const pierced = Math.max(0, scales - rules.BITE_PIERCE);
      v = bite.value - pierced;
      parts.push(`Bite Force ${bite.value}${bite.note}`, `−${scalesLabel}${scales ? ` pierced to ${pierced}` : ''}`);
      if (p.spec.released && p.spec.full) {
        v += rules.CHARGE_BONUS;
        parts.push(`+${rules.CHARGE_BONUS} charged`);
        tags.push('charged');
      }
      break;
    }
    case 'claw': {
      const claw = eff(att, 'claw', { link: p.spec.revised ? 0 : p.link });
      // A pounce out of a strafe pierces like a Bite [Proposed].
      const felt = p.pounces ? Math.max(0, scales - rules.POUNCE_PIERCE) : scales;
      const rat = tech(att, 'ratchet-claws');
      // Ratchet Claws (escalate, Venerable): a Claw ratcheted to +3 or more pierces 3 Scales.
      const ratchetPierce = rules.TECH_RATCHET_CLAWS === 'escalate' && rat >= V && att.marks.ratchet >= 3 ? 3 : 0;
      const shown = Math.max(0, felt - ratchetPierce);
      v = claw.value - shown;
      parts.push(`Claw Sharpness ${claw.value}${claw.note}`, `−${scalesLabel}${p.pounces && scales ? ` pierced to ${felt} (pounce)` : ''}${ratchetPierce && felt ? ` pierced to ${shown} (Ratchet Claws)` : ''}`);
      if (p.pounces) tags.push('pounce');
      // Ratchet Claws (escalate): each consecutive landed Claw link adds +1 to the next Claw, up to +3 (+6 from Juvenile).
      if (rules.TECH_RATCHET_CLAWS === 'escalate' && rat >= W && att.marks.ratchet > 0) {
        v += att.marks.ratchet;
        parts.push(`+${att.marks.ratchet} ratchet (Ratchet Claws)`);
      }
      // Ratchet Claws: an escalating chain. Each landed link adds to the next (Wyrmling: only into the third).
      const prior = p.link - 1;
      if (rules.TECH_RATCHET_CLAWS === 'base' && rat >= W && !crunched && prior > 0 && (rat >= J || p.link === 3)) {
        const step = rat >= V ? 2 : 1;
        const esc = rat === W ? step : prior * step;
        v += esc;
        parts.push(`+${esc} Ratchet Claws`);
      }
      break;
    }
    case 'breath': {
      const m = matchup(att.sheet.stone, def.sheet.stone) * rules.MATCHUP;
      const breath = eff(att, 'breath', { sep });
      const against = affinityAgainst(rules, att, def, guarded, sep);
      const { aff, guardAff, mantleAff, pierce } = against;
      const affinity = bypass ? 0 : against.affinity;
      v = breath.value - affinity + m;
      parts.push(`Breath Potency ${breath.value}${breath.note}`, `−Affinity ${affinity}${guardAff ? ' (Guard)' : ''}${aff.note}${mantleAff ? ' (Mantle Wings +3)' : ''}${pierce ? ` (Lance Throat pierces ${pierce})` : ''}`);
      const elem = rules.ELEMENT_BREATH_MOD[att.sheet.stone];
      if (elem) {
        v += elem;
        parts.push(`${elem > 0 ? '+' : ''}${elem} ${att.sheet.stone} breath`);
      }
      if (p.spec.released) {
        // Bellows Chest: +3 more, then +6 more, then double Potency from Adult.
        const bel = tech(att, 'bellows-chest');
        const extra = bel >= A ? breath.value : bel === J ? 6 : bel === W ? 3 : 0;
        // Under the charge variant a one-slot charge earns nothing; Bellows Chest restores the +3.
        const base = p.spec.full || bel >= W ? rules.CHARGE_BONUS : 0;
        v += base + extra;
        if (base + extra) {
          parts.push(`+${base + extra} charged${bel >= W ? ' (Bellows Chest)' : ''}`);
          tags.push('charged');
        }
      }
      if (tech(att, 'smoldering-maw') >= W) {
        v -= 3;
        parts.push('−3 Smoldering Maw (it lingers instead)');
      }
      if (m > 0) parts.push(`+${m} matchup`);
      if (m < 0) parts.push(`${m} matchup`);
      break;
    }
    case 'stomp': {
      // Stomp grows with Scales [Proposed]: 3 + Scales ÷ 3, true damage.
      const divisor = rules.STOMP_SCALES_DIVISOR[att.sheet.age];
      const heft = Math.floor(Math.max(0, eff(att, 'scales', {}).value) / divisor);
      v = rules.STOMP_DAMAGE + heft;
      parts.push(`Stomp ${rules.STOMP_DAMAGE} + ${heft} (Scales ÷ ${divisor}) true damage`);
      break;
    }
  }
  return v;
}

/** Modifiers on top of any attack: Acumen, Intimidate and demoralize, chains, technique bonuses, punishes. */
function modifiers(rules: Rules, att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number, bypass: boolean, parts: string[], tags: HitTag[]): number {
  const crunched = p.halves !== null;
  const defPhase = phase(defPlan, t);
  let v = 0;
  // A full meter also adds a steroid: a third of the attacker's Affinity [Proposed].
  if (bypass) {
    const steroid = Math.floor(Math.max(0, eff(att, 'affinity', {}).value) / rules.METER_STEROID_DIVISOR);
    if (steroid) {
      v += steroid;
      parts.push(`+${steroid} Surge (Affinity ÷ ${rules.METER_STEROID_DIVISOR})`);
    }
  }
  if (crunched) {
    parts.push('crunched: no modifiers');
    tags.push('crunched');
  }
  if (p.intimidateBonus) {
    v += rules.INTIMIDATE_BONUS;
    parts.push(`+${rules.INTIMIDATE_BONUS} Intimidate`);
    tags.push('intimidate');
  }
  // A stoop hits harder the farther it falls [Proposed]: +1 per 2 paces, +3 from two bands.
  if (p.stoop && rules.STOOP_PACES_PER_POINT) {
    const drop = Math.floor(p.stoop.from.z / (R.PACE * rules.STOOP_PACES_PER_POINT));
    if (drop > 0) {
      v += drop;
      parts.push(`+${drop} stoop (${(p.stoop.from.z / R.PACE).toFixed(1)} paces)`);
      tags.push('stoop');
    }
  }
  // Earth's corrosion [Proposed]: a corroded dragon takes more from every hit.
  if (def.marks.corrosion) {
    v += def.marks.corrosion.bonus;
    parts.push(`+${def.marks.corrosion.bonus} corroded`);
    tags.push('corroded');
  }
  if (p.demoralized) {
    v -= rules.DEMORALIZE;
    parts.push(`−${rules.DEMORALIZE} demoralized`);
    tags.push('demoralized');
  }
  if (p.link === 3 && !p.spec.revised && !crunched) {
    const sapped = att.marks.sapped === 'any' || (att.marks.sapped === 'claw' && p.spec.name === 'claw');
    const rat = p.spec.name === 'claw' ? tech(att, 'ratchet-claws') : -1;
    if (sapped) {
      att.marks.sapped = null;
      parts.push('chain bonus sapped (Sapping Bellow)');
    } else if (rat >= W && rules.TECH_RATCHET_CLAWS === 'base') {
      // Ratchet Claws pays for its escalation out of the final link's bonus.
      const bonus = rules.CHAIN_THIRD_LINK_BONUS - (rat >= A ? 1 : 3);
      v += bonus;
      parts.push(`+${bonus} chain third link (Ratchet Claws)`);
      tags.push('chain');
    } else {
      v += rules.CHAIN_THIRD_LINK_BONUS;
      parts.push(`+${rules.CHAIN_THIRD_LINK_BONUS} chain third link`);
      tags.push('chain');
    }
  }
  if (p.lockjawBonus) {
    v += 3;
    parts.push('+3 Lockjaw follow-up');
  }
  // Stooping Pinions (nostack): the dive's +3 never adds to a stoop.
  if (p.diveBonus && !(p.stoop && rules.TECH_STOOPING_PINIONS === 'nostack')) {
    v += 3;
    parts.push('+3 Stooping Pinions');
  }
  // Snapping Jaw (borrow_dmg): a snapped Bite deals 3 less, Wyrmling through Adult; Elder's interrupt +3 refunds it.
  const snap = p.spec.name === 'bite' ? tech(att, 'snapping-jaw') : -1;
  if (rules.TECH_SNAPPING_JAW === 'borrow_dmg' && snap >= W && snap < E) {
    v -= 3;
    parts.push('−3 snapped (Snapping Jaw)');
  }
  if (p.spec.name === 'bite' && defPhase === 'windup' && tech(att, 'snapping-jaw') >= E) {
    v += 3;
    parts.push('+3 Snapping Jaw interrupt');
  }
  if (defPhase === 'recovery') {
    v += rules.PUNISH_BONUS;
    parts.push(`+${rules.PUNISH_BONUS} punish (caught in recovery)`);
    tags.push('punish');
  } else if (defPlan.spec.name === 'intimidate' && defPhase !== 'idle') {
    v += rules.PUNISH_BONUS;
    parts.push(`+${rules.PUNISH_BONUS} punish (caught intimidating)`);
    tags.push('punish');
    // Intimidate techniques at Adult: punishes against you deal 3 less [Doc].
    if (['sapping-bellow', 'baleful-eye', 'goading-roar'].some((id) => tech(def, id as TechniqueId) >= A)) {
      v -= 3;
      parts.push('−3 (Intimidate technique)');
    }
  }
  return v;
}

export function applyHit(bout: Bout, plans: Record<Side, Plan>, s: Side, total: number, parts: string[], tags: HitTag[], t: number, trade: boolean, ev: Event[], verbs: { s: Side; aim: Vec }[] | null = null) {
  const p = plans[s];
  const defPlan = plans[other(s)];
  const def = bout.fighters[other(s)];
  p.resolved = true;
  p.landed = true;
  p.landedHalves++;
  def.wounds -= total;
  if ((defPlan.charging || defPlan.mobileCharge) && def.marks.charge) {
    def.marks.charge = null;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'charge-broken', text: 'The hit breaks the charge.' });
  }
  if (p.halves && p.landedHalves === 2 && p.spec.name === 'bite' && tech(bout.fighters[s], 'gnashing-teeth') >= V) {
    def.pending.rattled = true;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'technique', text: 'Gnashing Teeth: both bites land; Rattled.' });
  }
  // A hit in the wind-up interrupts, except a charged Breath's release: the charge is committed [Doc].
  // At Melee, a Breath is lost to any hit before it resolves, active window included.
  const chargedBreath = defPlan.spec.name === 'breath' && defPlan.spec.released;
  const meleeBreath = defPlan.spec.name === 'breath' && !chargedBreath && !defPlan.resolved && phase(defPlan, t) === 'active' && dist(bout.fighters[s].pos, def.pos) <= R.MELEE_EDGE;
  const interrupt = (phase(defPlan, t) === 'windup' && !chargedBreath) || meleeBreath;
  if (interrupt) defPlan.interruptedAt = t;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: p.spec.name, damage: total, parts, tags, interrupt, trade, woundsLeft: def.wounds });
  if (p.spec.name === 'breath' && p.aim && carriesVerb(bout.rules, bout.fighters[s]) && !verbGuarded(bout.rules, bout.fighters[s], def, defPlan, t)) {
    if (verbs) verbs.push({ s, aim: p.aim });
    else breathVerb(bout, s, p, p.aim, t, ev);
  }
  techniqueOnHit(bout, s, p, defPlan, t, ev);
  if (p.spec.name === 'stomp') {
    def.pending.staggered = true;
    // Caught mid-move, it stays Staggered longer [Proposed].
    const caught = category(defPlan) === 'move' && bout.rules.STOMP_MOVER_STAGGER > 1;
    if (caught) def.marks.staggerExtra = Math.max(def.marks.staggerExtra, bout.rules.STOMP_MOVER_STAGGER - 1);
    const slots = caught ? bout.rules.STOMP_MOVER_STAGGER : 1;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'staggered', text: `${caught ? 'Caught mid-move: ' : ''}Staggered for the next ${slots === 1 ? 'slot' : `${slots} slots`}: Evasion halved.` });
  }
}

/** Whether a breath carries its element's verb: not under a pulled Ash Gland, nor a piercing Lance Throat. */
export function carriesVerb(rules: Rules, att: Fighter): boolean {
  if (rules.TECH_ASH_GLAND === 'pulled' && tech(att, 'ash-gland') >= W) return false;
  if (rules.TECH_LANCE_THROAT === 'pierce' && tech(att, 'lance-throat') >= W) return false;
  return true;
}

/** Mantle Wings (verbguard): Guard against a Breath at Melee or Close (any range from Juvenile) blocks its verb. */
export function verbGuarded(rules: Rules, att: Fighter, def: Fighter, defPlan: Plan, t: number): boolean {
  const mantle = tech(def, 'mantle-wings');
  return rules.TECH_MANTLE_WINGS === 'verbguard' && mantle >= W && guarding(defPlan, t) && (mantle >= J || dist(att.pos, def.pos) <= R.CLOSE_EDGE);
}
