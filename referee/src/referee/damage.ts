// Damage: what a landed hit deals, and what landing it sets off.

import { matchup } from '../hatch.ts';
import { dist, type Vec } from '../geometry.ts';
import type { TechniqueId } from '../shards.ts';
import * as R from '../rules.ts';
import type { Rules } from '../rules.ts';
import { affinityAgainst, breathVerb } from './elements.ts';
import type { Event, HitTag } from './events.ts';
import { type Plan, guarding, phase } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, type Fighter, J, type Side, V, W, other, tech } from './state.ts';
import { techniqueOnHit } from './techniques.ts';

/**
 * What a landed hit deals: the attack's base against Hardness (or Affinity, for Breath), then every modifier.
 * A full Acumen meter makes a Bite, Claw or Breath true damage [Proposed]. Never less than the floor.
 */
export function damage(rules: Rules, att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number): { total: number; parts: string[]; tags: HitTag[]; bypass: boolean } {
  // Ash Gland: the breath carries information, not harm (3 points from Adult).
  const ash = p.spec.name === 'breath' ? tech(att, 'ash-gland') : -1;
  if (ash >= W) return { total: ash >= A ? 3 : 0, parts: [`Ash Gland: ${ash >= A ? '3 points' : 'no damage'}`], tags: [], bypass: false };

  const parts: string[] = [];
  const tags: HitTag[] = [];
  const bypass = att.meter >= R.METER_MAX && (p.spec.name === 'bite' || p.spec.name === 'claw' || p.spec.name === 'breath') && p.landedHalves === 0;
  const scales = guarding(defPlan, t);
  const { hardness, label } = hardnessFelt(rules, att, def, p, t, scales, bypass);
  if (bypass) {
    parts.push('true damage (full Acumen meter)');
    tags.push('true-damage');
  }
  let v = baseDamage(rules, att, def, p, hardness, label, scales, bypass, parts, tags);
  v += modifiers(rules, att, def, p, defPlan, t, bypass, parts, tags);
  if (v < rules.DAMAGE_FLOOR) {
    v = rules.DAMAGE_FLOOR;
    parts.push(`floor ${rules.DAMAGE_FLOOR}`);
  }
  return { total: v, parts, tags, bypass };
}

/** The Hardness a hit meets: Scales, corrosion and guard techniques; none at all for a true-damage hit. */
function hardnessFelt(rules: Rules, att: Fighter, def: Fighter, p: Plan, t: number, scales: boolean, bypass: boolean): { hardness: number; label: string } {
  const corroded = def.status.corroded;
  const crunched = p.halves !== null;
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
  const hardness = bypass ? 0 : Math.max(0, hard.value + (scales ? rules.SCALES_HARDNESS : 0) - (corroded ? rules.CORRODE_HARDNESS : 0) + guardShift);
  const label = `Hardness ${hardness}${scales ? ' (Scales)' : ''}${corroded ? ' (corroded)' : ''}${guardNotes.length ? ` (−3 ${guardNotes.join(', ')})` : ''}${hard.note}`;
  return { hardness, label };
}

/** Each attack's own damage against what it meets, with its own riders (pierce, chain escalation, charge, matchup). */
function baseDamage(rules: Rules, att: Fighter, def: Fighter, p: Plan, hardness: number, hardLabel: string, scales: boolean, bypass: boolean, parts: string[], tags: HitTag[]): number {
  const crunched = p.halves !== null;
  const sep = dist(att.pos, def.pos);
  let v = 0;
  switch (p.spec.name) {
    case 'bite': {
      // Bite is piercing [Doc]: it ignores some Hardness.
      const bite = eff(att, 'bite', {});
      const pierced = Math.max(0, hardness - rules.BITE_PIERCE);
      v = bite.value - pierced;
      parts.push(`Bite Force ${bite.value}${bite.note}`, `−${hardLabel}${hardness ? ` pierced to ${pierced}` : ''}`);
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
      const felt = p.pounces ? Math.max(0, hardness - rules.POUNCE_PIERCE) : hardness;
      v = claw.value - felt;
      parts.push(`Claw Sharpness ${claw.value}${claw.note}`, `−${hardLabel}${p.pounces && hardness ? ` pierced to ${felt} (pounce)` : ''}`);
      if (p.pounces) tags.push('pounce');
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
      const m = matchup(att.sheet.stone, def.sheet.stone) * rules.MATCHUP;
      const breath = eff(att, 'breath', { sep });
      const against = affinityAgainst(rules, att, def, scales, sep);
      const { aff, scalesAff, mantleAff, pierce } = against;
      const affinity = bypass ? 0 : against.affinity;
      v = breath.value - affinity + m;
      parts.push(`Breath Potency ${breath.value}${breath.note}`, `−Affinity ${affinity}${scalesAff ? ' (Scales)' : ''}${aff.note}${mantleAff ? ' (Mantle Wings +3)' : ''}${pierce ? ` (Lance Throat pierces ${pierce})` : ''}`);
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
      // Stomp grows with Hardness [Proposed]: 3 + Hardness ÷ 3, true damage.
      const heft = Math.floor(Math.max(0, eff(att, 'hardness', {}).value) / rules.STOMP_HARDNESS_DIVISOR);
      v = rules.STOMP_DAMAGE + heft;
      parts.push(`Stomp ${rules.STOMP_DAMAGE} + ${heft} (Hardness ÷ ${rules.STOMP_HARDNESS_DIVISOR}) true damage`);
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
      parts.push(`+${steroid} Acumen (Affinity ÷ ${rules.METER_STEROID_DIVISOR})`);
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
  // A stoop hits harder the farther it falls [Proposed]: +1 a pace, +3 a band.
  if (p.stoop && rules.STOOP_PER_PACE) {
    const drop = Math.floor((p.stoop.from.z / R.PACE) * rules.STOOP_PER_PACE);
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
    } else if (rat >= W) {
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
  if (p.diveBonus) {
    v += 3;
    parts.push('+3 Stooping Pinions');
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
  if (defPlan.charging && def.marks.charge) {
    def.marks.charge = null;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'charge-broken', text: 'The hit breaks the charge.' });
  }
  if (p.halves && p.landedHalves === 2 && p.spec.name === 'bite' && tech(bout.fighters[s], 'gnashing-teeth') >= V) {
    def.pending.rattled = true;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'technique', text: 'Gnashing Teeth: both bites land; Rattled.' });
  }
  const interrupt = phase(defPlan, t) === 'windup';
  if (interrupt) defPlan.interruptedAt = t;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: p.spec.name, damage: total, parts, tags, interrupt, trade, woundsLeft: def.wounds });
  if (p.spec.name === 'breath' && p.aim && tech(bout.fighters[s], 'ash-gland') < 0) {
    if (verbs) verbs.push({ s, aim: p.aim });
    else breathVerb(bout, s, p, p.aim, t, ev);
  }
  techniqueOnHit(bout, s, p, defPlan, t, ev);
  if (p.spec.name === 'stomp') {
    def.pending.staggered = true;
    ev.push({ kind: 'note', tick: t, side: def.side, tag: 'staggered', text: 'Staggered next slot: movement distance halved.' });
  }
}
