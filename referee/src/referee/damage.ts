// Damage: what a landed hit deals, and what landing it sets off.

import { matchup } from '../hatch.ts';
import { dist, type Vec } from '../geometry.ts';
import type { TechniqueId } from '../shards.ts';
import * as R from '../rules.ts';
import { affinityAgainst, breathVerb } from './elements.ts';
import type { Event } from './events.ts';
import { type Plan, guarding, phase } from './plan.ts';
import { eff } from './riders.ts';
import { A, type Bout, E, type Fighter, J, type Side, V, W, other, tech } from './state.ts';
import { techniqueOnHit } from './techniques.ts';

export function damage(att: Fighter, def: Fighter, p: Plan, defPlan: Plan, t: number, graze: boolean): { total: number; parts: string[]; bypass: boolean } {
  const parts: string[] = [];
  // A full Acumen meter makes the next landed Bite, Claw or Breath true damage: no Hardness, no Affinity [Proposed].
  const bypass = !graze && att.meter >= R.METER_MAX && (p.spec.name === 'bite' || p.spec.name === 'claw' || p.spec.name === 'breath') && p.landedHalves === 0;
  const defPhase = phase(defPlan, t);
  const scales = guarding(defPlan, t);
  const corroded = def.status.corroded;
  const crunched = p.halves !== null;
  const sep = dist(att.pos, def.pos);

  // Ash Gland: the breath carries information, not harm (3 points from Adult).
  const ash = p.spec.name === 'breath' ? tech(att, 'ash-gland') : -1;
  if (ash >= W) return { total: ash >= A ? 3 : 0, parts: [`Ash Gland: ${ash >= A ? '3 points' : 'no damage'}`], bypass: false };

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
  const hardness = bypass ? 0 : Math.max(0, hard.value + (scales ? R.SCALES_HARDNESS : 0) - (corroded ? R.CORRODE_HARDNESS : 0) + guardShift);
  if (bypass) parts.push('true damage (full Acumen meter)');
  const hardLabel = `Hardness ${hardness}${scales ? ' (Scales)' : ''}${corroded ? ' (corroded)' : ''}${guardNotes.length ? ` (−3 ${guardNotes.join(', ')})` : ''}${hard.note}`;
  let v = 0;
  switch (p.spec.name) {
    case 'bite': {
      // Bite is piercing [Doc]: it ignores some Hardness.
      const bite = eff(att, 'bite', {});
      const pierced = Math.max(0, hardness - R.BITE_PIERCE);
      v = bite.value - pierced;
      parts.push(`Bite Force ${bite.value}${bite.note}`, `−${hardLabel}${hardness ? ` pierced to ${pierced}` : ''}`);
      if (p.spec.released && p.spec.full) {
        v += R.CHARGE_BONUS;
        parts.push(`+${R.CHARGE_BONUS} charged`);
      }
      break;
    }
    case 'claw': {
      const claw = eff(att, 'claw', { link: p.spec.revised ? 0 : p.link });
      // A pounce out of a strafe pierces like a Bite [Proposed].
      const felt = p.pounces ? Math.max(0, hardness - R.POUNCE_PIERCE) : hardness;
      v = claw.value - felt;
      parts.push(`Claw Sharpness ${claw.value}${claw.note}`, `−${hardLabel}${p.pounces && hardness ? ` pierced to ${felt} (pounce)` : ''}`);
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
      const m = matchup(att.sheet.stone, def.sheet.stone) * R.MATCHUP;
      const breath = eff(att, 'breath', { sep });
      const against = affinityAgainst(att, def, scales, sep);
      const { aff, scalesAff, mantleAff, pierce } = against;
      const affinity = bypass ? 0 : against.affinity;
      v = breath.value - affinity + m;
      parts.push(`Breath Potency ${breath.value}${breath.note}`, `−Affinity ${affinity}${scalesAff ? ' (Scales)' : ''}${aff.note}${mantleAff ? ' (Mantle Wings +3)' : ''}${pierce ? ` (Lance Throat pierces ${pierce})` : ''}`);
      const elem = R.ELEMENT_BREATH_MOD[att.sheet.stone];
      if (elem) {
        v += elem;
        parts.push(`${elem > 0 ? '+' : ''}${elem} ${att.sheet.stone} breath`);
      }
      if (p.spec.released) {
        // Bellows Chest: +3 more, then +6 more, then double Potency from Adult.
        const bel = tech(att, 'bellows-chest');
        const extra = bel >= A ? breath.value : bel === J ? 6 : bel === W ? 3 : 0;
        // Under the charge variant a one-slot charge earns nothing; Bellows Chest restores the +3.
        const base = p.spec.full || bel >= W ? R.CHARGE_BONUS : 0;
        v += base + extra;
        if (base + extra) parts.push(`+${base + extra} charged${bel >= W ? ' (Bellows Chest)' : ''}`);
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
      const heft = Math.floor(Math.max(0, eff(att, 'hardness', {}).value) / R.STOMP_HARDNESS_DIVISOR);
      v = R.STOMP_DAMAGE + heft;
      parts.push(`Stomp ${R.STOMP_DAMAGE} + ${heft} (Hardness ÷ ${R.STOMP_HARDNESS_DIVISOR}) true damage`);
      break;
    }
  }
  // A full meter also adds a steroid: a third of the attacker's Affinity [Proposed].
  if (bypass) {
    const steroid = Math.floor(Math.max(0, eff(att, 'affinity', {}).value) / R.METER_STEROID_DIVISOR);
    if (steroid) {
      v += steroid;
      parts.push(`+${steroid} Acumen (Affinity ÷ ${R.METER_STEROID_DIVISOR})`);
    }
  }
  if (crunched) parts.push('crunched: no modifiers');
  if (p.intimidateBonus) {
    v += R.INTIMIDATE_BONUS;
    parts.push(`+${R.INTIMIDATE_BONUS} Intimidate`);
  }
  if (p.demoralized) {
    v -= R.DEMORALIZE;
    parts.push(`−${R.DEMORALIZE} demoralized`);
  }
  if (p.link === 3 && !p.spec.revised && !crunched) {
    const sapped = att.marks.sapped === 'any' || (att.marks.sapped === 'claw' && p.spec.name === 'claw');
    const rat = p.spec.name === 'claw' ? tech(att, 'ratchet-claws') : -1;
    if (sapped) {
      att.marks.sapped = null;
      parts.push('chain bonus sapped (Sapping Bellow)');
    } else if (rat >= W) {
      // Ratchet Claws pays for its escalation out of the final link's bonus.
      const bonus = R.CHAIN_THIRD_LINK_BONUS - (rat >= A ? 1 : 3);
      v += bonus;
      parts.push(`+${bonus} chain third link (Ratchet Claws)`);
    } else {
      v += R.CHAIN_THIRD_LINK_BONUS;
      parts.push(`+${R.CHAIN_THIRD_LINK_BONUS} chain third link`);
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
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught in recovery)`);
  } else if (defPlan.spec.name === 'intimidate' && defPhase !== 'idle') {
    v += R.PUNISH_BONUS;
    parts.push(`+${R.PUNISH_BONUS} punish (caught intimidating)`);
    // Intimidate techniques at Adult: punishes against you deal 3 less [Doc].
    if (['sapping-bellow', 'baleful-eye', 'goading-roar'].some((id) => tech(def, id as TechniqueId) >= A)) {
      v -= 3;
      parts.push('−3 (Intimidate technique)');
    }
  }
  if (graze) {
    v -= R.GRAZE_PENALTY;
    parts.push(`−${R.GRAZE_PENALTY} graze`);
  }
  if (v < R.DAMAGE_FLOOR) {
    v = R.DAMAGE_FLOOR;
    parts.push(`floor ${R.DAMAGE_FLOOR}`);
  }
  return { total: v, parts, bypass };
}

export function applyHit(bout: Bout, plans: Record<Side, Plan>, s: Side, total: number, parts: string[], t: number, graze: boolean, trade: boolean, ev: Event[], verbs: { s: Side; aim: Vec }[] | null = null) {
  const p = plans[s];
  const defPlan = plans[other(s)];
  const def = bout.fighters[other(s)];
  p.resolved = true;
  p.landed = true;
  p.landedHalves++;
  def.wounds -= total;
  if (defPlan.charging && def.marks.charge) {
    def.marks.charge = null;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'The hit breaks the charge.' });
  }
  if (p.halves && p.landedHalves === 2 && p.spec.name === 'bite' && tech(bout.fighters[s], 'gnashing-teeth') >= V) {
    def.pending.rattled = true;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'Gnashing Teeth: both bites land; Rattled.' });
  }
  const interrupt = phase(defPlan, t) === 'windup';
  if (interrupt) defPlan.interruptedAt = t;
  ev.push({ kind: 'hit', tick: t, attacker: s, action: p.spec.name, damage: total, parts, interrupt, graze, trade, woundsLeft: def.wounds });
  if (p.spec.name === 'breath' && !graze && p.aim && tech(bout.fighters[s], 'ash-gland') < 0) {
    if (verbs) verbs.push({ s, aim: p.aim });
    else breathVerb(bout, s, p.aim, t, ev);
  }
  techniqueOnHit(bout, s, p, defPlan, t, graze, ev);
  if (p.spec.name === 'stomp') {
    def.pending.staggered = true;
    ev.push({ kind: 'note', tick: t, side: def.side, text: 'Staggered next slot: movement distance halved.' });
  }
}
